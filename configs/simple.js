var path = require('path');
var base = path.resolve(__dirname , "..");
var staticDir = path.join(base, "www");

module.exports = {
  name: "Architect Demo Simple",
  base: base,
  containers: {
    master: {
      title: "architect-demo-simple",
      plugins: {
        http: { module: "./plugins/http.js",
          provides: ["http"],
          port: process.env.PORT || (process.getuid() ? 8080 : 80),
        },
        static: { module: "./plugins/static-file.js",
          dependencies: ["http"],
          root: staticDir,
        },
        calculator: { module: "./plugins/calculator.js",
          dependencies: ["http", "auth"],
        },
        db: { module: "./plugins/db.js",
          provides: ["database"],
        },
        auth: { module: "./plugins/auth.js",
          dependencies: ["database"],
          provides: ["auth"],
        },
      }
    }
  },  
};  
