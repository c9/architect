var path = require('path');
var EventEmitter = require('events').EventEmitter;

exports.createApp = createApp;
function createApp(config, options, callback) {
    if (typeof callback === "undefined") {
        callback = options;
        options = {};
    }
    config = processConfig(config, options);
    // console.log("compiled config:");
    // console.log(JSON.stringify(config));
    startContainers(config, callback);
}

// Gather and preflight the config.
exports.processConfig = processConfig;
function processConfig(configPath, options) {
    options = options || {};
    var config = {};

    // Allow passing in either config path or config object
    if (typeof configPath === "object") {
        config = configPath;
        configPath = "<provided config object>";
        if (!config.basePath) {
            var err = new Error("'basePath' required in config object");
            return callback(err);
        }
    } else {
        configPath = require.resolve(configPath);
        config = require(configPath);
    }

    // Overwrite console object from config if set in createApp options
    if (typeof options.console !== "undefined") {
        config.console = options.console;
    } else {
        config.console = console;
    }

    // Default basePath to the dirname of the config file
    var basePath = config.basePath = config.basePath || path.dirname(configPath);

    // Resolve plugin paths to the basePath and merge in plugin configs from
    // package.json files.
    Object.keys(config.containers).forEach(function (containerName) {
        var containerConfig = config.containers[containerName];
        var pluginsConfigs = containerConfig.plugins;
        pluginsConfigs && pluginsConfigs.forEach(function (pluginConfig, index) {

            // if plugin is a string it is interpreted as the package path
            if (typeof pluginConfig === "string") {
                pluginsConfigs[index] = pluginConfig = {
                    packagePath: pluginConfig
                };
            }

            // packagePath is required on all plugins
            if (!pluginConfig.hasOwnProperty("packagePath")) {
                var err = new Error("'packagePath' required in `" +
                    configPath + "` at " + containerName + "[" + index + "]");
                return callback(err);
            }

            var pluginConfigBase;

            // the architect app can inject plugins into the master
            if (pluginConfig.plugin) {
                if (containerName !== "master")
                    return new Error("Plugins can only be injected into the master container");

                var pluginConfigBase = pluginConfig.plugin;
            }
            else {
                // Replace with fully resolved path
                var packagePath = resolvePackage(basePath, pluginConfig.packagePath);
                pluginConfig.packagePath = packagePath;

                // Look up the provides and consumes in the package.json and merge.
                try {
                    pluginConfigBase = require(packagePath).plugin;
                } catch(err) {
                    throw new Error("Error '" + err + "' loading config from " + packagePath);
                }
            }

            if (!pluginConfigBase) {
                throw new Error("Missing 'plugin' section in " + packagePath);
            }

            for (var key in pluginConfigBase) {
                if (!pluginConfig.hasOwnProperty(key)) {
                    pluginConfig[key] = pluginConfigBase[key];
                }
            }

            // provide defaults
            pluginConfig.provides = pluginConfig.provides || [];
            pluginConfig.consumes = pluginConfig.consumes || [];
        });
    });

    // Set a tmpdir for anything that might need it.
    config.tmpdir = config.tmpdir || path.join(process.cwd(), ".architect");

    // Tell which containers need to listen for inbound connections. Also set
    // name and tmpdir for all containers.
    Object.keys(config.containers).forEach(function (containerName) {
        var containerConfig = config.containers[containerName];
        if (needsServe(config.containers, containerName)) {
            containerConfig.needsServe = true;
        }
        containerConfig.name = containerName;
        containerConfig.tmpdir = config.tmpdir;
    });

    // Make sure there are no dependency cycles that would prevent the app
    // from starting.
    checkCycles(config);

    return config;

    // pre flight dependency check
    function checkCycles(config) {
        var plugins = [];
        var containers = config.containers;
        Object.keys(containers).forEach(function(containerName) {
            var pluginConfigs = containers[containerName].plugins || [];
            pluginConfigs.forEach(function(pluginConfig) {
                plugins.push({
                    packagePath: pluginConfig.packagePath,
                    provides: pluginConfig.provides.concat(),
                    consumes: pluginConfig.consumes.concat()
                });
            });
        });

        var resolved = {
            hub: true
        };
        var changed = true;

        while(plugins.length && changed) {
            changed = false;

            plugins.concat().forEach(function(plugin) {
                var consumes = plugin.consumes.concat();

                var resolvedAll = true;
                for (var i=0; i<consumes.length; i++) {
                    var service = consumes[i];
                    if (!resolved[service]) {
                        resolvedAll = false;
                    } else {
                        plugin.consumes.splice(plugin.consumes.indexOf(service), 1);
                    }
                }

                if (!resolvedAll)
                    return;

                plugins.splice(plugins.indexOf(plugin), 1);
                plugin.provides.forEach(function(service) {
                    resolved[service] = true;
                });
                changed = true;
            });
        }

        if (plugins.length) {
            console.error("Could not resolve dependencies of these plugins:", plugins);
            console.error("Resovled services:", resolved);
            throw new Error("Could not resolve dependencies");
        }
    }

    function calcProvides(container) {
        var provides = {};
        var plugins = container.plugins;
        plugins && plugins.forEach(function (plugin) {
            plugin.provides.forEach(function (service) {
                provides[service] = true;
            });
        });
        return provides;
    }

    function calcDepends(container, provides) {
        if (!container.plugins) return false;
        var i = container.plugins.length;
        while (i--) {
            var consumes = container.plugins[i].consumes;
            var j = consumes.length;
            while (j--) {
                if (provides[consumes[j]]) return true;
            }
        }
        return false;
    }

    function needsServe(containers, name) {
        var provides = calcProvides(containers[name]);
        // First calculate what all services this container provides.
        for (var key in containers) {
            if (!containers.hasOwnProperty(key)) continue;
            if (key === name) continue;
            if (calcDepends(containers[key], provides)) return true;
        }
        return false;
    }
}

