exports.createApp = createApp;


function createApp(config, callback) {

	var app = {};
	
	var master = {
		registerService: function (namespace, functions) {
			// Here namespace is the service's uri and functions is the object that comsumers get when they want to use this service.
		},
		requestService: function (namespace, callback) {
			// Request the service from another plugin.  Callback will be `function(err, functions){...}`
		},
		registerDestructor: function (callback) {
			// This callback will be called when the lifecycle management wants to clean up this plugin
			// callback will be of the form `function(done){}` where the nested callback `done` is the plugin saying it's ready to die.
		}
	}

	var left = 1, done = false;
	for (var name in config.plugins) {
		left++;
		startPlugin(name, config.plugins[name], function (err) {
			if (err) return error(err);
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

	function startPlugin(name, options, callback) {
		if (options.externalProcess) {
			// TODO: run this plugin in a child process
		}
		var pluginModule = require(options.module || name);
		pluginModule(options, master, callback);
	}

}



