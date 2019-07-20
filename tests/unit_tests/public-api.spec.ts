import { expect } from 'chai';
import { EventEmitter } from 'events';
import { resolve } from 'path';
import { createApp, resolveConfig } from '@archetype/public-api';
import Archetype from '@archetype/archetype';

describe('Archetype Public API', () => {
  let app: Archetype;
  let appConfig: Archetype.Config;
  let basePath: string;

  before(() => {
    basePath = resolve(process.cwd(), 'demos', 'calculator');
    appConfig = resolveConfig([
      {packagePath: 'calculator'}
    ], basePath);
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
