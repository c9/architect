var path = require('path');
var net = require('net');
var protocol = require('remoteagent-protocol');

exports.createApp = createApp;

exports.startClient = function (input, output, functions) {
    var remote = new protocol.Remote(input, output, 1);
    // Hook up remote-functions and tell the server we're ready.
    remote.emitRemote("init", functions);
    return remote;
};

exports.connectToClient = function (input, output, callback) {
    var remote = new protocol.Remote(input, output, 0);

    // Wait for connect from far end and then call callback
    remote.on('error', callback);
    remote.once('init', function (functions) {
        remote.removeListener('error', callback);
        callback(null, remote, functions);
    });
};


function createApp(config, callback) {

    var containers = {};
    var connections = {};
    var base = config.base || process.cwd();

    function nameToSocketPath(name) {
        return path.join(base, name + ".socket");
    }

    // A generic emitter for any container to emit globally
    function emit(name, args) {
        Object.keys(containers).forEach(function (key) {
            containers[key].functions[name].apply(null, args);
        });
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

    function spawnLocalContainer(name, callback) {
        var connection = connections[name] = {name:name};
        require('./container').listen(nameToSocketPath(name), function (err, functions) {
            if (err) return callback(err);
            connection.functions = functions;
            callback(null, connection);
        });
    }

    function spawnChildContainer(name, callback) {
        var spawn = require('child_process').spawn;
        var node = process.execPath;
        var loader = require.resolve("./container.js");

        var options = {
            customFds: [-1, 1, 2],
            env: { SOCKET_PATH: nameToSocketPath(name) },
            stdinStream: createPipe(true)
        };

        var child = spawn(node, [loader], options);

        // The child sends us a null byte when it's ready to be connected to over TCP.
        child.stdin.resume();
        child.stdin.once('data', function (chunk) {
            connect(name, callback);
        });

        // TODO: Monitor child for life
    }

    var left = 1;
    Object.keys(config.containers).forEach(function (name) {
        left++;
        var containerConfig = config.containers[name];
        var spawnContainer = name === "master" ? spawnLocalContainer : spawnChildContainer;
        containerConfig.name = name;

        spawnContainer(name, function (err, container) {
            if (err) throw err;
            containers[name] = container;

            // TODO: find a way to share functions between multiple clients so that
            // "check" can be used directly here and not a bound copy. The function
            // tagging used by the protocol assumes that a function is unique to a
            // single channel.
            container.functions.configure(containerConfig, emit.bind(null), check.bind(null));
        });
    });
    check();

    function check() {
        if (!--left) {
            callback(null, containers);
        }
    }

}

// ************************************************************************** //
// taken from the node.js sources lib/child_process.js                                                //
// ************************************************************************** //

var Pipe;
function createPipe(ipc) {
        // Lazy load
        if (!Pipe) {
                Pipe = process.binding('pipe_wrap').Pipe;
        }

        return new Pipe(ipc);
}

var net;
function createSocket(pipe, readable) {
    if (!net) net = require('net');
        var s = new net.Socket({ handle: pipe });

        if (readable) {
                s.writable = false;
                s.readable = true;
                s.resume();
        } else {
                s.writable = true;
                s.readable = false;
        }

        return s;
}
