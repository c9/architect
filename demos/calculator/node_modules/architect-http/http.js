// This plugin gives the app a stack/connect like http server.  It has service
// functions for adding routes so that other plugins can register their own http
// routes. also, this can be the same plugin that does websocket I/O, or we can
// break that out into it's own plugin and simply provide a raw hook here.

// @options is the object in the config.js file for this plugin.
//   @options.port is the port to listen on.
//   @options.host is the host to bind to (defaults to "0.0.0.0")
//   @options.on404 is for a custom 404 handler
//   @options.on500 is for a custom 500 handler
// @imports is the various services that this plugin declared as dependencies
//   This plugin doesn't have any
// @register is a callback function expecting (err, plugin) where plugin is the
// provided services and lifecycle hooks.  This plugin exports "http".
module.exports = function startup(options, imports, register) {

    // load node modules required by this plugin
    var http = require('http');
    var url = require('url');

    // Process options and default values
    var port = options.port;
    var host = options.host || "0.0.0.0";
    var on404 = options.on404 || function (req, res) {
        res.writeHead(404);
        res.end("Not Found\n");
    };
    var on500 = options.on500 || function (req, res, err) {
        res.writeHead(500);
        res.end(err.stack);
    };

    var routes = [];
    var server = http.createServer(function (req, res) {
        var index = 0;
        // Kick off the recursive middleware walker
        handle();

        function handle() {
            // Grab the next route in the list
            var route = routes[index++];
            // If there are no more handlers, send the browser a 404
            if (!route) return on404(req, res);

            // If this route is a raw route, then let it do it's thing.
            if (route.raw) {
                return route.raw(req, res, next);
            }

            // Otherwise start to filter based on method and pathname
            if (req.method !== route.method) return handle();
            // Lazy calculate req.uri the first time it's needed.
            if (!req.uri) req.uri = url.parse(req.url);
            // See if the pathname matches the route
            var match = req.uri.pathname.match(route.regexp);
            if (!match) return handle();

            // Match the regexp matches with the named captures in the original route
            var params = req.params = {};
            for (var j = 0, l2 = route.names.length; j < l2; j++) {
                params[route.names[j]] = match[j + 1];
            }

            // Scrub req and res objects if the handler is a proxy function
            if (route.handler.isProxy) {
                throw new Error("TODO: Implement me");
            }

            route.handler(req, res, next);
        }

        // Recursivly go to the next handler unless there was an error.
        function next(err) {
            if (err) return on500(req, res, err);
            handle();
        }
    });

    var api = {
        get: function (route, handler, callback) {
            addRoute("GET", route, handler, callback);
        },
        put: function (route, handler, callback) {
            addRoute("PUT", route, handler, callback);
        },
        post: function (route, handler, callback) {
            addRoute("POST", route, handler, callback);
        },
        del: function (route, handler, callback) {
            addRoute("DELETE", route, handler, callback);
        },
        raw: function (handler, callback) {
            routes.push({raw:handler});
            callback();
        },
        addRoutes: function (routes, callback) {
            var left = 1;
            routes.forEach(function (args) {
                var name = args.shift();
                args.push(check);
                api[name].apply(null, args);
            });
            check();
            function check() {
                if (!--left) callback();
            }
        },
        server: server
    }

    function addRoute(method, pattern, handler, callback) {
        var names = [];
        var compiled = "^" + pattern.replace(/:[a-z$_][a-z0-9$_]*.?/gi, function (match) {
            if ((/[^a-z$_0-9]$/i).test(match)) {
                var end = match.substr(match.length - 1);
                names.push(match.substr(1, match.length - 2));
                return "([^" + end + "]+)" + end;
            }
            names.push(match.substr(1));
            return "(.*)";
        }) + "$";
        var regexp = new RegExp(compiled);
        routes.push({
            method: method,
            regexp: regexp,
            names: names,
            handler: handler
        });
        callback();
    }

    server.listen(port, host, function (err) {
        if (err) return register(err);
        console.log("HTTP server listening on http://%s%s/", options.host || "localhost", port === 80 ? "" : ":" + port);
        register(null, {
            // When a plugin is unloaded, it's onDestruct function will be called if there is one.
            onDestruct: function (callback) {
                server.close(callback);
            },
            http: api
        });
    });
};
