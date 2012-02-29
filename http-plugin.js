// Plugins can't use any closures and must only use what they are given.
// Also injected into this environment is "process", "require", and "log"
// from the local node process.
// See master.js for the functions on the master instance
module.exports = function startup(options, master, callback) {

	var http = require('http');
	var url = require('url');
	var stack = require('stack');
	var creationix = require('creationix');

	var done = false;

	var middlewares = [creationix.log(), routeHandler];
	if (options.staticFiles) {
		middlewares.push(creationix.static("/", options.staticFiles, "index.html"));
	}

	var routes = [];
	function routeHandler(req, res, next) {
		if (!req.uri) {
			req.uri = url.parse(req.url);
		}
		for (var i = 0, l = routes.length; i < l; i++) {
			var route = routes[i];
			if (req.method !== route.method) continue;
			var match = req.uri.pathname.match(route.regexp);
			if (!match) continue;
			var params = {};
			for (var j = 0, l2 = route.names.length; j < l2; j++) {
				params[route.names[j]] = match[j + 1];
			}
			handler(req, res, params, next);
			return;
		}
		next();
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

	var server = http.createServer(stack.apply(null, middlewares));
	server.listen(options.port, options.host || "0.0.0.0", function (err) {
		if (done) return;
		if (err) return error(err);
		console.log("http server listening on http://%s:%s/", options.host || "localhost", options.port);
		master.registerService("httpRoute", {
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
				// TODO: inject raw handler (for websockets or something)
				callback(new Error("Not Implemented"));
			}
		});
		done = true;
		callback();
	});

	function error(err) {
		if (done) return;
		done = true;
		callback(err);
	}


};
