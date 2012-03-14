var path = require('path');
var EventEmitter = require('events').EventEmitter;

exports.createApp = createApp;

function createApp(configPath, options, callback) {
    if (typeof callback === "undefined") {
        callback = options;
        options = {};
    }
    var config = {};
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

    // Resolve plugin paths to the basePath
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
                pluginConfigBase = require(packagePath).plugin;
            }

            if (!pluginConfigBase) {
                var err = new Error("Missing 'plugin' section in " + packagePath);
                return callback(err);
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

    checkCycles(config);
    startContainers(config, callback);
}

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
        if (config.console && config.console.error) {
            console.error("Could not resolve dependencies of these plugins:", plugins);
            console.error("Resovled services:", resolved);
        }
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

function startContainers(config, callback) {
    var hub = new EventEmitter();

    var containers = {};
    config.tmpdir = config.tmpdir || path.join(process.cwd(), ".architect");

    // Start all the containers in parallel, call callback when they are all done.
    var readyLeft, startLeft;
    readyLeft = startLeft = Object.keys(config.containers).length;
    Object.keys(config.containers).forEach(function (name) {

        var containerConfig = config.containers[name];
        containerConfig.name = name;
        if (needsServe(config.containers, name)) {
            containerConfig.socketPath = path.resolve(config.tmpdir, name + ".socket");
        }
        containerConfig.broadcast = broadcast;
        containerConfig.tmpdir = config.tmpdir;

        var createContainer = (name === "master") ?
            require('./container').createContainer :
            spawnContainer;

        createContainer(containerConfig, function (err, container) {
            if (err) throw err;
            containers[name] = container;
            checkStart();
        });
    });

    hub.on('containerReady', checkReady);

    function checkStart() {
        if (--startLeft) return;

        // Once all the slave processes are created and connected, start creating the plugins.
        // We need the processes connected so that they can receive service start events.
        Object.keys(containers).forEach(function (name) {
            var container = containers[name];
            container.loadPlugins();
        });
    }

    function checkReady() {
        if (--readyLeft) return;
        broadcast("containersDone", {});
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
            console.info("BROADCAST: " + name, message);
        }
        hub.emit(name, message);
        process.nextTick(function () {
            Object.keys(containers).forEach(function (key) {
                containers[key].handleBroadcast(name, message);
            });
        });
    }
}

// Create a new container in a child process
function spawnContainer(config, callback) {
    var child = require('slave').spawn(require.resolve("./container.js"));
    child.on('error', callback);
    child.send(config);
    child.once('message', function (message) {
        child.removeListener('error', callback);
        callback(null, message);
    });

    // TODO: Monitor child for life
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

