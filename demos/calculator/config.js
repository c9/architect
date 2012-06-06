module.exports = [
  { packagePath: "architect-http", port: 8080 },
  { packagePath: "architect-http-static", root: "www" },
  "./plugins/calculator",
  "./plugins/db",
  "./plugins/auth"
]
