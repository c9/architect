module.exports = function setup(options, imports, register) {
    var stack = require('stack');
    var http = imports.http;
    var auth = imports.auth;

    var ops = {
        add: function (a,b) { return a + b; },
        subtract: function (a, b) { return a - b; },
        multiply: function (a, b) { return a * b; },
        divide: function (a, b) { return a / b; },
    }

    var handler = stack.compose(
        basicAuth(function (req, username, password, callback) {
            // Defer to the auth plugin for actual authentation
            auth.authenticate(username, password, function (user) {
                if (!user) return callback();
                // Also check if the operation is allowed for this user
                if (user.allowed.indexOf(req.params.operation) < 0) return callback();
                callback(user);
            });
        }),
        function (req, res, next) {
            var params = req.params;
            if (!ops.hasOwnProperty(params.operation)) return next();
            var result = ops[params.operation](Number(params.first), Number(params.second));
            res.end(result + "\n");
        }
    )

    http.get("/:operation/:first/:second", handler, register);

    // Based loosly on basicAuth from Connect
    // Checker takes username and password and returns a user if valid
    // Will force redirect if requested over HTTP instead of HTTPS
    function basicAuth(checker, realm) {

        realm = realm || 'Authorization Required';
        
        function unauthorized(res) {
            res.writeHead(401, {
                'WWW-Authenticate': 'Basic realm="' + realm + '"',
                'Content-Length': 13
            });
            res.end("Unauthorized\n");
        }

        function badRequest(res) {  
            res.writeHead(400, {
                "Content-Length": 12
            });
            res.end('Bad Request\n');
        }

        return function(req, res, next) {
            var authorization = req.headers.authorization;
            if (!authorization) return unauthorized(res);
            var parts = authorization.split(' ');
            var scheme = parts[0];
            var credentials = new Buffer(parts[1], 'base64').toString().split(':');
            if ('Basic' != scheme) return badRequest(res);
            checker(req, credentials[0], credentials[1], function (user) {
                if (!user) return unauthorized(res);
                req.remoteUser = user;
                next();
            });
        }
    };


};

