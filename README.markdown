# Architect Containers Edition

While working on modifying architect to work with async bound APIs and
multiple processes, I got overwhelmed and wrote this framework from scratch.
It borrowed many ideas from the original architect framework.  The main new
idea is called "Containers".

## Running the sample.

Running is simple, just `npm install` and `node server.js`.  Optionally
specify a config profile like `node server.js simple`.

## What is a Container?

A container is a process that contains plugins.  This means that the system is
no longer plugin oriented as the only unit to move things around with internal
and external being the only options regarding processes.  Now you can define a
family of container processes (including the master process itself if desired)
and put plugins wherever they make sense.  To help explain this, here is a
simple config file using multiple containers:

```js
module.exports = {
  containers: {
    master: {
      title: "architect-demo",
      plugins: {
        auth: {
          dependencies: ["database"],
          provides: ["auth"]
        }
      }
    },
    www: {
      title: "architect-http-worker",
      uid: "www",
      plugins: {
        http: {
          provides: ["http"],
          port: 80
        },
        static: {
          dependencies: ["http"],
          root: "www"
        },
        calculator: {
          dependencies: ["http", "auth"],
        },
      },
    },
    db: {
      title: "architect-database-worker",
      uid: "nobody",
      plugins: {
        db: {
          provides: ["database"]
        }
      }
    }
  }
}
```

Small details were removed to improve readability.  In this config, there are
three containers named "master", "www", and "db".  These names are only used
internally and only need to be unique within this config.  The "master" name
is special in that it doesn't spawn a child process, but is the master process
itself with a container instance in it.  When this server is run, there will
be one main process titled "architect-demo", and two direct children to it
titled "architect-http-worker", and "architect-database-worker".  If the
server is launched as root, then the http plugin will be listening on port 80
and running at the "www" user while the in-memory database is running as
"nobody".

The system automatically makes persistent peer-to-peer connections between the
processes when a plugin in one process needs to query a service in another
process.  This way the hub doesn't become a bottleneck.  Also it's possible to
have proxy containers that are actually on different machines over ssh.  I
didn't implement this in this proof-of-concept, but it can be added if needed.

## What is a Plugin?

A plugin is a module that adds functionality to the app.  Plugins can provide
services and consume services.  It's up to the services to decide on their
integration points.  For example, the "http" service provides interfaces to
add custom routes into the http request handling by any other plugin.  The
calculator plugin is a sample webservice with http routes and http basic auth.
It shows how to register routes.

## What about declaring dependencies

Dependency management it outside the scope of this module.  Plugins are found
using normal node require rules with a couple extensions.  The plugin key is
used as the name if a module property isn't given in the module.  If the
module or plugin key is relative, then it's resolved relative to the config
base (which is cwd if not given).

Since architect doesn't care if you use npm or not, it's easy to embed small
one-off plugins mixed with npm modules.  With the custom module path property,
they don't even have to be in the node_modules folder.

I