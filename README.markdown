# Architect

Architect is a simple plugin system useful for writing large node.js applications.

Some key features are:

 - An application is nothing more than a set of plugin configurations.  This provides config portability. (sharing development environment between developers)
 - Declarative process configuration complete with uid/gid and process title.
 - Process containers contain plugins.
 - Plugins can provide named services.
 - Plugins can consume named services.
 - If the plugin consuming a service is not in the same process as the plugin providing the service an advanced IPC is used transparently.
 - Callbacks and streams can be serialized across this IPC channel.

With this system, plugin authors can focus on doing one thing and doing it well.  The sysadmin can focus on the architecture of the system through the app config.  And Architect will handle connecting everything together automatically.

## Plugins

The best way to explain plugins is to provide an example.  We'll start out with a simple HTTP plugin that provides an `http` service.  It will have a service API that can be used to register HTTP route handlers.

```js
var http = require('http');

// This is the standard plugin interface signature
module.exports = function startup(options, imports, register) {

    var port = options.port || 8080;
    var host = options.host || "0.0.0.0";

    // Store our internal route table.
    var routes = {};

	// A very minimal request router
    function onRequest(req, res) {
    	if (routes.hasOwnProperty(req.url)) {
    		return routes[req.url](req, res);
    	}
    	res.statusCode = 404;
    	res.end();
    }

    // Start the http server.
    http.createServer(onRequest).listen(port, host, onListening);

    function onListening() {
    	// Register our service and tell architect this plugin is ready
    	register(null, {
    		// Other plugins can use the the http.setRoute service
    		http: {
    			setRoute: function (url, handler, callback) {
	    			routes[url] = handler;
	    			callback();
	    		}
	    	}
    	});
    }
};
```

Notice that we didn't use the `imports` parameter.  That's for plugins that consume services.  

Notice that the API function `setRoute` has a callback at the end.  This is so that the plugin consuming this API can know that setRoute finished.  Remember that the client isn't always in the same process so these calls can be async.

Now we'll write a simple plugin that registers a route.

```js
var fs = require('fs');

module.exports = function startup(options, imports, register) {

	// This is a simple http handler that serves the static file.
	function onIndex(req, res) {
		var data = fs.createReadStream("index.html");
		res.writeHead(200, {
			"Content-Type": "text/html"
		});
		data.pipe(res);
	}

	// Register the route using the http service.
	imports.http.setRoute("/", onIndex, register);

};
```

Here we used the `imports` parameter to get at the `http` service provided by the first plugin.  All plugins need to call `register` when they are done even if they don't provide any services.  Here we simply chained the callback from `setRoute`.  Once the route is setup we're done!