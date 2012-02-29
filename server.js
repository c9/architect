var architect = require('./architect');
var config = require(process.argv[2] || './default-config');

architect.createApp(config, function (err, app) {
	if (err) {
		console.error("While starting the '%s' configuration:", config.name);
		throw err;
	}
	console.log("The '%s' app is now running!", config.name);
});
