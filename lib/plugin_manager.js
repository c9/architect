var async = require("./async");
var PluginContext = require("./plugin_context");
var ExtensionRegistry = require("./extension_registry");

var PluginManager = module.exports = function(config) {
    this.config = config;

    this.extensionRegistry = new ExtensionRegistry();
    this.plugins = {};
};

(function() {

    this.start = function(callback) {
        async.chain(
            this.installPlugins.bind(this),
            this.resolveDependencies.bind(this),
            this.startPlugins.bind(this),
            callback
        );
    };

    this.stop = function() {
    };

    this.installPlugins = function(callback) {
        var self = this;
        var plugins = this.config.plugins;

        async.forEach(Object.keys(plugins), function(name, next) {
            var plugin = new PluginContext(self, name, plugins[name]);
            self.plugins[name] = plugin;
            plugin.install(next);
        }, callback);
    };

    this.resolveDependencies = function(callback) {

        var plugins = Object.keys(this.plugins);
        this.startOrder = [];

        var changed = true;
        var resolved = {};
        while (changed && plugins.length) {
            changed = false;

            for (var i = 0; i < plugins.length; i++) {
                var pluginName = plugins[i];
                var plugin = this.plugins[pluginName];

                var dependencies = plugin.references.filter(function(dep) {
                    return !(dep in resolved);
                });
                if (!dependencies.length) {
                    for (var j = 0; j < plugin.provides.length; j++)
                        resolved[plugin.provides[j].point] = 1;

                    plugins.splice(i, 1);
                    this.startOrder.push(pluginName);
                    changed = true;
                }
            }
        }

        if (plugins.length)
            return callback(new Error("Could not resolve dependencies of " + plugins + ": " + dependencies));

        callback();
    };

    this.startPlugins = function(callback) {
        var self = this;

        async.forEach(this.startOrder, function(name, next) {
            console.log("start", name);
            self.plugins[name].start(next);
        }, callback);
    };

}).call(PluginManager.prototype);