import { CallExpression } from "ts-morph";
import { Metric, type MetricReading } from "./metric.ts";
import {
  AssertionCountMetric,
  AssertionsWithoutMessagesMetric,
  ConjunctionsInNameMetric,
  ControlFlowCountMetric,
  DistinctMatchersMetric,
  HardcodedLiteralCountMetric,
  LineCountMetric,
} from "./metric.registry.ts";

export const defaultTestMetrics = [
  new LineCountMetric(),
  new AssertionCountMetric(),
  new AssertionsWithoutMessagesMetric(),
  new ControlFlowCountMetric(),
  new ConjunctionsInNameMetric(),
  new DistinctMatchersMetric(),
  new HardcodedLiteralCountMetric(),
] as const;

export function metricReadings(
  testCall: CallExpression,
  metrics: readonly Metric<unknown>[],
): MetricReading<unknown>[] {
  return metrics.map((m) => m.reading(testCall));
}

export function metricsRecord(
  testCall: CallExpression,
  metrics: readonly Metric<unknown>[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const m of metrics) {
    out[m.name] = m.extract(testCall);
  }
  return out;
}
