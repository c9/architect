var assert = require("assert");
var cluster = require("cluster");
var architect = require("../../architect");

module.exports = function startup(options, imports, register) {
    assert(options.pluginBaseDir, "Option 'pluginBaseDir' is required");
    assert(options.workerConfig, "Option 'workerConfig' is required");
    assert(options.numWorkers, "Option 'numWorkers' is required");

    var numWorkers = options.numWorkers;

    if (cluster.isMaster) {
        // Fork each worker onto its own thread
        for (var i = 0; i < numWorkers; i++) {
            cluster.fork();
        }

        // When a worker dies, fork a new one
        cluster.on('death', function(worker) {
            cluster.fork();
        });

        if (options.masterConfig) {
            var plugins = architect.resolveConfig(options.masterConfig, options.pluginBaseDir);
            architect.createApp(plugins, onCreateApp);
        }
    }
    else {
        // If the worker is not the master process, run the worker config
        var plugins = architect.resolveConfig(options.workerConfig, options.pluginBaseDir);
        architect.createApp(plugins, onCreateApp);
    }

    function onCreateApp(err) {
        if (err)
            throw err;
    }

    register(null, {});
};
