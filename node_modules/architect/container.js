/*

A container has:

 - services it provides
 - plugins it's running
 - a way to accept connections (unix socket)
 - a map of all containers and services
 - a router to route requests within itself or to other containers

The master process can contain a container too.  It works no different except
for bootstrapping.

*/

var net = require('net');
var path = require('path');
var protocol = require('remoteagent-protocol');

// Export listen for when the master process wants a container
exports.listen = listen;


// For the child_process spawn case, the code is self starting.
// SOCKET_PATH is the name of this container
if (process.env.SOCKET_PATH) {
  listen(process.env.SOCKET_PATH, function (err, functions) {
    if (err) throw err;
    // Tell our parent we're initialized.
    process.stdin.write("\0");
  });
}

function listen(socketPath, callback) {
  var serviceMap = {}; // For all services
  var services = {}; // local services provided by this container
  var plugins = {}; // plugins that live in this container
  var pendingPlugins = {}; // plugins that are waiting on their dependencies
  var connections = {};
  var emit; // function used to emit global messages
  var name; // name of this container
  var config;

  function nameToSocketPath(name) {
    return path.join(config.base, name + ".socket");
  }

  function connect(name, callback) {
    if (connections.hasOwnProperty(name)) return callback(null, connections[name]);
    var connection = connections[name] = {name:name};
    var client = net.connect(nameToSocketPath(name), function () {
      protocol.connectToClient(client, client, function (err, remote, functions) {
        if (err) return callback(err);
        connection.remote = remote;
        connection.functions = functions;
        callback(null, connection);
      });
    });
  }

  function mapService(serviceName, containerName) {
    serviceMap[serviceName] = containerName;

    // Since there is a new service available, we might be able to start some pending plugins.
    Object.keys(pendingPlugins).forEach(function (key) {
      var item = pendingPlugins[key];
      if (checkDependencies(item.manifest.dependencies)) {
        delete pendingPlugins[key];
        startPlugin(key, item.options, item.callback);
      }
    });
  }

  function configure(config_, emit_, callback) {
    config = config_;
    emit = emit_;
    name = config.name;
    config.title && (process.title = config.title);

    var left = 1;
    config.plugins && Object.keys(config.plugins).forEach(function (name) {
      left++;

      startPlugin(name, config.plugins[name], function (err, plugin) {
        if (err) return callback(err);
        plugins[name] = plugin;
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

  function startPlugin(name, options, callback) {
    var manifest = require(path.resolve(options.base, "package.json"));
    var pluginConfig = manifest.plugin || {};

    // Defer loading this plugin if it's dependencies aren't started yet
    if (!checkDependencies(pluginConfig.dependencies)) {
      pendingPlugins[name] = {
        options: options,
        manifest: manifest,
        callback: callback
      };
      return;
    }

    var moduleName = pluginConfig.main || manifest.main;
    var modulePath = require.resolve(path.resolve(options.base, moduleName));

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

  // Start accepting new connections on a local unix TCP socket
  var functions = {
    mapService: mapService,
    configure: configure,
    handleRequest: handleRequest
  };

  var server = net.createServer(function (socket) {
    protocol.startClient(socket, socket, functions);
  });

  server.listen(socketPath, function (err) {
    if (err) return callback(err);
    callback(null, functions);
  });

}
