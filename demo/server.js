var path = require('path');
var architect = require("architect");

var configName = process.argv[2] || "default";
var configPath = path.resolve("./configs/", configName);

architect.createApp(configPath, function (err, app) {
    if (err) {
        console.error("While starting the '%s':", configPath);
        throw err;
    }
    console.log("Started '%s'!", configPath);
    console.log(app);
});