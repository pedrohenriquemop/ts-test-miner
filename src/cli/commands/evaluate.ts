import { Command } from 'commander';
import { loadConfig } from '../../config/index.ts';
import { evaluateResults } from '../../evaluator/index.ts';

export const evaluateCommand = new Command('evaluate')
  .description('Evaluate inference results from comparison_results.json and generate metrics and HTML dashboard')
  .option('-c, --config <path>', 'Path to config file', 'ts-test-smell-bench.config.json')
  .option('-v, --version-suffix <version>', 'Version suffix for the input/output files')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      if (options.versionSuffix) config.analyzer.version = options.versionSuffix;
      await evaluateResults(config);
    } catch (error) {
      console.error('Error during evaluation:', error);
      process.exit(1);
    }
  });
