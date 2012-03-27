module.exports = {
    containers: {
        master: {
            plugins: [
                { packagePath: "../plugins/architect-http",
                  port: 8080 },
                { packagePath: "../plugins/architect-http-static",
                  root: "www" },
                { packagePath: "../plugins/architect-agent-browser",
                  methods: require('fs') },
            ]
        }
    }
};
