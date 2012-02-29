// This is a sample plugin that serves static files using a raw http route
module.exports = function startup(options, master, callback) {
	var creationix = require('creationix');
	var root = options.root || process.cwd();
	
	master.requestService('http', function (err, http) {
		if (err) return callback(err);
		http.raw(creationix.static("/", root, "index.html"), callback);
	});
};