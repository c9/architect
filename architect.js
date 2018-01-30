( // Module boilerplate to support node.js and AMD.
    (typeof module !== "undefined" && function(m) { module.exports = m(require('events')); }) ||
    (typeof define === "function" && function(m) { define(["events"], m); })
)(function(events) {
    "use strict";
    var EventEmitter = events.EventEmitter;

    var exports = {};

    var DEBUG = typeof location != "undefined" && location.href.match(/debug=[123]/) ? true : false;

    // Only define Node-style usage using sync I/O if in node.
    if (typeof module === "object")(function() {
        const fs = require("fs");
        const path = require("path");

        function findPackagePath(packagePath, paths) {
            paths = paths.reduce((paths, basePath) => {
                while (basePath != "/") {
                    paths.push(path.resolve(basePath, "node_modules", packagePath, "package.json"));
                    paths.push(path.resolve(basePath, packagePath, "package.json"));
                    paths.push(path.resolve(basePath, "node_modules", packagePath + ".js"));
                    paths.push(path.resolve(basePath, packagePath + ".js"));
                    basePath = path.resolve(basePath, "..");
                }

                return paths;
            }, []);

            for (let packagePath of paths) {
                if (fs.existsSync(packagePath))
                    return packagePath;
            }
        }

        exports.resolveConfig = resolveConfig;

        function resolveConfigAsync(config, base, callback) {
            loadPlugin(config, base)
                .then(config => callback(null, config))
                .catch(err => callback(err));
        }

        function normalize(plugin) {
            if (typeof plugin === "string")
                return { packagePath: plugin };
            return plugin;
        }

        async function resolveConfig(config, base, callback) {
            config = config.map(normalize);

            if (typeof base == "function")
                return resolveConfig(config, null, base);

            if (callback)
                return resolveConfigAsync(config, base, callback);

            return loadPlugin(config, base);
        }

        async function loadPlugin(config, base) {
            for (let plugin of config) {
                if (plugin.hasOwnProperty("setup"))
                    continue;

                let packagePath = findPackagePath(plugin.packagePath, [].concat(base));

                if (!packagePath)
                    throw packageNotFoundError(plugin.packagePath, base);

                let metadata = require(packagePath);
                metadata.packagePath = packagePath;

                if (/package[.].json$/.test(packagePath)) {
                    metadata = metadata.module;
                    let modulePath = require.resolve(path.dirname(packagePath));
                    let module = require(modulePath);
                    metadata.provides = metadata.provides || module.provides || [];
                    metadata.consumes = metadata.consumes || module.consumes || [];
                    metadata.packagePath = modulePath;
                }

                Object.assign(plugin, metadata);
            }

            return config;
        }

        function packageNotFoundError(packagePath, base) {
            let err = new Error(`Can't find ${packagePath} relative to ${base}`);
            err.code = "ENOENT";
            return err;
        }

    }());

    // Otherwise use amd to load modules.
    else(function() {
        exports.loadConfig = loadConfig;
        exports.resolveConfig = resolveConfig;

        function loadConfig(path, callback) {
            require([path], function(config) {
                resolveConfig(config, callback);
            });
        }

        function resolveConfig(config, base, callback, errback) {
            if (typeof base == "function")
                return resolveConfig(config, "", arguments[1], arguments[2]);

            var paths = [],
                pluginIndexes = {};
            config.forEach(function(plugin, index) {
                // Shortcut where string is used for plugin without any options.
                if (typeof plugin === "string") {
                    plugin = config[index] = { packagePath: plugin };
                }
                // The plugin is a package over the network.  We need to load it.
                if (plugin.hasOwnProperty("packagePath") && !plugin.hasOwnProperty("setup")) {
                    paths.push((base || "") + plugin.packagePath);
                    pluginIndexes[plugin.packagePath] = index;
                }
            });
            // Mass-Load path-based plugins using amd's require
            require(paths, function() {
                var args = arguments;
                paths.forEach(function(name, i) {
                    var module = args[i];
                    var plugin = config[pluginIndexes[name]];
                    plugin.setup = module;
                    plugin.provides = module.provides || plugin.provides || [];
                    plugin.consumes = module.consumes || plugin.consumes || [];
                });
                callback(null, config);
            }, errback);
        }
    }());


    // Check a plugin config list for bad dependencies and throw on error
    function checkConfig(config, lookup) {

        // Check for the required fields in each plugin.
        config.forEach(function(plugin) {
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

        return checkCycles(config, lookup);
    }

    function checkCycles(config, lookup) {
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

        while (plugins.length && changed) {
            changed = false;

            plugins.concat().forEach(function(plugin) {
                var consumes = plugin.consumes.concat();

                var resolvedAll = true;
                for (var i = 0; i < consumes.length; i++) {
                    var service = consumes[i];
                    if (!resolved[service] && (!lookup || !lookup(service))) {
                        resolvedAll = false;
                    }
                    else {
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
            var unresolved = {};
            plugins.forEach(function(plugin) {
                delete plugin.config;
                plugin.consumes.forEach(function(name) {
                    if (unresolved[name] === false)
                        return;
                    if (!unresolved[name])
                        unresolved[name] = [];
                    unresolved[name].push(plugin.packagePath);
                });
                plugin.provides.forEach(function(name) {
                    unresolved[name] = false;
                });
            });

            Object.keys(unresolved).forEach(function(name) {
                if (unresolved[name] === false)
                    delete unresolved[name];
            });

            var unresolvedList = Object.keys(unresolved);
            var resolvedList = Object.keys(resolved);
            var err = new Error("Could not resolve dependencies\n" +
                (unresolvedList.length ? "Missing services: " + unresolvedList :
                    "Config contains cyclic dependencies" // TODO print cycles
                ));
            err.unresolved = unresolvedList;
            err.resolved = resolvedList;
            throw err;
        }

        return sorted;
    }


    class Architect extends EventEmitter {
        get destructors() {
            if (!this._destructors)
                this._destructors = [];

            return this._destructors;
        }

        set destructors(val) {
            this._destructors = [];
        }

        addDestructor(fn) {
            this.destructors.push(fn);
        }

        destroy() {
            this.destructors.forEach(function(destroy) {
                destroy();
            });

            this._destructors = [];
        }

        getService(name) {
            if (!this.services[name])
                throw new Error("Service '" + name + "' not found in architect app!");
            return this.services[name];
        }

        async loadAdditionalPlugins(additionalConfig, callback) {
            this.on(this.ready ? "ready-additional" : "ready", () => {
                callback(null, this);
            });

            const sortedPlugins = checkConfig(additionalConfig, (name) => this.services[name]);

            await exports.resolveConfig(additionalConfig);

            this.sortedPlugins = this.sortedPlugins.concat(sortedPlugins);

            if (this.ready)
                return this.startPlugins();

            callback();
        }

        get services() {
            if (!this._services) {
                this._services = {
                    hub: {
                        on: function(name, callback) {
                            this.on(name, callback);
                        }
                    }
                };
            }

            return this._services;
        }

        addService(name, service, plugin) {
            this.services[name] = service;
            this.emit("service", name, service, plugin);

        }

        startPlugin(plugin, next) {
            var imports = {};

            plugin.consumes.forEach((name) => {
                imports[name] = this.services[name];
            });

            plugin.setup(plugin, imports, (err, provided) => {
                if (err) { return this.emit("error", err); }

                plugin.provides.forEach((name) => {
                    if (!provided.hasOwnProperty(name)) {
                        var err = new Error("Plugin failed to provide " + name + " service. " + JSON.stringify(plugin));
                        err.plugin = plugin;
                        return this.emit("error", err);
                    }

                    this.addService(name, provided[name], plugin);
                });

                if (provided && provided.hasOwnProperty("onDestroy"))
                    this.addDestructor(provided.onDestroy);

                this.emit("plugin", plugin);
                next();
            });
        }

        startPlugins() {
            var plugin = this.sortedPlugins.shift();

            if (!plugin) {
                let ready = this.ready;

                this.ready = true;
                this.emit(ready ? "ready-additional" : "ready", this);
                return;
            }

            this.startPlugin(plugin, () => {
                this.startPlugins();
            });
        }


        constructor(config) {
            super();
            this.config = config;
        }

        start() {
            this.sortedPlugins = checkConfig(this.config);
            this.startPlugins();
        }

    }

    exports.createApp = createApp;
    exports.Architect = Architect;


    function delay(fn) {
        (typeof process === "object" ? process.nextTick : setTimeout)(fn);
    }


    // Returns an event emitter that represents the app.  It can emit events.
    // event: ("service" name, service) emitted when a service is ready to be consumed.
    // event: ("plugin", plugin) emitted when a plugin registers.
    // event: ("ready", app) emitted when all plugins are ready.
    // event: ("error", err) emitted when something goes wrong.
    // app.services - a hash of all the services in this app
    // app.config - the plugin config that was passed in.
    function createApp(config, callback) {
        var app = new Architect(config);

        app.once("ready", () => callback(null, app));
        // app.once("error", (err) => callback(err));

        delay(() => {
            try {
                app.start();
            }
            catch(err) {
                if (callback) return callback(err);
                throw err;
            }
        });

        return app;
    }

    return exports;

});
