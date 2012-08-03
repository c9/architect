`architect.cluster`
===================

This plugin wraps the node.js cluster API as an architect plugin.

Usage
-----

In your architect config:

    {
        packagePath: "architect/plugins/architect.cluster",
        pluginBasePath: __dirname + "../plugins",
        numWorkers: 16,
        workerConfig: require("./worker"),
        // This one is optional:
        masterConfig: require("./master")
    }
    
This will spin up 16 worker processes and one master process that manages those
workers, if you specify `masterConfig`, this architect config will be loaded for
the cluster master process. The `pluginBasePath` should point to the root path
of your plugin directory to make plugins with relative paths ("./bla.bla") work.