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

  resolveConfig(config, base);
}

function resolveConfig(config, base) {
    config.forEach(function (plugin, index) {
        // Shortcut where string is used for plugin without any options.
        if (typeof plugin === "string") {
            plugin = config[index] = { packagePath: plugin };
        }
        // The plugin is a package on the disk.  We need to load it.
        if (plugin.hasOwnProperty("packagePath")) {
            plugin.packagePath = resolvePackageSync(base, plugin.packagePath);
            var packageConf = require(plugin.packagePath);
            var defaults = packageConf.plugin || {};
            Object.keys(defaults).forEach(function (key) {
                if (!plugin.hasOwnProperty(key)) {
                    plugin[key] = defaults[key];
                }
            });
            plugin.setup = require(dirname(plugin.packagePath));
            plugin.consumes = plugin.consumes || [];
            plugin.provides = plugin.provides || [];
        }
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

    // Simulate the plugins providing and consuming their services to see if we
    // will get stuck.
    var services = { hub: true };
    var left = config.length;
    do {
        var changed = false;
        config.forEach(function (plugin) {
            // Skip any plugin that's already checked
            if (plugin.checked) { return; }
            // Skip any plugin that's still pending services
            if (!plugin.consumes.every(function (name) {
                return services[name];
            })) { return; }

            // Record any services this plugin provides
            plugin.provides.forEach(function (name) {
                if (services.hasOwnProperty(name)) {
                    throw new Error("Service name conflict " + name);
                }
                services[name] = true;
            });
            // mark the plugin as done and move on.
            plugin.checked = true;
            left--;
            changed = true;
        });
    } while(changed);

    if (left) {
        var missing = {};
        config.forEach(function (plugin) {
            if (plugin.checked) { return; }
            plugin.consumes.forEach(function (name) {
                missing[name] = true;
            });
        });
        missing = Object.keys(missing);
        throw new Error("Dependency issue with services: " + JSON.stringify(missing));
    }

    // Stamp it approved so we don't check it again.
    config.checked = true;
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

    // Check the config if it's not already checked.
    if (!config.checked) {
        try {
            checkConfig(config)
        } catch (err) {
            app.emit("error", err);
        }
    }

    var running;
    (function startPlugins() {
        if (running) return;
        running = true;
        var pending = 0;
        do {
            var changed = false;
            config.forEach(function (plugin) {
                // Skip already-started and not-yet-ready plugins
                if (plugin.started) return;
                if (!plugin.consumes.every(function (name) {
                    return services[name];
                })) { return; }

                pending++;

                var imports = {};
                plugin.consumes.forEach(function (name) {
                    imports[name] = services[name];
                });
                plugin.started = true;
                plugin.setup(plugin, imports, function (err, provided) {
                    if (err) { return app.emit("error", err); }
                    plugin.provides.forEach(function (name) {
                        if (!provided.hasOwnProperty(name)) {
                            var err = new Error("Plugin failed to provide " + name + " service. " + JSON.stringify(plugin));
                            return app.emit("error", err);
                        }
                        services[name] = provided[name];
                        app.emit("service", name, services[name]);
                        changed = true;
                    });
                    pending--;
                    app.emit("plugin", plugin);
                    if (changed) { startPlugins(); }
                });
            });
        } while (changed);
        running = false;
        if (!pending) {
            app.emit("ready", app);
        }
    }());
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
        app.on("ready", onReady);
        function onError(err) {
            reset();
            callback(err);
        }
        function onReady(app) {
            reset();
            callback(null, app);
        }
        function reset() {
            app.removeListener("error", onError);
            app.removeListener("ready", onReady);
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
