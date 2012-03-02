var path = require('path');
var fs = require('fs');

exports.createApp = createApp;

function createApp(configPath, callback) {
    configPath = require.resolve(configPath);
    var config = require(configPath);

    // Default basePath to the dirname of the config file
    var basePath = config.basePath = config.basePath || path.dirname(configPath);

    // Resolve plugin paths to the basePath
    Object.keys(config.containers).forEach(function (containerName) {
        var containerConfig = config.containers[containerName];
        var pluginsConfigs = containerConfig.plugins;
        pluginsConfigs && pluginsConfigs.forEach(function (pluginConfig, index) {
            // packagePath is required on all plugins
            if (!pluginConfig.hasOwnProperty("packagePath")) {
                var err = new Error("'packagePath' required in `" +
                    configPath + "` at " + containerName + "[" + index + "]");
                return callback(err);
            }
            // Replace with fully resolved path
            var packagePath = resolvePackage(basePath, pluginConfig.packagePath);
            pluginConfig.packagePath = packagePath;
        });
    });

    startContainers(config, callback);
}

function startContainers(config, callback) {
    var containers = {};
    config.tmpdir = config.tmpdir || path.join(process.cwd(), ".architect");

    // Start all the containers in parallel, call callback when they are all done.
    var left = 0;
    Object.keys(config.containers).forEach(function (name) {
        left++;

        var containerConfig = config.containers[name];
        containerConfig.name = name;
        if (name !== 'master') {
            // TODO: also make master listen if other containers will need to call it.
            containerConfig.socketPath = path.resolve(config.tmpdir, name + ".socket");
        }
        containerConfig.broadcast = broadcast;
        containerConfig.tmpdir = config.tmpdir;

        var createContainer = (name === "master") ?
            require('./container').createContainer :
            spawnContainer;

        createContainer(containerConfig, function (err, container) {
            if (err) throw err;
            containers[name] = container;
            if (!--left) {
                callback(null, containers);
            }
        });
    });

    // A function that all containers have access to that enables broadcasting.
    function broadcast(name, args) {
        Object.keys(containers).forEach(function (key) {
            containers[key].functions[name].apply(null, args);
        });
    }
}

// Create a new container in a child process
function spawnContainer(config, callback) {
    var child = require('slave').spawn(require.resolve("./container.js"));
    child.on('error', callback);
    child.send(config);
    child.once('message', function (message) {
        child.removeListener('error', callback);
        callback(null, message);
    });

    // TODO: Monitor child for life
}

// Node style package resolving so that plugins' package.json can be found relative to the config file
// It's not the full node require system algorithm, but it's the 99% case
function resolvePackage(base, packagePath) {
    if (packagePath[0] === "." || packagePath[0] === "/") {
        var newPath = path.resolve(base, packagePath, "package.json");
        if (path.existsSync(newPath)) return newPath;
    }
    else {
        while (base) {
            var newPath = path.resolve(base, "node_modules", packagePath, "package.json");
            if (path.existsSync(newPath)) return newPath;
            base = base.substr(0, base.lastIndexOf("/"));
        }
    }
    throw new Error("Can't find '" + packagePach + "' relative to '" + base + '"');
}

