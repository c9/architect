import { expect } from 'chai';
import { EventEmitter } from 'events';
import { basename, resolve } from 'path';
import { createApp, resolveConfig } from '@archetype/public-api';
import Archetype from '@archetype/archetype';
import { ArchetypeConfig } from '@archetype/lib';

describe('Archetype Public API', () => {
  let app: Archetype;
  let appConfig: ArchetypeConfig;
  let basePath: string;

  before(() => {
    basePath = resolve(process.cwd(), 'demos', 'calculator');
    appConfig = resolveConfig([
      {packagePath: './extensions/calculator'},
      {packagePath: 'math'},
    ], basePath);
    app = createApp(appConfig, () => {});
  });

  it('should create an instance of Archetype' , () => {
    expect(app instanceof EventEmitter).to.be.true;
    expect(app instanceof Archetype).to.be.true;
  });

  it('should create and sort extension configs' , () => {
    expect(app.sortedExtensions).to.be.not.empty;
    const [ math, calculator ] = app.sortedExtensions;
    expect(basename(math.packagePath)).to.be.equal('math');
    expect(basename(calculator.packagePath)).to.be.equal('calculator');
  });

});
