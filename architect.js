
( // Module boilerplate to support node.js and AMD.
  (typeof module === "object" && function (m) { module.exports = m(require('events')); }) ||
  (typeof define === "function" && function (m) { define(["events"], m); })
)(function (events) {
"use strict";
var EventEmitter = events.EventEmitter;

var exports = {};

// Only define Node-style usage using sync I/O if in node.
if (typeof module === "object") (function () {
    var dirname = require('path').dirname;
    var resolve = require('path').resolve;
    var existsSync = require('fs').existsSync || require('path').existsSync;
    var realpathSync = require('fs').realpathSync;
    var packagePathCache = {};

    exports.loadConfig = loadConfig;
    exports.resolveConfig = resolveConfig;

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
                var defaults = resolveModule(base, plugin.packagePath);
                Object.keys(defaults).forEach(function (key) {
                    if (!plugin.hasOwnProperty(key)) {
                        plugin[key] = defaults[key];
                    }
                });
                plugin.packagePath = defaults.packagePath;
                plugin.setup = require(plugin.packagePath);
            }
        });
        return config;
    }

    // Loads a module, getting metadata from either it's package.json or export
    // object.
    function resolveModule(base, modulePath) {
        var packagePath;
        try {
            packagePath = resolvePackageSync(base, modulePath + "/package.json");
        }
        catch (err) {
            if (err.code !== "ENOENT") throw err;
        }
        var metadata = packagePath && require(packagePath).plugin || {};
        if (packagePath) {
            modulePath = dirname(packagePath);
        } else {
            modulePath = resolvePackageSync(base, modulePath);
        }
        var module = require(modulePath);
        metadata.provides = metadata.provides || module.provides || [];
        metadata.consumes = metadata.consumes || module.consumes || [];
        metadata.packagePath = modulePath;
        return metadata;
    }

    // Node style package resolving so that plugins' package.json can be found relative to the config file
    // It's not the full node require system algorithm, but it's the 99% case
    // This throws, make sure to wrap in try..catch
    function resolvePackageSync(base, packagePath) {
        var originalBase = base;
        if (!(base in packagePathCache)) {
            packagePathCache[base] = {};
        }
        var cache = packagePathCache[base];
        if (packagePath in cache) {
            return cache[packagePath];
        }
        var newPath;
        if (packagePath[0] === "." || packagePath[0] === "/") {
            newPath = resolve(base, packagePath);
            if (existsSync(newPath)) {
                newPath = realpathSync(newPath);
                cache[packagePath] = newPath;
                return newPath;
            }
        }
        else {
            while (base) {
                newPath = resolve(base, "node_modules", packagePath);
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

}());

// Otherwise use amd to load modules.
else (function () {
    exports.loadConfig = loadConfig;
    exports.resolveConfig = resolveConfig;

    function loadConfig(path, callback) {
        require([path], function (config) {
            resolveConfig(config, callback);
        });
    }

    function resolveConfig(config, callback) {
        var paths = [], pluginIndexes = {};
        config.forEach(function (plugin, index) {
            // Shortcut where string is used for plugin without any options.
            if (typeof plugin === "string") {
                plugin = config[index] = { packagePath: plugin };
            }
            // The plugin is a package over the network.  We need to load it.
            if (plugin.hasOwnProperty("packagePath") && !plugin.hasOwnProperty("setup")) {
                paths.push(plugin.packagePath);
                pluginIndexes[plugin.packagePath] = index;
            }
        });
        // Mass-Load path-based plugins using amd's require
        require(paths, function () {
            var args = arguments;
            paths.forEach(function (name, i) {
                var module = args[i];
                var plugin = config[pluginIndexes[name]];
                plugin.setup = module;
                plugin.provides = module.provides || [];
                plugin.consumes = module.consumes || [];
            });
            callback(null, config);
        });
    }
}());

exports.createApp = createApp;
exports.Architect = Architect;

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
    config.forEach(function(pluginConfig, index) {
        plugins.push({
            packagePath: pluginConfig.packagePath,
            provides: pluginConfig.provides.concat(),
            consumes: pluginConfig.consumes.concat(),
            i: index
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
            sorted.push(config[plugin.i]);
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
        var sortedPlugins = checkConfig(config);
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
    (typeof process === "object" ? process.nextTick : setTimeout)(startPlugins);

    this.destroy = function() {
        destructors.forEach(function(destroy) {
            destroy();
        });

        destructors = [];
    };
}
Architect.prototype = Object.create(EventEmitter.prototype, {constructor:{value:Architect}});

Architect.prototype.getService = function(name) {
    if (!this.services[name]) {
        throw new Error("Service '" + name + "' not found in architect app!");
    }
    return this.services[name];
};

// Returns an event emitter that represents the app.  It can emit events.
// event: ("service" name, service) emitted when a service is ready to be consumed.
// event: ("plugin", plugin) emitted when a plugin registers.
// event: ("ready", app) emitted when all plugins are ready.
// event: ("error", err) emitted when something goes wrong.
// app.services - a hash of all the services in this app
// app.config - the plugin config that was passed in.
function createApp(config, callback) {
    var app;
    try {
        app = new Architect(config);
    } catch(err) {
        if (!callback) throw err;
        return callback(err, app);
    }
    if (callback) {
        app.on("error", done);
        app.on("ready", onReady);
    }
    return app;

    function onReady(app) {
        done();
    }

    function done(err) {
        if (err) {
            app.destroy();
        }
        app.removeListener("error", done);
        app.removeListener("ready", onReady);
        callback(err, app);
    }

}

return exports;

});