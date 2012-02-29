var staticDir = __dirname + "/../www";
var staticStat = require('fs').statSync(staticDir);

module.exports = {
	name: "Architect Demo",
	title: "architect-demo",
	containers: {
		db: {
			ssh: { host: "creationix.com" },
			title: "architect-database-worker",
			uid: "nobody",
			gid: "nobody"
		},
		www: {
			title: "architect-http-worker",
			// This process is run as whoever owns the www folder
			uid: staticStat.uid,
			gid: staticStat.gid
		},
	},	
	plugins: [
		{	module: "../plugins/db.js",
			provides: ["database"],
			container: "db",
		},
		{	module: "../plugins/auth.js",
			dependencies: ["database"],
			provides: ["auth"],
		},
		{	module: "../plugins/http.js",
			provides: ["http"],
			port: process.env.PORT || 8080,
			container: "www",
		},
		{	module: "../plugins/static-file.js",
			dependencies: ["http"],
			root: staticDir,
			container: "www",
		},
		{	module: "../plugins/calculator.js",
			dependencies: ["http", "auth"],
			container: "www",
		},
	]
};	
