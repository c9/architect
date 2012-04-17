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

Every plugin needs a package.json to declare it's plugin properties.  This can be the same package.json you use for npm if this plugin is to be published on npm.

```json
{
    "name": "http-server",
    "version": "0.0.1",
    "main": "http.js",
    "private": true,

    "plugin": {
        "provides": ["http"]
    }
}
```

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

The json file would look like:

```json
{
    "name": "index-page",
    "version": "0.0.1",
    "main": "index.js",
    "private": true,

    "plugin": {
        "consumes": ["http"]
    }
}
```

This lets architect know that when the `index-page` plugin is loaded, it first needs to start the plugin that provides the http service.

If you're worried about service names conflicting, there is a feature where you can alias the service names in the app config.

## Plugin Config

Ok, now you're asking how architect knew to load the http plugin first so that the index plugin could use it right?  Well the core of an architect app is the config file.  Actually an app is nothing more than a set of plugins and one or more plugin config files.  The plugin config file specifies what plugins to use and what options to send them.

Going with our previous example, let's create a simple config that only has one process and two plugins, `http-server` and `index-page`.

The config file can be JSON or JS (or even coffeescript if you have it), it will be loaded by node's `require`, so same rules as that.

```js
module.exports = {
    containers: {
        master: {
            plugins: [
                { packagePath: "./plugins/http-server", port: 8080 },
                "./plugins/index-page"
            ]
        }
    }
};
```

If the plugin has any config options, put the require path to the plugin as packagePath and other properties to be sent to the plugin.  For the `index-page` plugin we don't have any parameters so we can just use the string shortcut.

Note that these paths are relative to the config file as if the config file did the require.  This follows normal node require paths otherwise.  You can install plugins via npm, put them manually in a `node_modules` folder, or use relative paths like I did here.

## The App

Now that we have two plugins and a plugin config we can create a real app using the architect system.  Assuming you installed architect with npm, the following could work:

```js
var architect = require("architect");

architect.createApp("simple-config.js", function (err, app) {
    if (err) throw err;
    console.log("Started the App!");
});
```

Our tree would look like:

```
.
├── app.js
├── plugins
│   ├── http-server
│   │   ├── http.js
│   │   └── package.json
│   └── index-page
│       ├── index.js
│       └── package.json
└── simple-config.js
```

And we would start the server with:

```bash
node app.js
```

## More Examples

Clearly you would never use this system for such a simple application.  For a slightly more advanced example, see the [everything][] example in the demos folder.  It contains two configs [default][] and [simple][].  One simple that puts everything in the same process, and a more advanced one that shards the plugins manually across several processes.  The plugins work the same on both!

[everything]: https://github.com/c9/architect/tree/master/demos/everything
[default]: https://github.com/c9/architect/blob/master/demos/everything/configs/default.js
[simple]: https://github.com/c9/architect/blob/master/demos/everything/configs/simple.js
