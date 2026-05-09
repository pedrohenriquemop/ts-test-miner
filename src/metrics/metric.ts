import { type CallExpression } from "ts-morph";

export type MetricReading<T> = {
  readonly name: string;
  readonly value: T;
};

export type MetricExtractor<T> = (testCall: CallExpression) => T;

export abstract class Metric<T> {
  abstract readonly name: string;

  abstract extract(testCall: CallExpression): T;

  reading(testCall: CallExpression): MetricReading<T> {
    return { name: this.name, value: this.extract(testCall) };
  }
}
