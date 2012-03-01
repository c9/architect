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
      title: "architect-demo",
    },
    www: {
      title: "architect-http-worker",
      // This process is run as whoever owns the www folder
      uid: staticStat.uid,
      gid: staticStat.gid,
      plugins: [
        { module: "plugins/http.js",
          provides: ["http"],
          port: process.env.PORT || 80,
        },
        { module: "plugins/static-file.js",
          dependencies: ["http"],
          root: staticDir,
        },
        { module: "plugins/calculator.js",
          dependencies: ["http", "auth"],
        },
      ],
    },
    db: {
      title: "architect-database-worker",
      uid: "nobody",
      plugins: [
        { module: "plugins/db.js",
          provides: ["database"],
        },
        { module: "plugins/auth.js",
          dependencies: ["database"],
          provides: ["auth"],
        },
      ]
    }
  },  
};  
