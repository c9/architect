var staticDir = __dirname + "/www";
var staticStat = require('fs').statSync(staticDir);

module.exports = {
	name: "Cloud9 Free Version",
	title: "c9-free-version",
	containers: {
		db: {
			ssh: { host: "creationix.com" },
			title: "c9-database-worker",
			uid: "nobody",
			gid: "nobody"
		},
		www: {
			title: "c9-http-worker",
			// This process is run as whoever owns the www folder
			uid: staticStat.uid,
			gid: staticStat.gid
		},
	},	
	plugins: [
		{	module: "./http-plugin.js",
			provides: ["http"],
			port: process.env.PORT || 8080,
			container: "www",
		},
		// {	module: "./static-file-plugin.js",
		// 	dependencies: ["http"],
		// 	root: staticDir,
		// 	container: "www",
		// },
		// {	module: "./calculator-plugin.js",
		// 	dependencies: ["http", "auth"],
		// 	container: "www",
		// },
		// {	module: "./auth-plugin.js",
		// 	dependencies: ["database"],
		// 	container: ["auth"],
		// },
		// {	module: "./db-plugin.js",
		// 	provides: ["database"],
		// 	container: "db",
		// }
	]
};	
