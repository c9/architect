var path = require('path');
var fs = require('fs');
var base = path.resolve(__dirname , "..");
var staticDir = path.join(base, "www");
var staticStat = fs.statSync(staticDir);

module.exports = {
    name: "Architect Demo",
    tmpdir: path.join(base, ".architect"),
    containers: {
        master: {
            title: "architect-demo",
        },
        www: {
            title: "architect-http-worker",
            // This process is run as whoever owns the www folder
            uid: staticStat.uid,
            gid: staticStat.gid,
            plugins: [
                { packagePath: "architect-http",
                  port: process.env.PORT || (process.getuid() ? 8080 : 80) },
                { packagePath: "architect-http-static",
                  root: staticDir },
                { packagePath: "../plugins/calculator" }
            ]
        },
        db: {
            title: "architect-database-worker",
            uid: staticStat.uid,
            gid: staticStat.gid,
            plugins: [
                { packagePath: "../plugins/db",
                  aliasProvides: { db: "memorydb" } },
                { packagePath: "../plugins/auth",
                  aliasConsumes: { db: "memorydb" } }
            ]
        }
    }
};
