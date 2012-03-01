// This is a sample plugin that serves static files using a raw http route
module.exports = function startup(options, imports, register) {
    var creationix = require('creationix');

    var root = options.root || process.cwd();

    imports.http.raw(creationix.static("/", root, "index.html"), register);
};