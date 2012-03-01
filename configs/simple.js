var path = require('path');
var base = path.resolve(__dirname , "..");
var staticDir = path.join(base, "www");

module.exports = {
    name: "Architect Demo Simple",
    containers: {
        master: {
            title: "architect-demo-simple",
            plugins: {
                "http": {
                    base: path.join(base, "./plugins/http"),
                    port: process.env.PORT || (process.getuid() ? 8080 : 80)
                },
                "static": {
                    base: path.join(base, "./plugins/static-file"),
                    root: staticDir
                },
                "calculator": {
                    base: path.join(base, "./plugins/calculator")
                },
                "db": {
                    base: path.join(base, "./plugins/db")
                },
                "auth": {
                    base: path.join(base, "./plugins/auth")
                }
            }
        }
    }
};
