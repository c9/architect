import { createApp, resolveConfig } from '../../archetyped';
import { ArchetypedConfig } from '../../archetyped/lib';

let appConfig: ArchetypedConfig = resolveConfig([
  {
    packagePath: './extensions/http',
    host: '0.0.0.0',
    port: 9000
  }
], __dirname);

createApp(appConfig);
