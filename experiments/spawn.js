/*
- spawn child process with generic loader + export basic API
- tell loader to load certain modules
- export services
*/

var spawn = require("child_process").spawn;
var net = require("net");
var Protocol = require('remoteagent-protocol');

function connect(callback) {
    var node = process.execPath;
    var loader = require.resolve("./child-process-loader.js");

    var options = {
        customFds: [-1, 1, 2],
        stdinStream: createPipe(true)
    };

    var child = spawn(node, [loader], options);
    //child.stderr.pipe(process.stderr);

    // Start our end of the protocol
    var socket = createSocket(options.stdinStream, true);
    Protocol.connectToClient(socket, socket, function (err, remote, imports) {
        if (err) return callback(err);
        callback(null, remote, imports);
    });
}

console.log("parent", process.pid);

connect(function(err, remote, imports) {
    console.log(err, remote, imports);

    imports.require("fs", function(err, fs) {
        fs.readdir(function(err, dir) {
            console.log(err, dir);
        })
    });
});

// ************************************************************************** //
// taken from the node.js sources lib/child_process.js                        //
// ************************************************************************** //

var Pipe;
function createPipe(ipc) {
    // Lazy load
    if (!Pipe) {
        Pipe = process.binding('pipe_wrap').Pipe;
    }

    return new Pipe(ipc);
}

function createSocket(pipe, readable) {
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