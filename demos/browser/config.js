require(["../../architect"], function (architect) {
    console.log("architect", architect);
    architect.resolveConfig([
        "plugins/math",
        "plugins/app"
    ], function (err, config) {
        if (err) throw err;
        console.log("config", config);
        architect.createApp(config);
    });
});
