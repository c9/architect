import { EventEmitter } from 'events';

export default class Archetype extends EventEmitter {
  packages: {} = {};
  pluginToPackage: {} = {};
  services: Archetype.Service = {
    hub: {
      on: this.on.bind(this),
    },
  };
  readonly sortedExtensions: any[];
  constructor(private readonly config: Archetype.Config) {
    super();
    this.sortedExtensions = this.checkConfig(this.config);
  }

  private checkConfig(config: Archetype.Config, lookup?: Function): Archetype.ExtensionConfig[] {
    // Check for the required fields in each plugin.
    config.forEach((extension: Archetype.ExtensionConfig) => {
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

  private checkCycles(config: Archetype.Config, lookup?: Function): Archetype.ExtensionConfig[] {
    let extensions: Archetype.ExtensionConfig[] = [];
    config.forEach((extensionConfig: Archetype.ExtensionConfig, index: number) => {
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
    let sorted: Archetype.ExtensionConfig[] = [];

    while(extensions.length && changed) {
      changed = false;
      let extensions_ = Object.assign([], extensions);
      extensions_.forEach((extension: Archetype.ExtensionConfig) => {
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
      extensions.forEach((extensionConfig: Archetype.ExtensionConfig) => {
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
      let err: Archetype.ExtendedError = new Error(`Could not resolve dependencies\n`
        + (unresolvedList.length ? `Missing services: ${unresolvedList}`
        : 'Config contains cyclic dependencies' // TODO print cycles
        ));
      err.unresolved = unresolvedList;
      err.resolved = resolvedList;
      throw err;
    }

    return sorted;
  }
}
