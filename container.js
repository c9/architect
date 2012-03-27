var EventEmitter = require('events').EventEmitter;
var net = require('net');
var dirname = require('path').dirname;
var Agent = require('architect-agent').Agent;
var socketTransport = require('architect-socket-transport');

exports.createContainer = createContainer;
function createContainer(containerName, broadcast, callback) {
    var containerConfig; // Will be set by initialize()
    var serviceMap = {};
    var services = {};
    var pendingPlugins = [];
    var hub = new EventEmitter();

    // hub is a built-in service so that plugins can listen on the event hub.
    services.hub = {
        on: hub.on.bind(hub)
    };

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


    // Route broadcast events to the local hub
    function onBroadcast(name, message) {
        hub.emit(name, message);
    }
    function initialize(config) {
        broadcast("containerStarting", containerName);
        containerConfig = config;

        if (config.title) {
            process.title = config.title;
        }

        if (!config.plugins) return initialized();

        var left = 1;
        containerConfig.plugins.forEach(function (options, index) {
            left++;
            startPlugin(options, function (err, provides) {
                if (err) throw err; // TODO: route this somewhere?

                // Export the services the plugin provides
                options.provides && options.provides.forEach(function (name) {
                    if (!(provides && provides.hasOwnProperty(name))) {
                        throw new Error(options.packagePath + " declares it provides '" + name + "' but didn't export it.");
                    }
                    if (services.hasOwnProperty(name)) {
                        throw new Error(options.packagePath + " attempted to override an already provided service " + name + ".");
                    }
                    var functions = provides[name];
                    services[name] = functions;
                    listen(new Agent(functions), function (err, address) {
                        if (err) throw err;
                        broadcast("serviceReady", { name: name, address: address, functions: Object.keys(provides[name]) });
                    });
                });


                broadcast("pluginStarted", options.packagePath);
                check();
            });
        });
        check();

        function check() {
            if (--left) return;
            initialized();
        }

    }

    function startPlugin(options, callback) {
        var packagePath = options.packagePath;

        // Defer the plugin if it's required services aren't started yet
        if (!checkDependencies(options.consumes)) {
            pendingPlugins.push({options:options,callback:callback});
            return;
        }

        // Prepare the imports if it consumes any services
        var imports = {};
        options.consumes && options.consumes.forEach(function (serviceName) {
            var serviceDescription = serviceMap[serviceName];
            var stub;
            if (services[serviceName]) {
                stub = services[serviceName];
            }
            else {
                stub = {};
                serviceDescription.functions.forEach(function (functionName) {
                    stub[functionName] = function stubFunction() {
                        var args = Array.prototype.slice.call(arguments);
                        var self = this;
                        connect(serviceName, function (err, service) {
                            if (err) throw err; // TODO: route properly
                            service[functionName].apply(self, args);
                        });
                    };
                });
            }
            imports[serviceName] = stub;
        });

        // Load the plugin
        var startup = options.startup || require(dirname(packagePath));
        startup(options, imports, callback);
    }

    var clientAgent = new Agent({});
    function connect(serviceName, callback) {
        // TODO: handle case where there are parallel initial connections to the same service.
        var address = serviceMap[serviceName].address;
        var client = net.connect(address.port, function () {
            clientAgent.attach(socketTransport(client), function (service) {
                services[serviceName] = service;
                callback(null, service);
            });
        });
    }

    function checkDependencies(dependencies) {
        if (!dependencies) return true;
        for (var i = 0, l = dependencies.length; i < l; i++) {
            if (!serviceMap.hasOwnProperty(dependencies[i])) return false;
        }
        return true;
    }


    // Set the uid and gid if in the config and then broadcast that this
    // container is done!
    function initialized() {
        if (containerConfig.gid) {
            try {
                process.setgid(containerConfig.gid);
            } catch (err) {
                if (err.code === "EPERM") console.error("WARNING: '%s' cannot set gid to %s", containerName, JSON.stringify(containerConfig.gid));
                else throw err;
            }
        }
        if (containerConfig.uid) {
            try {
                process.setuid(containerConfig.uid);
            } catch (err) {
                if (err.code === "EPERM") console.error("WARNING: '%s' cannot set uid to %s", containerName, JSON.stringify(containerConfig.uid));
                else throw err;
            }
        }
        broadcast("containerReady", containerName);
    }

    // This is the public interface that the master architect uses.
    callback(null, {
        onBroadcast: onBroadcast,
        initialize: initialize
    });

}

// Create a TCP server for an agent.  Returns the address in the callback.
function listen(agent, callback) {
    var server = net.createServer(function (socket) {
        agent.attach(socketTransport(socket), function (client) {

        });
    });
    server.listen(0, "127.0.0.1", function () {
        callback(null, server.address());
    });
}

