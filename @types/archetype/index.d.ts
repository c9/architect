declare namespace Archetype {
  type ExtensionConfig = {
    packagePath: string;
    checked?: boolean;
    class?: any;//Extension;
    provides?: any[];
    consumes?: any[];
    [key: string]: any;
  };
  type Config = ExtensionConfig[];

  interface Service {
    [name: string]: any;
  }

  class App {}

  class Extension {
    config: ExtensionConfig;
    constructor(options: ExtensionConfig, imports: any, register: Function);
  }

  class ExtendedError extends Error {
    [key: string]: any;
  }
}
