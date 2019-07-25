import { dirname, resolve } from 'path';
import { existsSync, realpathSync } from 'fs';
import Archetype from './archetype';
import { ArchetypeConfig, ExtensionConfig, ExtendedError } from './lib';

export * from './lib';

/**
 * Returns an event emitter that represents the app.  It can emit events.
 * event: ("service" name, service) emitted when a service is ready to be consumed.
 * event: ("plugin", plugin) emitted when a plugin registers.
 * event: ("ready", app) emitted when all plugins are ready.
 * event: ("error", err) emitted when something goes wrong.
 * app.services - a hash of all the services in this app
 * app.config - the plugin config that was passed in.
 */
export function createApp(config: ArchetypeConfig, callback?: (err?: Error, app?: Archetype) => void): Archetype|null {

  let app: Archetype;

  const onReady = (app: Archetype) => {
    done();
  };

  const done = (err?: Error) => {
    if (err) app.destroy();
    app.removeListener('error', done);
    app.removeListener('ready', onReady);
    if (callback) callback(err, app);
  };

  try {
    app = new Archetype(config);
  } catch (err) {
    if (!callback) throw err;
    callback(err, undefined);
    return null;
  }
  if (callback) {
    app.on('error', done);
    app.on('ready', onReady);
  }

  return app;
}

export function resolveConfig(config: ArchetypeConfig, base?: string, callback?: Function): ArchetypeConfig {
  const baseDir = base ? base : dirname('.');
  config.forEach(async (extensionConfig: ExtensionConfig, index: number) => {
    // Shortcut where string is used for extension without any options.
    if (typeof extensionConfig === 'string') {
      extensionConfig = config[index] = {packagePath: extensionConfig};
    }
    // The extension is a package on the disk.  We need to load it.
    if (!extensionConfig.class) {
      const mod = resolveModuleSync(baseDir, extensionConfig.packagePath);
      Object.keys(mod).forEach((key: string) => {
        if (!extensionConfig[key]) extensionConfig[key] = mod[key] as any;
      });
      extensionConfig.packagePath = mod.packagePath;
      extensionConfig.class = require(extensionConfig.packagePath).default;
    }
  });
  return config;
}

// Loads a module, getting metadata from either it's package.json or export
// object.
function resolveModuleSync(base: string, modulePath: string) {
  var packagePath;
  try {
    packagePath = resolvePackageSync(base, modulePath + "/package.json");
  }
  catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  var metadata = packagePath && require(packagePath).archetypeExtension || {};
  if (packagePath) {
    modulePath = dirname(packagePath);
  } else {
    modulePath = resolvePackageSync(base, modulePath);
  }
  var module = require(modulePath);
  metadata.provides = metadata.provides || module.provides || [];
  metadata.consumes = metadata.consumes || module.consumes || [];
  metadata.packagePath = modulePath;
  return metadata;
}

const packagePathCache: {[key: string]: any} = {};

// Node style package resolving so that plugins' package.json can be found relative to the config file
// It's not the full node require system algorithm, but it's the 99% case
// This throws, make sure to wrap in try..catch
function resolvePackageSync(base: string, packagePath: string) {
  var originalBase = base;
  if (!(base in packagePathCache)) {
      packagePathCache[base] = {};
  }
  var cache = packagePathCache[base];
  if (packagePath in cache) {
      return cache[packagePath];
  }
  var newPath;
  if (packagePath[0] === "." || packagePath[0] === "/") {
      newPath = resolve(base, packagePath);
      if (!existsSync(newPath)) {
          newPath = newPath + ".js";
      }
      if (existsSync(newPath)) {
          newPath = realpathSync(newPath);
          cache[packagePath] = newPath;
          return newPath;
      }
  }
  else {
      while (base) {
          newPath = resolve(base, "node_modules", packagePath);
          if (existsSync(newPath)) {
              newPath = realpathSync(newPath);
              cache[packagePath] = newPath;
              return newPath;
          }
          base = resolve(base, '..');
      }
  }
  var err: ExtendedError = new Error(
    `Can't find '${packagePath}' relative to '${originalBase}`);
  err.code = `ENOENT`;
  throw err;
}
