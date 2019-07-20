import { ExtensionConfig } from './config';

export class ArchetypeExtension {
  constructor(readonly config: ExtensionConfig, imports: any, register: Function) {}
}