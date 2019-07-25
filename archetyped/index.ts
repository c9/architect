import { dirname, resolve } from 'path';
import { existsSync, realpathSync } from 'fs';
import Archetyped from './archetyped';
import { ArchetypedConfig, ExtensionConfig, ExtendedError } from './lib';

export * from './lib';

/**
 * Returns an event emitter that represents the app.
 * @param config A list of [[ArchetypedExtension]] configurations.
 * @param callback A callback function that is called when the app is either
 *   ready or has thrown an error.
 * @returns An instance of `Archetyped`
 */
export function createApp(config: ArchetypedConfig, callback?: (err?: Error, app?: Archetyped) => void): Archetyped | undefined {

  let app: Archetyped | undefined;

  const onReady = (app: Archetyped) => {
    done();
  };

  const done = (err?: Error) => {
    if (!app) return;
    if (err) app.destroy();
    app.removeListener('error', done);
    app.removeListener('ready', onReady);
    if (callback) callback(err, app);
  };

  try {
    app = new Archetyped(config);
    if (callback) {
      app.on('error', done);
      app.on('ready', onReady);
    }
  } catch (err) {
    if (!callback) throw err;
    callback(err, undefined);
  }

  return app;
}

/**
 * Resolves each [[ExtensionConfig]] by importing the config's module.
 * @param config A list of [[ExtensionConfig]]
 * @param base The base path of where to check for installed modules.
 * @returns An instance of [[ArchetypedConfig]] that contains module data
 *   of [[ArchetypedExtension]]s.
 */
export function resolveConfig(config: ArchetypedConfig, base?: string): ArchetypedConfig {
  const baseDir = base ? base : __dirname;
  config.forEach((extensionConfig: ExtensionConfig, index: number) => {
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

/**
 * Loads a module, getting metadata from either it's package.json or export
 * object.
 */
function resolveModuleSync(base: string, modulePath: string) {
  let packagePath;
  try {
    packagePath = resolvePackageSync(base, `${modulePath}/package.json`);
  }
  catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const metadata = packagePath && require(packagePath).archetypeExtension || {};
  if (packagePath) {
    modulePath = dirname(packagePath);
  } else {
    modulePath = resolvePackageSync(base, modulePath);
  }
  const module = require(modulePath);
  metadata.provides = metadata.provides || module.provides || [];
  metadata.consumes = metadata.consumes || module.consumes || [];
  metadata.packagePath = modulePath;
  return metadata;
}

/** A cache of loaded package modules. */
const packagePathCache: {[packagePath: string]: any} = {};

/**
 * Node style package resolving so that plugins' package.json can be found
 * relative to the config file.
 * It's not the full node require system algorithm, but it's the 99% case.
 * This throws, make sure to wrap in try..catch
 * @param base The base path of where to check for installed modules.
 * @param packagePath The path to the package module, relative to `base`.
 */
function resolvePackageSync(base: string, packagePath: string) {
  const originalBase = base;
  if (!(base in packagePathCache)) {
    packagePathCache[base] = {};
  }
  const cache = packagePathCache[base];
  if (packagePath in cache) {
    return cache[packagePath];
  }
  const err: ExtendedError = new Error(
    `Can't find '${packagePath}' relative to '${originalBase}`);
  err.code = 'ENOENT';
  let newPath;
  if (packagePath[0] === '.' || packagePath[0] === '/') {
    // If `packagePath` is relative to `base`
    newPath = resolve(base, packagePath);
    if (!existsSync(newPath)) {
      newPath = `${newPath}.js`;
    }
    if (existsSync(newPath)) {
      newPath = realpathSync(newPath);
      cache[packagePath] = newPath;
      return newPath;
    }
  }
  else {
    // Check if pacakge is installed in `node_modules` relative to `base`.
    while (base) {
      newPath = resolve(base, 'node_modules', packagePath);
      if (existsSync(newPath)) {
        newPath = realpathSync(newPath);
        cache[packagePath] = newPath;
        return newPath;
      }
      const parent = resolve(base, '..');
      if (parent === base) throw err;
      base = parent;
    }
  }
  throw err;
}
