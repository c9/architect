var path = require('path');
var fs = require('fs');
var base = path.resolve(__dirname , "..");
var staticDir = path.join(base, "www");
var staticStat = fs.statSync(staticDir);

module.exports = {
    name: "Architect Demo",
    base: base,
    containers: {
        master: {
            title: "architect-demo"
        },
        www: {
            title: "architect-http-worker",
            // This process is run as whoever owns the www folder
            uid: staticStat.uid,
            gid: staticStat.gid,
            plugins: {
                "http": {
                    base: "./plugins/http",
                    port: process.env.PORT || (process.getuid() ? 8080 : 80)
                },
                "static": {
                    base: "./plugins/static-file",
                    root: staticDir
                },
                "calculator": {
                    base: "./plugins/calculator"
                }
            }
        },
        db: {
            title: "architect-database-worker",
            uid: "nobody",
            plugins: {
                "db": {
                    base: "./plugins/db"
                },
                "auth": {
                    base: "./plugins/auth"
                }
            }
        }
    }
};
