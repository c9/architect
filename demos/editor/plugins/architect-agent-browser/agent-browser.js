var WebSocketServer = require('websocket').server;
var Agent = require('architect-agent').Agent
var embedder = require('embedder');

// This is a sample plugin that serves static files using a raw http route
module.exports = function startup(options, imports, register) {

  var agent = new Agent(options.methods);

  // Hook to implement server-side of agent transport over websocket
  var server = new WebSocketServer({
    httpServer: imports.http.server
  });
  server.on('request', function(request) {
    var connection = request.accept('architect-agent-protocol');
    var transport = {};
    transport.send = function (message) {
      connection.sendUTF(JSON.stringify(message));
    };
    agent.attach(transport, function (client) {
      // client.alert("Boo!");
    });
    connection.on('message', function(message) {
      transport.onMessage(JSON.parse(message.utf8Data));
    });
  });

  // Hook to serve agent code to browser
  imports.http.get("/require.js", function (req, res, next) {
    
    embedder({
      "architect-agent": require.resolve('architect-agent')
    }, function (err, code) {
      if (err) return next(err);
      res.writeHead(200, {
        "Content-Type": "application/javascript; charset=utf8",
        "Content-Length": Buffer.byteLength(code)
      });
      res.end(code);
    });

  }, register);

};

