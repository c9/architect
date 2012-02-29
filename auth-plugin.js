// Plugins can't use any closures and must only use what they are given.
// Also injected into this environment is "process", "require", and "log"
// from the local node process.
// See master.js for the functions on the master instance
module.exports = function startup(options, master) {

	// Here connect to a database or whatever is needed
	// and other setup code.
	// options is plugin specific for any setup paremeters
	var db;
	master.requestService('database', function (err, functions) {
		db = functions;

		master.registerDestructor(function (done) {
			// Clean up any resources.  the `done` callback has one optional err
			// argument. It should be called regardless, but sometimes it's nice
			// to report errors. Destruction can't be canceled.
		});

		// Since we don't register our service till after we have our
		// dependencies, then the main system doesn't have to manage this for us.
		master.registerService("authentication", {
			isUser: isUser,
			auth: auth,
			// and other functions
		});

	});


	function isUser(username, callback) {
		// Tell is username is a user
	}

	function auth(username, password, callback) {
		// authenticate a user
	}
};

// Plugins are unit testable using a mock master object (or the real one, but with different clients)

