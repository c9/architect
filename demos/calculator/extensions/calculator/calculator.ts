import { ArchetypedExtension, ExtensionConfig } from '@archetyped/lib';

/**
 * Simple left-to-right calculator.
 */
export default class Calculator extends ArchetypedExtension {
  private value: number = 0;
  private math: any;
  constructor(config: ExtensionConfig, imports: any) {
    super(config, imports);
    this.math = imports.math;
    this.register('calculator', this);
  }

  start(number: number) {
    this.value = number;
    return this;
  }

  add(number: number) {
    this.value = this.math.add(this.value, number);
    return this;
  }

  sub(number: number) {
    this.value = this.math.sub(this.value, number);
    return this;
  }

  mult(number: number) {
    this.value = this.math.mult(this.value, number);
    return this;
  }

  div(number: number) {
    if (number == 0) throw new Error("Can't divide by zero!");
    this.value = this.math.div(this.value, number);
    return this;
  }

  equals() {
    return this.value;
  }
}
