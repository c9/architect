export type ExtensionConfig = {
  packagePath: string;
  checked?: boolean;
  class?: any;//Extension;
  provides?: any[];
  consumes?: any[];
  [key: string]: any;
};

export type ArchetypedConfig = ExtensionConfig[];
