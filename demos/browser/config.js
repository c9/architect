require(["../../architect"], function (architect) {
    architect.resolveConfig([
        "plugins/math",
        "plugins/app"
    ], function (err, config) {
        if (err) throw err;
        architect.createApp(config);
    });
});
