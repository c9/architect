import { expect } from 'chai';
import { EventEmitter } from 'events';
import { createApp, resolveConfig } from '@archetype/public-api';
import Archetype from '@archetype/archetype';

describe('Archetype Public API', () => {
  let app: Archetype;
  let appConfig: Archetype.Config;

  before(() => {
    appConfig = resolveConfig([
      {packagePath: 'calculator'}
    ], __dirname);
    app = createApp(appConfig, () => {});
  });

  it('should create an instance of Archetype' , () => {
    expect(app instanceof EventEmitter).to.be.true;
    expect(app instanceof Archetype).to.be.true;
  });

  it('should create and sort extension configs' , () => {
    expect(app.sortedExtensions).to.be.not.empty;
  });

});
