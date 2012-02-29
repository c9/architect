module.exports = {
	name: "Cloud9 Free Version",
    plugins: {
    	httpServer: {
    		module: "./http-plugin.js",
    		port: process.env.PORT || 8080,
    		staticFiles: __dirname + "/www"
        },

        // "architect-demo.hello": {
        //     "base": __dirname + "/../plugins/architect-demo.hello"
        // },
        // "architect-demo.log": {
        //     "base": "architect/plugins/architect.log",
        //     "out-of-process": true
        // }
    }
};	
