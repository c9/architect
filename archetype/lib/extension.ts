import { ExtensionConfig } from './config';

export class ArchetypeExtension {
  private services: any = {}
  constructor(readonly config: ExtensionConfig, readonly imports: any) {}

  register(name: string, service: any) {
    this.services[name] = service;
  }

  getServices() {
    return this.services;
  }
}