exports.startContainers = startContainers;
function startContainers(config, callback) {
    var hub = new EventEmitter();
    var Agent = require('architect-agent').Agent;

    var containers = {};

    // This agent is used for the star topology of events.  All child processes have access to it.
    var hubAgent = new Agent({
        broadcast: broadcast
    });

    // Create all the containers in parallel (as dumb workers).  Then once
    // they are all created, tell them all to initialize in parallel.  When
    // they are all ready, call the callback.
    var createLeft, readyLeft;
    createLeft = readyLeft = Object.keys(config.containers).length;
    // Create all the containers in parallel.
    Object.keys(config.containers).forEach(function (name) {
        var createContainer = (name === "master") ?
            require('./container').createContainer :
            spawnContainer;

        createContainer(name, broadcast, function (err, container) {
            if (err) throw err;
            containers[name] = container;
            broadcast("containerCreated", name);
            if (--createLeft) return;
            Object.keys(containers).forEach(function (name) {
                containers[name].initialize(config.containers[name]);
            });
        });

    });

    hub.on('containerReady', checkReady);

    function checkReady() {
        if (--readyLeft) return;
        broadcast("containersDone", Object.keys(containers));
        callback(null, containers);
    }

    // A function that all containers have access to that enables broadcasting.
    // The following kinds messages are broadcasts to all containers:
    //  - serviceReady { container, socket, name, functions }
    //  - servicesDone {} - all services are initialized
    //  - serviceDied {serviceName}
    //  - containerReady { container }
    //  - containerDied {containerName}
    //  - containersDone {} - all containers are initialized
    function broadcast(name, message) {
        if (config.console && config.console.info) {
            //console.info("BROADCAST: " + name, message);
        }
        hub.emit(name, message);
        process.nextTick(function () {
            Object.keys(containers).forEach(function (key) {
                if (typeof containers[key].onBroadcast !== "function") {
                    console.log("containers[%s]", key, containers[key]);
                }
                containers[key].onBroadcast(name, message);
            });
        });
    }


    // Create a new container in a child process
    function spawnContainer(name, broadcast, callback) {
        var spawn = require('child_process').spawn;
        var Agent = require('architect-agent').Agent;
        var socketTransport = require('architect-socket-transport');

        var child = spawn(process.execPath, [require.resolve('./worker-process.js')], {
            customFds: [-1, 1, 2],
            stdinStream: createPipe(true),
            env: { ARCHITECT_CONTAINER_NAME: name }
        });

        var transport = socketTransport(child.stdin);
        hubAgent.attach(transport, function (container) {
            callback(null, container);
        });
        child.stdin.resume();

        // TODO: Monitor child for life
    }

}

// Taken from node's child process code.
var Pipe;
function createPipe(ipc) {
  // Lazy load
  if (!Pipe) {
    Pipe = process.binding('pipe_wrap').Pipe;
  }
  return new Pipe(ipc);
}

// Node style package resolving so that plugins' package.json can be found relative to the config file
// It's not the full node require system algorithm, but it's the 99% case
function resolvePackage(base, packagePath) {
    if (packagePath[0] === "." || packagePath[0] === "/") {
        var newPath = path.resolve(base, packagePath, "package.json");
        if (path.existsSync(newPath)) return newPath;
    }
    else {
        while (base) {
            var newPath = path.resolve(base, "node_modules", packagePath, "package.json");
            if (path.existsSync(newPath)) return newPath;
            base = base.substr(0, base.lastIndexOf("/"));
        }
    }
    throw new Error("Can't find '" + packagePath + "' relative to '" + base + '"');
}

