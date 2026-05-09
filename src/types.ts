import type { Metric } from "./metrics/metric.ts";

export interface MinerConfig {
  minStars: number;
  language: string;
  maxRepos: number;
  maxFilesPerRepo: number;
  globalFileLimit: number;
  cooldownMs: number;
  outputDir: string;
  heuristics: {
    minLines: number;
    minAssertions: number;
  };
  /** When omitted, uses the built-in default metrics (lineCount, assertionCount). */
  metrics?: readonly Metric<unknown>[];
}

export interface ExtractedTestCase {
  text: string;
  testName: string;
  metrics: Record<string, unknown>;
}
