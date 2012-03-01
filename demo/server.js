var path = require('path');
var architect = require("architect");

var configName = process.argv[2] || "default";
var config = require(path.resolve("./configs/", configName));

architect.createApp(config, function (err, app) {
    if (err) {
        console.error("While starting the '%s' configuration:", config.name);
        throw err;
    }
    console.log("The '%s' app is now running!", config.name);
    console.log(app);
});