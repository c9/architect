define(["events"], function (events) {

    var EventEmitter = events.EventEmitter;

    // Returns an event emitter that represents the app in the callback.
    // event: ("service" name, service) emitted when a service is ready to be consumed.
    // event: ("plugin", plugin) emitted when a plugin registers.
    // event: ("ready", app) emitted when all plugins are ready.
    // event: ("error", err) emitted when something goes wrong.
    // app.services - a hash of all the services in this app
    // app.config - the plugin config that was passed in.
    function createApp(config, callback) {
        var app;
        loadConfig(config, function (err, config) {
            if (err) return callback(err);
            try {
                app = new Architect(config);
                if (callback) {
                    app.on("error", done);
                    app.on("ready", onReady);
                }
            }
            catch(err) {
                callback(err, app);
            }
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
        });
    }

    // Browser based version of loadConfig
    // Uses amd to load modules
    function loadConfig(config, callback) {
        var paths = [], pluginIndexes = {};
        config.forEach(function (plugin, i) {
            if (typeof plugin === "string") {
                plugin = config[i] = { packagePath: plugin };
            }
            if (plugin.packagePath) {
                var index = paths.length;
                paths[index] = plugin.packagePath;
                pluginIndexes[plugin.packagePath] = i;
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
        var app, sortedPlugins;
        app = this;
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
            sortedPlugins = checkConfig(config);
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
        setTimeout(startPlugins);

        this.destroy = function() {
            destructors.forEach(function(destroy) {
                destroy();
            });

            destructors = [];
        };
    }
    Architect.prototype.__proto__ = EventEmitter.prototype;

    Architect.prototype.getService = function(name) {
        if (!this.services[name]) {
            throw new Error("Service '" + name + "' not found in architect app!");
        }
        return this.services[name];
    }
    return {
        createApp: createApp,
        Architect: Architect
    };
});