import { expect, should } from 'chai';
import { EventEmitter } from 'events';
import { dirname, resolve } from 'path';
import { createApp, resolveConfig } from '@archetype/public-api';
import Archetype from '@archetype/archetype';
import { ArchetypeConfig } from '@archetype/lib';

describe('Archetype', () => {
  let appConfig: ArchetypeConfig;
  let basePath: string;

  before(() => {
    basePath = resolve(dirname(__dirname), 'build', 'demos', 'calculator');
    appConfig = resolveConfig([
      {packagePath: './extensions/calculator'},
      {packagePath: 'math'},
    ], basePath);
  });

  it('should call callback', () => {
    createApp(appConfig, (err, app) => {
      expect(app).to.not.be.null;
      expect(app instanceof EventEmitter).to.be.true;
      expect(app instanceof Archetype).to.be.true;
    });
  });

  it('should register services', () => {
    const app = createApp(appConfig);
    app!.on('ready', () => {
      const math = app!.services.math;
      expect(math).to.be.ok;
      const calculator = app!.services.calculator;
      expect(calculator).to.be.ok;
    });
  });

  it('should emit event whenever extensions are registered', () => {
    const app = createApp(appConfig);
    app!.on('extension', (extension) => {
      const isMath = extension.__proto__.constructor.name == 'Math';
      const isCalc = extension.__proto__.constructor.name == 'Calculator';
      expect(isMath || isCalc).to.be.true;

      if (isMath) {
        expect(extension.add(2, 2)).to.be.equal(4);
      } else if (isCalc) {
        expect(extension.start(3).add(5).equals()).to.be.equal(8);
      }
    });
  });
});
