var net = require('net');
var path = require('path');
var protocol = require('remoteagent-protocol');
var EventEmitter = require('events').EventEmitter;

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
    var pendingPlugins = []; // plugins that are waiting on their dependencies
    var broadcast = config.broadcast; // A function for broadcasting events
    var connections = {};

    if (config.title) {
        process.title = config.title;
    }

    var hub = new EventEmitter();

    var container = {
        pid: process.pid,
        name: config.name,
        handleBroadcast: handleBroadcast,
        handleRequest: handleRequest,
        loadPlugins: loadPlugins
    }

    // Listen on a unix socket if requested by the architect
    if (config.socketPath) {
        container.socketPath = config.socketPath;
        net.createServer(function (socket) {
            protocol.startClient(socket, socket, container);
        }).listen(container.socketPath, callback);
    }

    hub.on('serviceReady', function (message) {
        serviceMap[message.name] = message;
        var i = pendingPlugins.length;
        while (i--) {
            var item = pendingPlugins[i];
            if (checkDependencies(item.options.consumes)) {
                pendingPlugins.splice(i, 1);
                startPlugin(item.options, item.callback);
            }
        }
    });

    // Send back our container as fast as possible.
    return callback(null, container);

    function handleBroadcast(name, message) {
        hub.emit(name, message);
    }

    function handleRequest(serviceName, functionName, args) {
        services[serviceName][functionName].apply(null, args);
    }

    function makeRequest(socketPath, serviceName, functionName, args) {
        connect(socketPath, function (err, container) {
            if (err) throw err; // TODO: route properly
            container.handleRequest(serviceName, functionName, args);
        });
    }

    function loadPlugins() {
        if (!config.plugins) return done();

        var left = 1;
        config.plugins.forEach(function (options, index) {
            left++;
            startPlugin(options, function (err, provides) {
                if (err) throw err; // TODO: route this somewhere?

                options.provides && options.provides.forEach(function (name) {
                    if (!(provides && provides.hasOwnProperty(name))) {
                        throw new Error(options.packagePath + " declares it provides '" + name + "' but didn't export it.");
                    }
                    if (services.hasOwnProperty(name)) {
                        throw new Error(options.packagePath + " attempted to override an already provided service " + name + ".");
                    }
                    var functions = provides[name];
                    broadcast("serviceReady", {
                        container: container.name,
                        socket: container.socketPath,
                        name: name,
                        functions: Object.keys(functions)
                    });

                    services[name] = functions;
                });
                broadcast("pluginStarted", options.packagePath);
                check();
            });
        });
        check();

        function check() {
            if (--left) return;
            done();
        }

        function done() {
            if (config.gid) {
                try {
                    process.setgid(config.gid);
                } catch (err) {
                    if (err.code === "EPERM") console.error("WARNING: '%s' cannot set gid to %s", container.name, JSON.stringify(config.gid));
                    else throw err;
                }
            }
            if (config.uid) {
                try {
                    process.setuid(config.uid);
                } catch (err) {
                    if (err.code === "EPERM") console.error("WARNING: '%s' cannot set uid to %s", container.name, JSON.stringify(config.uid));
                    else throw err;
                }
            }
            broadcast("containerReady", { container: container.name });
        }
    }

    function startPlugin(options, callback) {
        var packagePath = options.packagePath;

        // Look up the provides and consumes in the package.json
        var pluginConfig = require(packagePath).plugin;
        for (var key in pluginConfig) {
            if (!options.hasOwnProperty(key)) options[key] = pluginConfig[key];
        }

        // Defer the plugin if it's required services aren't started yet
        if (!checkDependencies(options.consumes)) {
            pendingPlugins.push({options:options,callback:callback});
            return;
        }

        // Prepare the imports if it consumes any services
        var imports = {};
        options.consumes && options.consumes.forEach(function (serviceName) {
            var serviceDescription = serviceMap[serviceName];
            var socketPath = serviceDescription.socket;
            var stub;
            if (serviceDescription.container === container.name) {
                stub = services[serviceName];
            }
            else {
                stub = {};
                serviceDescription.functions.forEach(function (functionName) {
                    stub[functionName] = function stubFunction() {
                        var args = Array.prototype.slice.call(arguments);
                        makeRequest(socketPath, serviceName, functionName, Array.prototype.slice.call(arguments));
                    }
                });
            }
            imports[serviceName] = stub;
        });

        // Load the plugin
        var startup = require(path.dirname(packagePath));
        startup(options, imports, callback);
    }

    function checkDependencies(dependencies) {
        if (!dependencies) return true;
        for (var i = 0, l = dependencies.length; i < l; i++) {
            if (!serviceMap.hasOwnProperty(dependencies[i])) return false;
        }
        return true;
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


}

