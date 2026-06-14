import { Command } from 'commander';
import { loadConfig } from '../../config/index.ts';
import { prepareLlmLabelingDataset } from '../../dataset/index.ts';

export const prepareCommand = new Command('prepare')
  .description('Prepare datasets for LLM labelling')
  .option('-c, --config <path>', 'Path to config file', 'ts-test-smell-bench.config.json')
  .option('--sample-size <number>', 'Override sample size')
  .option('--output <dir>', 'Override output directory')
  .option('--manifest <path>', 'Override manifest path')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      const datasetConfig = config.dataset;
      
      if (options.sampleSize) datasetConfig.sampleSize = parseInt(options.sampleSize, 10);
      if (options.output) datasetConfig.outputDir = options.output;
      if (options.manifest) datasetConfig.manifestPath = options.manifest;
      
      prepareLlmLabelingDataset(datasetConfig, config.miner.outputDir || 'tests');
    } catch (error) {
      console.error('Error during dataset preparation:', error);
      process.exit(1);
    }
  });
