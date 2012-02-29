exports.createApp = createApp;

function createApp(config, callback) {

	if (config.title) {
		process.title = config.title;
	}
	var services = {};
	var plugins = {};

	loadPlugin(0);
	function loadPlugin(index) {
		var options = config.plugins[index];
		if (!options) return callback(null, {
			plugins: plugins,
			services: services
		});	
		var modulePath = require.resolve(options.module);
		var startup = require(modulePath);
		var imports = {};
		if (options.dependencies) {
			options.dependencies.forEach(function (dependency) {
				if (!services.hasOwnProperty(dependency)) {
					throw new Error(modulePath + " depends on " + dependency + " but it's not loaded yet.");
				}
				imports[dependency] = services[dependency];
			});
		}
		startup(options, imports, function (err, plugin) {
			options.provides.forEach(function (name) {
				if (!plugin.hasOwnProperty(name)) {
					throw new Error(modulePath + " declares it provides " + name + " but didn't export it.");
				}
				if (services.hasOwnProperty(name)) {
					throw new Error(modulePath + " attempted to override an already provided service " + name + ".");
				}
				services[name] = plugin[name];
			});
			plugins[modulePath] = plugin;
			loadPlugin(index + 1);
		});
	}

}



