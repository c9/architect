var protocol = require("remoteagent-protocol");

console.error("Hello", process.pid);

var client = protocol.startClient(process.stdin, process.stdin, {
    require: function(module, callback) {
        callback(null, require(module));
    }
});

process.stdin.resume();

//setInterval(function() {}, 60000);