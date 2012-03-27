var Agent = require('architect-agent').Agent;

$(function () {

  // Create a local agent
  var agent = new Agent({
    alert: alert.bind(null)
  });
  
  connect("ws://localhost:8080/", agent, function (server) {
    console.log("Server", server);
    server.readFile("/etc/passwd", "utf8", function (err, result) {
      $("#editor").text(result);
    });
  });

});

// Connect to the webserver over websocket and attach to agent as transport.
function connect(url, agent, callback) {
  var socket = new WebSocket(url, "architect-agent-protocol");
  var transport = {};
  transport.send = function (message) {
    socket.send(JSON.stringify(message));  
  };
  socket.onopen = function (evt) {
    agent.attach(transport, callback);
    socket.onmessage = function(evt) {
      var message = JSON.parse(evt.data);
      transport.onMessage(message);
    };
  }
}
