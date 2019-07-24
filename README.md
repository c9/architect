# Archetype

Archetype is a structure for extendable Node.js applications written in
Typescript. Using Archetype, you set up a simple configuration and tell
Archetype which extensions you want to load. Each extension registers
itself with Archetype, so other extensions can use the services it
provides. Extensions can be maintained as NPM packages so they can be
dropped into other Archetype apps.

Archetype is a Typescript implementation of
[Architect](https://github.com/c9/architect).

## Install

```bash
npm install archetype-ts
```

## Extension Interface

```typescript
import { ArchetypeExtension, ExtensionConfig } from 'archetype-ts';

export default class Math extends ArchetypeExtension {
  /**
   * Archetype Extension constructor interface.
   * @param config Extension configuration that's defined
   *   when configuring Archetype
   * @param imports Other extensions that this extension
   *   depends on will be provided through imports.
   */
  constructor(config: ExtensionConfig, imports: any) {
    super(config, imports);
    // Register a service to be exposed to Archetype
    this.register('math', this);
  }

  /** Methods this service provides **/

  add(x: number, y: number): number {
    return x + y;
  }

  sub(x: number, y: number): number {
    return x - y;
  }

  mult(x: number, y: number): number {
    return x * y;
  }

  div(x: number, y: number): number {
    if (y === 0) throw Error("Can't divide by zero!");
    return x / y;
  }
}
```

Each extension is a node module complete with a package.json file. It
need not actually be in npm, it can be a simple folder in the code tree.

```json
{
  "name": "math",
  "version": "0.0.1",
  "main": "math.js",
  "private": true,
  "extension": {
    "provides": ["math"],
    "consumes": []
  }
}
```

## Config Format

The `resolveConfig` function below can read an Archetype config object.
This config object must be a list of `ExtensionConfig` objects.

The sample calculator app has a config like this:

```js
const appConfig: ArchetypeConfig = [
  { packagePath: 'math' },
  './extensions/calculator',
];
```

If the only option in the config is `packagePath`, then a string can be
used in place of the object. If you want to pass other options to the
plugin when it's being created, you can put arbitrary properties here.

The `extension` section in each extension's `package.json` is also merged
in as a prototype to the main config. This is where `provides` and
`consumes` properties are usually set.

## Archetype main API

The `archetype-ts` module exposes two functions as it's main API.

### `createApp(config, [callback])`

This function starts an architect config. The return value is an
`Archetype` instance. The optional callback will listen for both
`error` and `ready` on the app object and report on which one happens
first.

### `resolveConfig(config: ArchetypeConfig)`

This is a sync function that loads a config file and parses all the plugins into a proper config object for use with `createApp`.  While this uses sync I/O all steps along the way are memoized and I/O only occurs on the first invocation.  It's safe to call this in an event loop provided a small set of configPaths are used.

## Class: Archetype

Inherits from `EventEmitter`.

The `createApp` function returns an instance of `Archetype`.

### Event: "service" (name, service)

When a new service is registered, this event is emitted on the app.  Name is the short name for the service, and service is the actual object with functions.

### Event: "extension" (`ArchetypeExtension`)

When an extension registers, this event is emitted.

### Event: "ready" (app)

When all plugins are done, the "ready" event is emitted.  The value is the Archetype instance itself.

