Node server plugin system
=========================

Everything is either a plugin or a library. Libaries are passive and provide functionality, which can be consumed by others. Plugins in contrast add functionality to the application. Plugins can add to the functionality of an application by adding services or by contributing to extension points defined by other plugins.

This plugin framework is inspired by the OSGI and Eclipse plugin systems. The core concepts are:

1. Live Cycle Management
2. Dependency Management
3. Services
4. Extension Points

Live Cycle Management
=====================

The plugin manager takes care of locating plugins on disc and of starting and
stopping them.

Dependency Management
=====================

Plugins have two kinds of dependencies:

1. Code dependencies
2. Runtime dependencies

Code dependencies basically define, which code the plugin references. In node.js this is usually done using npm in the package.json. This is also the approach taken here. OSGI does fancy shit to resolve code dependencies and to allow different versions of a libary be used at the same time by different plugins. With npm we get all that for free.

Runtime dependencies are more interesting. Here we want to interact with running instances of other plugins. This is done by using services.

Services
========

This is basically an implementation of a SOA in small:

- Plugins declare statically which services they provide
- Plugins declare statically which services they require

The loader will make sure that a service consumer is always initialized after the service provider.

Extension Points
================

Plugins can open themselves up to be extended by other plugins. To do this they have to declare the extension point in their `package.json`. Other plugins can hook into this extension point.

Services vs. Extension Points
=============================

Services and extension points are based on the same implementation. Both provide an implementation for a certain functionality referenced by an ID and other plugins can reference them. The main difference is the way both are used in a system:

<table>
    <tr>
        <th></th><th>Extension Point</th><th>Service</th>
    </tr>
    <tr>
        <td>Purpose</td>
        <td>Providing a way for other plugins to extend the plugin's functionality</td>
        <td>Providing a global service, which is available to any other plugin in the system</td>
    <tr>
    </tr>
        <td>Consumer</td>
        <td>The plugin defining the extension point is usually the only consumer</td>
        <td>A service has usually many consumers in the system</td>
    <tr>
    </tr>
        <td>Implementation</td>
        <td>Can have any number of implementations</td>
        <td>Usually just one implementation. (the first is picked)</td>
    </tr>
</table>


Plugin vs. Library
==================

Library = npm module (passive)
Plugin = add functionality to the app (active).

A plugin based application on disk
==================================

Imagine we want to create a plugin based chat application. How would you create one and how would that look on disk?

    /chat
      /config
        chat.js
      /node_modules
        /lego
        /lego.log
        /chat.main
        /chat.channels
      package.json
      server.js
      
First we need to define which plugins and which libraries to use. We use npm to manage and install those dependencies. All dependencies must be delared in the top level package.json. The config directory contains run configurations. A run configuration is the set of plugins, which are used to compose the application. In a ddition the run configuration can contain configuration data for each plugin.


Remote Plugins
==============

**these are just random ideas**

What it each plugin could run in its own procees?

- there should be a central repository of services
- every call would be async
- you cannot pass references (JSON only)
- you can simulate references with stubs (same for callbacks)
- we have to define interfaces

What would we gain?

- stability (exceptions only bring down the plugin)
- security
- scalability over multiple cores (potentially over multiple machines)
- we enforce separation and loose coupling

What would we lose?

- passing refernces
- simplicity

How would this work?

pluginContext.getService()
  - will query the registry (runs out of process)
  - the registry returns URI of the service (enough information to connect)
  - the local plugin manager asks the remote plugin manger to create the service
  - will return a stub object

  - will handle communication with the plugin
  - coordinated by the plugins manager

Each process has a plugin manager

Only one Service Registry


**Out of process of individual plugins**
**Live Cycle managed by one single plugin manager**

We will run individual plugins out of process. We will not have multiple plugin manager. Everthing is managed centrally. Not everything can be run out of process.


