module.exports = function setup(options, imports, register) {

    // Connect to the database
    var db = imports.database;

    register(null, {
        auth: {
            users: function (callback) {
                db.keys(callback);
            },
            authenticate: function (username, password, callback) {
                db.get(username, function (user) {
                    if (!(user && user.password === password)) {
                        return callback();
                    }
                    callback(user);
                });
            }
        }
    });
};
