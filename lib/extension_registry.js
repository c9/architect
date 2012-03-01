var ExtensionRegistry = module.exports = function() {
    this.points = {};
};

(function() {
    
    this.register = function(point, data) {
        console.log("register extension", point);
        
        if (!this.points[point])
            this.points[point] = [];
            
        this.points[point].push(data);
    };
    
    this.getExtensions = function(point) {
        var exts = this.points[point] || [];
        for (var i = 0; i < exts.length; i++) {
            var ext = exts[i];
            // TODO: shall we always call getService or shall we cache the result?
            ext.service = ext.pluginContext.$module.getExtension(ext.pluginContext, point);
        }
        return exts;
    };

}).call(ExtensionRegistry.prototype);