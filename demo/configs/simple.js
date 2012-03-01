var path = require('path');
var base = path.resolve(__dirname , "..");
var staticDir = path.join(base, "www");

module.exports = {
    name: "Architect Demo Simple",
    containers: {
        master: {
            title: "architect-demo-simple",
            plugins: [
                { packagePath: "architect-http",
                  port: process.env.PORT || (process.getuid() ? 8080 : 80) },
                { packagePath: "architect-http-static",
                  root: staticDir },
                { packagePath: "../plugins/calculator" },
                { packagePath: "../plugins/db" },
                { packagePath: "../plugins/auth" }
            ]
        }
    }
};
