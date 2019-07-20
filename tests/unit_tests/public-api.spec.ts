import { expect } from 'chai';
import { EventEmitter } from 'events';
import { createApp } from '../../src/public-api';
import Archetype from '../../src/archetype';

describe('Archetype Public API', () => {

  it('should create an instance of Archetype' , () => {
    const app = createApp({}, () => {});
    expect(app instanceof EventEmitter).to.be.true;
    expect(app instanceof Archetype).to.be.true;
  });

});