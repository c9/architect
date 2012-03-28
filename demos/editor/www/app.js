



var FileEntry = Backbone.Model.extend({});

var Directory = Backbone.Collection.extend({
  model: FileEntry,
  chdir: function (path) {
    server.readdir(path, function (err, filenames) {
      var data = filenames.map(function (name) {
        return {name:name};
      });
      console.log(data);
      listing.reset(data);
      view.render();
    });
  }
});

var FileListView = Backbone.View.extend({
  el: $("#filelist"),
  
  initialize: function () {
  },
  
  render: function() {
    _.each(this.model.models, function (item) {
      var m = new FileListItemView({model:item});
      this.$el.append(m.render().el);
    }, this);
    return this;
  }

});

var FileListItemView = Backbone.View.extend({

  render: function () {
    $(this.el).text(this.model.get("name"));
    return this;
  }
});

var listing = new Directory();

var view = new FileListView({model:listing});
view.render();


var server;
connect("ws://localhost:8080/", new (require('architect-agent').Agent), function (remote) {
  server = remote;
  listing.chdir("/home/tim");
  console.log("Server connected");
});

// Connect to the webserver over websocket and attach to agent as transport.
function connect(url, agent, callback) {
  var socket = new WebSocket(url, "architect-agent-protocol");
  var transport = {};
  transport.send = function (message) {
    socket.send(JSON.stringify(message));  
  };
  socket.onopen = function (evt) {
    agent.attach(transport, callback);
    socket.onmessage = function(evt) {
      var message = JSON.parse(evt.data);
      transport.onMessage(message);
    };
  }
}
