import { ArchetypeExtension, ExtensionConfig } from '@archetype/lib';

export default class Calculator extends ArchetypeExtension {
  private value: number = 0;
  constructor(config: ExtensionConfig, imports: any) {
    super(config, imports);
    this.register('calculator', this);
  }

  start(number: number) {
    this.value = number;
    return this;
  }

  add(number: number) {
    this.value = this.imports.math.add(this.value, number);
    return this;
  }

  equals() {
    return this.value;
  }
}
