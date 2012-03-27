var assert = require('assert');
var Agent = require('architect-agent').Agent;
var createContainer = require('./container').createContainer;

var queue = [];
var name = process.env.ARCHITECT_CONTAINER_NAME;
assert(name);

var socketTransport = require('architect-socket-transport');
var functions = {};
var agent = new Agent({
	onBroadcast: function () {
		if (functions.onBroadcast) return functions.onBroadcast.apply(this, arguments);
		queue.push(["onBroadcast", this, arguments]);
	},
	initialize: function () {
		if (functions.initialize) return functions.initialize.apply(this, arguments);
		queue.push(["initialize", this, arguments]);
	}
});
var transport = socketTransport(process.stdin);
agent.attach(transport, function (master) {
	createContainer(name, master.broadcast, function (err, container) {
		if (err) throw err;
		functions.onBroadcast = container.onBroadcast;
		functions.initialize = container.initialize;
		// Flush the call queue
		queue.forEach(function (item) {
			functions[item[0]].apply(item[1], item[2]);
		})
	});
});
process.stdin.resume();
