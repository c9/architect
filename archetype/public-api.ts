import Archetype from './archetype';

/**
 * Returns an event emitter that represents the app.  It can emit events.
 * event: ("service" name, service) emitted when a service is ready to be consumed.
 * event: ("plugin", plugin) emitted when a plugin registers.
 * event: ("ready", app) emitted when all plugins are ready.
 * event: ("error", err) emitted when something goes wrong.
 * app.services - a hash of all the services in this app
 * app.config - the plugin config that was passed in.
 */
export function createApp(config: ArchetectConfig, callback: Function) {
  return new Archetype();
}