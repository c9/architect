import { EventEmitter } from 'events';
import { basename } from 'path';
import { ArchetypeConfig, ArchetypeExtension, ExtensionConfig, ExtendedError, Service } from './lib';

export default class Archetype extends EventEmitter {
  packages: {[name: string]: string[]} = {};
  pluginToPackage: any = {};
  services: Service = {
    hub: {
      on: this.on.bind(this),
    },
  };
  destructors: Function[] = [];
  isAdditionalMode: boolean = false;

  readonly sortedExtensions: any[];
  constructor(private readonly config: ArchetypeConfig) {
    super();
    this.sortedExtensions = this.checkConfig(this.config);

    // Give createApp some time to subscribe to our "ready" event
    (typeof process === "object" ? process.nextTick : setTimeout)(this.loadExtensions.bind(this));
  }

  destroy() {
    this.destructors.forEach((destroy: Function) => {
      destroy();
    });
    this.destructors = [];
  }

  private checkConfig(config: ArchetypeConfig, lookup?: Function): ExtensionConfig[] {
    // Check for the required fields in each plugin.
    config.forEach((extension: ExtensionConfig) => {
      if (extension.checked) return;
      const debugMsg = JSON.stringify(extension);
      if (!extension.class) {
        throw new Error(`Extension is missing the class function ${debugMsg}`);
      }
      if (!extension.provides) {
        throw new Error(`Extension is missing the provides array ${debugMsg}`);
      }
      if (!extension.consumes) {
        throw new Error(`Extension is missing the consumes array ${debugMsg}`);
      }
    });

    return this.checkCycles(config, lookup);
  }

  private checkCycles(config: ArchetypeConfig, lookup?: Function): ExtensionConfig[] {
    let extensions: ExtensionConfig[] = [];
    config.forEach((extensionConfig: ExtensionConfig, index: number) => {
      extensions.push({
        packagePath: extensionConfig.packagePath,
        provides: Object.assign([], extensionConfig.provides || []),
        consumes: Object.assign([], extensionConfig.consumes || []),
        i: index,
      });
    });

    let resolved: any = {
      hub: true,
    };
    let changed = true;
    let sorted: ExtensionConfig[] = [];

    while(extensions.length && changed) {
      changed = false;
      let extensions_ = Object.assign([], extensions);
      extensions_.forEach((extension: ExtensionConfig) => {
        let consumes = Object.assign([], extension.consumes);
        let resolvedAll = true;

        consumes.forEach((service: string) => {
          if (!resolved[service] && (!lookup || !lookup(service))) {
            resolvedAll = false;
          } else {
            extension.consumes!.splice(extension.consumes!.indexOf(service), 1);
          }
        });

        if (!resolvedAll) return;

        extensions.splice(extensions.indexOf(extension), 1);
        extension.provides!.forEach((service: string) => {
          resolved[service] = true;
        });
        sorted.push(config[extension.i]);
        changed = true;
      });
    }

    if (extensions.length) {
      let unresolved_: {[key: string]: string[]|null} = {};
      extensions.forEach((extensionConfig: ExtensionConfig) => {
        delete extensionConfig.config;
        extensionConfig.consumes!.forEach((service: string) => {
          if (unresolved_[service] === null) return;
          if (!unresolved_[service]) unresolved_[service] = [];
          unresolved_[service]!.push(extensionConfig.packagePath);
        });
        extensionConfig.provides!.forEach((service: string) => {
          unresolved_[service] = null;
        });
      });

      let unresolved: {[key: string]: string[]} = Object.keys(unresolved_)
        .filter((service: string) => unresolved_[service] !== null)
        .reduce((prev: {[key: string]: string[]}, service: string) => {
          prev[service] = unresolved_[service]!;
          return prev;
        }, {});

      let unresolvedList = Object.keys(unresolved);
      let resolvedList = Object.keys(resolved);
      let err: ExtendedError = new Error(`Could not resolve dependencies\n`
        + (unresolvedList.length ? `Missing services: ${unresolvedList}`
        : 'Config contains cyclic dependencies' // TODO print cycles
        ));
      err.unresolved = unresolvedList;
      err.resolved = resolvedList;
      throw err;
    }

    return sorted;
  }

  private loadExtensions() {
    this.sortedExtensions.forEach((config: ExtensionConfig) => {
      const imports: {[name: string]: Service} = {};

      if (config.consumes) {
        config.consumes.forEach((service: string) => {
          imports[service] = this.services[service];
        });
      }

      const extensionName = basename(config.packagePath);
      if (!this.packages[extensionName])
        this.packages[extensionName] = [];

      try {
        const extension = new config.class(config, imports);
        this.register(extensionName, extension);
      } catch (err) {
        err.extension = config;
        this.emit('error', err);
      }
    });

    this.emit('ready', this);
  }

  private register(name: string, extension: ArchetypeExtension) {
    if (extension.config.provides) {
      const provided = extension.getServices();
      extension.config.provides.forEach((service: string) => {
        if (!provided[service]) {
          const debug = JSON.stringify(extension);
          const err = new ExtendedError(
            `Plugin failed to provide ${name} service.\n${debug}`);
          err.extension = extension;
          return this.emit('error', err);
        }
        this.services[service] = provided[service];
        this.pluginToPackage[service] = {
          path: extension.config.packagePath,
          package: name,
          version: extension.config.version,
          isAdditionalMode: this.isAdditionalMode,
        };
        this.packages[name].push(service);
        this.emit('service', service, this.services[service], extension);
      });
      if (provided && provided.hasOwnProperty('onDestroy'))
        this.destructors.push(provided.onDestroy);

      this.emit('extension', extension);
    }
  }
}
