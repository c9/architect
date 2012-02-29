var master = {
	registerService: function (namespace, functions) {
		// Here namespace is the service's uri and functions is the object that comsumers get when they want to use this service.
	},
	requestService: function (namespace, callback) {
		// Request the service from another plugin.  Callback will be `function(err, functions){...}`
	},
	registerDestructor: function (callback) {
		// This callback will be called when the lifecycle management wants to clean up this plugin
		// callback will be of the form `function(done){}` where the nested callback `done` is the plugin saying it's ready to die.
	}
}