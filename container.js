var net = require('net');
var path = require('path');
var protocol = require('remoteagent-protocol');

// if we're a worker process, this message will be our container config
process.once('message', function (config) {
    createContainer(config, function (err, container) {
        if (err) throw err;
        process.send(container);
    });
});

exports.createContainer = createContainer;
function createContainer(config, callback) {
    var serviceMap = {}; // For all services
    var services = {}; // local services provided by this container
    var plugins = []; // plugins that live in this container
    var pendingPlugins = []; // plugins that are waiting on their dependencies
    var connections = {};

    var container = {
        pid: process.pid,
        name: config.name,
        onBroadcast: onBroadcast,
        onRequest: onRequest,
        connect: connect,
        services: services
    }

    if (config.socketPath) {
        container.socketPath = config.socketPath;
        listen(container, reportError);
    }
    loadPlugins(reportError);

    return callback(null, container);

    function reportError(err) {
        if (err) throw err;
        // TODO: send some sort of event instead.
    }

    function onBroadcast(name, args) {
        console.error("TODO: Implement onBroadcast");
    }

    function onRequest(name, args) {
        console.error("TODO: Implement onRequest");
    }

    function connect(socketPath, callback) {
        if (connections[socketPath]) return callback(null, connections[socketPath]);
        // TODO: Implement request batch for when multiple requests for the
        // same connection happen at once.
        var socket = net.connect(socketPath, function () {
            protocol.connectToClient(socket, socket, function (err, remote, container) {
                if (!err) {
                    container.remote = container;
                    connections[socketPath] = container;
                }
                callback(err, container);
            });
        });
    }

    function loadPlugins(callback) {
        console.error("TODO: Implement loadPlugins");
    }


    function listen(callback) {
        net.createServer(function (socket) {
            protocol.startClient(socket, socket, container);
        }).listen(container.socketPath, callback);
    }


    ////////////////////////////////////////////////////////////////////////////

    // function mapService(serviceName, containerName) {
    //     serviceMap[serviceName] = containerName;

    //     // Since there is a new service available, we might be able to start some pending plugins.
    //     var i = pendingPlugins.length;
    //     while (i--) {
    //         var item = pendingPlugins[i];
    //         if (checkDependencies(item.manifest.dependencies)) {
    //             pendingPlugins.splice(i, 1);
    //             startPlugin(item.options, item.callback);
    //         }
    //     }
    // }

}





// Connect to a remote container
var connections = {};
function connect(name, callback) {
    if (connections.hasOwnProperty(name)) {
        return callback(null, connections[name]);
    }
    var socketPath = path.join(tmpdir, name + ".socket");
    var connection = connections[name] = {
        name: name,
        socketPath: socketPath
    };

    var client = net.connect(socketPath, function () {
        protocol.connectToClient(client, client, function (err, remote, functions) {
            if (err) return callback(err);
            connection.remote = remote;
            connection.functions = functions;
            callback(null, connection);
        });
    });
}



function listen(socketPath, callback) {




    function configure(config_, emit_, callback) {
        config = config_;
        emit = emit_;
        name = config.name;
        config.title && (process.title = config.title);

        var left = 1;
        config.plugins && Object.keys(config.plugins).forEach(function (name) {
            left++;

            startPlugin(config.plugins[name], function (err, plugin) {
                if (err) return callback(err);
                plugins.push(plugin);
                check();
            });
        });
        check();

        function check() {
            if (!--left) done();
        }

        function done() {
            if (config.gid) {
                try {
                    process.setgid(config.gid);
                } catch (err) {
                    if (err.code === "EPERM") console.warn("WARNING: '%s' cannot set gid to %s", name, JSON.stringify(config.gid));
                    else throw err;
                }
            }
            if (config.uid) {
                try {
                    process.setuid(config.uid);
                } catch (err) {
                    if (err.code === "EPERM") console.warn("WARNING: '%s' cannot set uid to %s", name, JSON.stringify(config.uid));
                    else throw err;
                }
            }
            callback();
        }
    }

    function checkDependencies(dependencies) {
        if (!dependencies) return true;
        for (var i = 0, l = dependencies.length; i < l; i++) {
            if (!serviceMap.hasOwnProperty(dependencies[i])) return false;
        }
        return true;
    }

    function startPlugin(options, callback) {
        if (!options.packagePath) return callback(new Error("packagePath paremeter is required!"));

        var packagePath = options.packagePath;
        console.log("options", options);
        if (packagePath[0] === ".") {
            packagePath = path.resolve(options.base, packagePath);
        }
        console.log("packagePath", packagePath);
        var manifest = require(path.join(packagePath, "package.json"));
        var pluginConfig = manifest.plugin || {};
        var moduleName = pluginConfig.main || manifest.main;
        var modulePath = require.resolve(path.resolve(options.base, moduleName));

        // Defer loading this plugin if it's dependencies aren't started yet
        if (!checkDependencies(pluginConfig.dependencies)) {
            pendingPlugins.push({
                options: options,
                manifest: manifest,
                callback: callback
            });
            return;
        }


        var startup = require(modulePath);
        var imports = {};
        pluginConfig.dependencies && pluginConfig.dependencies.forEach(function (dependency) {
            if (!serviceMap.hasOwnProperty(dependency)) {
                throw new Error(modulePath + " depends on '" + dependency + "'' but it's not loaded yet.");
            }
            if (services.hasOwnProperty(dependency)) {
                imports[dependency] = function localCall(methodName) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    return services[dependency][methodName].apply(null, args);
                };
            } else {
                imports[dependency] = function remoteCall(methodName) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    return makeRequest(dependency, methodName, args);
                }
            }
        });
        startup(options, imports, function (err, plugin) {
            pluginConfig.provides && pluginConfig.provides.forEach(function (name) {
                if (!(plugin && plugin.hasOwnProperty(name))) {
                    throw new Error(modulePath + " declares it provides '" + name + "' but didn't export it.");
                }
                if (services.hasOwnProperty(name)) {
                    throw new Error(modulePath + " attempted to override an already provided service " + name + ".");
                }
                services[name] = plugin[name];
                emit("mapService", [name, config.name]);
            });
            plugins[modulePath] = plugin;
        });


    }

    function handleRequest(serviceName, methodName, args) {
        services[serviceName][methodName].apply(null, args);
    }

    function makeRequest(serviceName, methodName, args) {
        connect(serviceMap[serviceName], function (err, remoteContainer) {
            if (err) throw err;
            remoteContainer.functions.handleRequest(serviceName, methodName, args);
        });
    }

}
