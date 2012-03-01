
exports.start = function(pluginContext, callback) {
    pluginContext.data.instance = new exports.LogService();
    callback();
};

exports.getExtension = function(pluginContext, name) {
    return pluginContext.data.instance;
};

exports.LogService = function() {};

(function() {
    
    this.info = function() {
        console.log.apply(console, arguments);
    };
    
    this.warn = function() {
        console.log.apply(console, arguments);
    };
    
    this.error = function() {
        console.log.apply(console, arguments);
    };
    
}).call(exports.LogService.prototype);