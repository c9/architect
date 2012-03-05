module.exports = function setup(options, imports, register) {
    // A simple ram-based key-value database with some default values
    var database = {
        tim:       { password: "noderocks", allowed: ["subtract", "add"] },
        fabian:    { password: "acerocks",  allowed: ["multiply", "add"] },
        christoph: { password: "c9rocks",   allowed: ["multiply", "divide"] },
    };

    register(null, {
        database: {
            get: function (key, callback) {
                callback(database[key]);
            },
            put: function (key, value, callback) {
                database[key] = value;
                callback();
            },
            del: function (key, callback) {
                delete database[key];
                callback();
            },
            keys: function (callback) {
                callback(Object.keys(database));
            }
        }
    });
};