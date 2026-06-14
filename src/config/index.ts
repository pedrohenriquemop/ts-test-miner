import * as fs from 'fs';
import * as path from 'path';

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
}

export interface DatasetConfig {
  sampleSize: number;
  outputDir: string;
  manifestPath: string;
}

export interface AnalyzerConfig {
  model: string;
  ollamaUrl: string;
  numTests: number;
  manifestPath: string;
  testsDir: string;
  geminiResultsPath: string;
  outputDir: string;
}

export interface AppConfig {
  miner: MinerConfig;
  dataset: DatasetConfig;
  analyzer: AnalyzerConfig;
}

export function loadConfig(configPath: string = 'ts-test-smell-bench.config.json'): AppConfig {
  const fullPath = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Configuration file not found at ${fullPath}`);
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as AppConfig;
}
