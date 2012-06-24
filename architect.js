var dirname = require('path').dirname;
var resolve = require('path').resolve;
var existsSync = require('path').existsSync;
var realpathSync = require('fs').realpathSync;
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

exports.loadConfig = loadConfig;
exports.resolveConfig = resolveConfig;
exports.createApp = createApp;
exports.Architect = Architect;

// This is assumed to be used at startup and uses sync I/O as well as can
// throw exceptions.  It loads and parses a config file.
function loadConfig(configPath) {
  var config = require(configPath);
  var base = dirname(configPath);

  return resolveConfig(config, base);
}

function resolveConfig(config, base) {
    config.forEach(function (plugin, index) {
        // Shortcut where string is used for plugin without any options.
        if (typeof plugin === "string") {
            plugin = config[index] = { packagePath: plugin };
        }
        // The plugin is a package on the disk.  We need to load it.
        if (plugin.hasOwnProperty("packagePath") && !plugin.hasOwnProperty("setup")) {
            plugin.packagePath = resolvePackageSync(base, plugin.packagePath);
            var packageConf = require(plugin.packagePath);
            var defaults = packageConf.plugin || {};
            Object.keys(defaults).forEach(function (key) {
                if (!plugin.hasOwnProperty(key)) {
                    plugin[key] = defaults[key];
                }
            });
            plugin.setup = require(dirname(plugin.packagePath));
        }
        plugin.consumes = plugin.consumes || [];
        plugin.provides = plugin.provides || [];
    });
    return config;
}

// Check a plugin config list for bad dependencies and throw on error
function checkConfig(config) {

    // Check for the required fields in each plugin.
    config.forEach(function (plugin) {
        if (plugin.checked) { return; }
        if (!plugin.hasOwnProperty("setup")) {
            throw new Error("Plugin is missing the setup function " + JSON.stringify(plugin));
        }
        if (!plugin.hasOwnProperty("provides")) {
            throw new Error("Plugin is missing the provides array " + JSON.stringify(plugin));
        }
        if (!plugin.hasOwnProperty("consumes")) {
            throw new Error("Plugin is missing the consumes array " + JSON.stringify(plugin));
        }
    });

    return checkCycles(config);
}

function checkCycles(config) {
    var plugins = [];
    config.forEach(function(pluginConfig) {
        plugins.push({
            packagePath: pluginConfig.packagePath,
            provides: pluginConfig.provides.concat(),
            consumes: pluginConfig.consumes.concat(),
            config: pluginConfig
        });
    });

    var resolved = {
        hub: true
    };
    var changed = true;
    var sorted = [];

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
            sorted.push(plugin.config);
            changed = true;
        });
    }

    if (plugins.length) {
        console.error("Could not resolve dependencies of these plugins:", plugins);
        console.error("Resovled services:", resolved);
        throw new Error("Could not resolve dependencies");
    }

    return sorted;
}

function Architect(config) {
    var app = this;
    app.config = config;
    var services = app.services = {
        hub: {
            on: function (name, callback) {
                app.on(name, callback);
            }
        }
    };

    // Check the config
    try {
        var sortedPlugins = checkConfig(config)
    } catch (err) {
        return app.emit("error", err);
    }

    var destructors = [];

    function startPlugins() {
        var plugin = sortedPlugins.shift();
        if (!plugin)
            return app.emit("ready", app);

        var imports = {};
        if (plugin.consumes) {
            plugin.consumes.forEach(function (name) {
                imports[name] = services[name];
            });
        }

        plugin.setup(plugin, imports, function (err, provided) {
            if (err) { return app.emit("error", err); }
            plugin.provides.forEach(function (name) {
                if (!provided.hasOwnProperty(name)) {
                    var err = new Error("Plugin failed to provide " + name + " service. " + JSON.stringify(plugin));
                    return app.emit("error", err);
                }
                services[name] = provided[name];
                app.emit("service", name, services[name]);
            });
            if (provided && provided.hasOwnProperty("onDestroy"))
                destructors.push(provided.onDestroy);

            app.emit("plugin", plugin);
            startPlugins();
        });
    }

    // Give createApp some time to subscribe to our "ready" event
    process.nextTick(startPlugins);

    this.destroy = function() {
        destructors.forEach(function(destroy) {
            destroy();
        });

        destructors = [];
    };
}
inherits(Architect, EventEmitter);

// Returns an event emitter that represents the app.  It can emit events.
// event: ("service" name, service) emitted when a service is ready to be consumed.
// event: ("plugin", plugin) emitted when a plugin registers.
// event: ("ready", app) emitted when all plugins are ready.
// event: ("error", err) emitted when something goes wrong.
// app.services - a hash of all the services in this app
// app.config - the plugin config that was passed in.
function createApp(config, callback) {
    var app = new Architect(config);
    if (callback) {
        app.on("error", onError);
        app.once("ready", onReady);

        function onError(err) {
            app.removeListener("ready", done);
            app.destroy();
            done(err, app);
        }

        function onReady() {
            done(null, app);
        }

        var called = false;
        function done(err) {
          if (called) return;
          called = true;
          callback(err, app);
        }
    }
    return app;
}

// Node style package resolving so that plugins' package.json can be found relative to the config file
// It's not the full node require system algorithm, but it's the 99% case
// This throws, make sure to wrap in try..catch
var packagePathCache = {};
function resolvePackageSync(base, packagePath) {
    var originalBase = base;
    if (!packagePathCache.hasOwnProperty(base)) {
        packagePathCache[base] = {};
    }
    var cache = packagePathCache[base];
    if (cache.hasOwnProperty(packagePath)) {
        return cache[packagePath];
    }
    if (packagePath[0] === "." || packagePath[0] === "/") {
        var newPath = resolve(base, packagePath, "package.json");
        if (existsSync(newPath)) {
            newPath = realpathSync(newPath);
            cache[packagePath] = newPath;
            return newPath;
        }
    }
    else {
        while (base) {
            var newPath = resolve(base, "node_modules", packagePath, "package.json");
            if (existsSync(newPath)) {
                newPath = realpathSync(newPath);
                cache[packagePath] = newPath;
                return newPath;
            }
            base = base.substr(0, base.lastIndexOf("/"));
        }
    }
    var err = new Error("Can't find '" + packagePath + "' relative to '" + originalBase + "'");
    err.code = "ENOENT";
    throw err;
}
