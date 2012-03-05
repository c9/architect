module.exports = {
    containers: {
        master: {
            plugins: [
                { packagePath: "architect-http",
                  port: 8080 },
                { packagePath: "architect-http-static",
                  root: "www" },
                { packagePath: "../plugins/calculator" },
                { packagePath: "../plugins/db" },
                { packagePath: "../plugins/auth" }
            ]
        }
    }
};
