var path = require("path");

var PluginContext = module.exports = function(manager, name, pluginConfig) {
    this.manager = manager;
    this.name = name;
    this.config = pluginConfig;
    
    this.state = PluginContext.STATE_INSTALLED;
    this.base = this.config.base || this.name;
    
    this.references = [];
    this.provides = [];
    
    // can be populated by the plugin e.g. to store instance data
    this.data = {};
};

PluginContext.STATE_INSTALLED = 1;
PluginContext.STATE_RESOLVED = 2;
PluginContext.STATE_STARTING = 3;
PluginContext.STATE_ACTIVE = 4;
PluginContext.STATE_STOPPING = 5;

(function() {

    this.install = function(callback) {
        try {
            this.manifest = require(path.join(this.base, "/package.json"));
            this.manifest.plugin = this.manifest.plugin || {};
        } catch (e) {
            return callback(e);
        }

        var plugin = this.manifest.plugin;
        this.references = plugin.references || [];
        this.provides = plugin.provides || [];

        this.state = PluginContext.STATE_INSTALLED;
        callback();
    };

    this.start = function(callback) {
        for (var i = 0; i < this.provides.length; i++) {
            var ext = this.provides[i];
            ext.pluginContext = this;
            this.manager.extensionRegistry.register(ext.point, ext);
        }

        var module = this.manifest.plugin.module;
        this.$module = require(path.join(this.base, module));
        
        if (this.$module.start)
            this.$module.start(this, callback);
        else
            callback();
    };

    this.stop = function(callback) {
        if (!this.$activator)
            return callback();

        this.$activator.stop(callback);
    };

    this.getService = function(name) {
        var ext = this.manager.extensionRegistry.getExtensions(name)[0];
        if (!ext || !ext.service)
            return;

        return ext.service;
    };

    this.getExtensions = function(point) {
        return this.manager.extensionRegistry.getExtensions(point);
    };

    this.createFunction = function(run) {
        if (typeof run === "string") {
            var call = run.split(":");
            var module = require(path.join(this.base, call[0]));
            return module[call[1]];
        }
    };

}).call(PluginContext.prototype);