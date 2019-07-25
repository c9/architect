import { ExtensionConfig } from './config';

export class ArchetypedExtension {

  /** A mapping of provided services names to its functionality. */
  private services: any = {}

  constructor(readonly config: ExtensionConfig, readonly imports: any) {}

  register(name: string, service: any) {
    this.services[name] = service;
  }

  getServices() {
    return this.services;
  }
}
