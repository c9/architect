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
            title: "architect-demo-complex",
            plugins: {
                auth: { module: "./plugins/auth.js",
                    dependencies: ["database"],
                    provides: ["auth"],
                },
            }
        },
        www: {
            title: "architect-http-worker",
            // This process is run as whoever owns the www folder
            uid: staticStat.uid,
            gid: staticStat.gid,
            plugins: {
                http: { module: "./plugins/http.js",
                    provides: ["http"],
                    port: process.env.PORT || (process.getuid() ? 8080 : 80),
                },
                calculator: { module: "./plugins/calculator.js",
                    dependencies: ["http", "auth"],
                },
            },
        },
        static: {
            title: "architect-http-static-worker",
            uid: staticStat.uid,
            gid: staticStat.gid,
            plugins: {
                static: { module: "./plugins/static-file.js",
                    dependencies: ["http"],
                    root: staticDir,
                },
            }
        },
        db: {
            title: "architect-database-worker",
            uid: "nobody",
            plugins: {
                db: { module: "./plugins/db.js",
                    provides: ["database"],
                },
            }
        }
    },    
};    
