exports.createApp = createApp;


function createApp(config, callback) {
	var app = {};

	var left = 1, done = false;
	for (var name in config.plugins) {
		left++;
		startPlugin(name, config.plugins[name], function (err, plugin) {
			if (err) return error(err);
			app[name] = plugin;
			check();
		});
	}
	check();

	function error(err) {
		if (done) return;
		done = true;
		return callback(err);
	}

	function check () {
		if (done) return;
		if (!--left) {
			done = true;
			callback(null, app);
		}
	}
}

function startPlugin(name, options, callback) {
	if (options.externalProcess) {
		// TODO: run this plugin in a child process
	}
	callback(new Error("Not Implemented"));
}


