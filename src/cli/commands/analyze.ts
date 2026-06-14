import { Command } from 'commander';
import { loadConfig } from '../../config/index.ts';
import { runAnalyzer } from '../../analyzer/index.ts';

export const analyzeCommand = new Command('analyze')
  .description('Analyze test smells and compare with Gemini baseline')
  .option('-c, --config <path>', 'Path to config file', 'ts-test-smell-bench.config.json')
  .option('--num-tests <number>', 'Override number of tests to analyze')
  .option('--model <name>', 'Override Ollama model name')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      const analyzerConfig = config.analyzer;
      
      if (options.numTests) analyzerConfig.numTests = parseInt(options.numTests, 10);
      if (options.model) analyzerConfig.model = options.model;
      
      await runAnalyzer(analyzerConfig);
    } catch (error) {
      console.error('Error during analysis:', error);
      process.exit(1);
    }
  });
