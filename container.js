var EventEmitter = require('events').EventEmitter;
var net = require('net');
var dirname = require('path').dirname;
var Agent = require('architect-agent').Agent;
var socketTransport = require('architect-socket-transport');
var safeReturn = require('safereturn').safeReturn;

exports.createContainer = createContainer;
function createContainer(containerName, broadcast, callback) {
    callback = safeReturn(callback);
    var containerConfig; // Will be set by initialize()
    var serviceMap = {};
    var services = {};
    var pendingPlugins = [];
    var hub = new EventEmitter();

    // hub is a built-in service so that plugins can listen on the event hub.
    services.hub = {
        on: hub.on.bind(hub)
    };
    serviceMap.hub = true;

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
    function initialize(config, callback) {
        callback = safeReturn(callback);

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
                if (err) return callback(err);

                // Export the services the plugin provides
                options.provides && options.provides.forEach(function (name) {
                    if (!(provides && provides.hasOwnProperty(name))) {
                        return callback(new Error(options.packagePath + " declares it provides '" + name + "' but didn't export it."));
                    }
                    if (services.hasOwnProperty(name)) {
                        return callback(new Error(options.packagePath + " attempted to override an already provided service " + name + "."));
                    }
                    var functions = provides[name];
                    services[name] = functions;
                    listen(new Agent(functions), function (err, address) {
                        if (err) return callback(err);
                        broadcast("serviceReady", { name: name, address: address, functions: Object.keys(provides[name] || {}) });
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
            callback();
        }

    }

    function startPlugin(options, callback) {
        callback = safeReturn(callback);
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
                            if (err) return callback(err); // TODO: route properly
                            service[functionName].apply(self, args);
                        });
                    };
                });
            }
            imports[serviceName] = stub;
        });

        // Load the plugin
        var startup = options.startup || require(dirname(packagePath));
        var timeoutId = setTimeout(function() {
            callback(new Error("TIMEOUT: Plugin at '" + dirname(packagePath) + "' did not call 'register' within 5 seconds!"));
        }, 5000);
        function startupDone(err) {
            clearTimeout(timeoutId);
            // Long-running register (> 5 sec).
            if (typeof err === "function") {
                err(function() {
                    callback.apply(null, arguments);
                });
            } else {
                callback.apply(null, arguments);
            }
        }
        startup(options, imports, startupDone);
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
                else return callback(err);
            }
        }
        if (containerConfig.uid) {
            try {
                process.setuid(containerConfig.uid);
            } catch (err) {
                if (err.code === "EPERM") console.error("WARNING: '%s' cannot set uid to %s", containerName, JSON.stringify(containerConfig.uid));
                else return callback(err);
            }
        }
        broadcast("containerReady", containerName);
    }

    function getService(name) {
        if (!services[name]) {
            return callback(new Error("Service with name '" + name + "' not found in container '" + containerName + "'!"));
        }
        return services[name];
    }

    // This is the public interface that the master architect uses.
    callback(null, {
        onBroadcast: onBroadcast,
        initialize: initialize,
        getService: getService
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

