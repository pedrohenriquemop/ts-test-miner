import { Command } from 'commander';
import { loadConfig } from '../../config/index.ts';
import { Miner } from '../../miner/index.ts';

export const mineCommand = new Command('mine')
  .description('Mine TypeScript tests from GitHub repositories')
  .option('-c, --config <path>', 'Path to config file', 'ts-test-smell-bench.config.json')
  .option('--output <dir>', 'Override output directory')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      const minerConfig = config.miner;
      
      if (options.output) {
        minerConfig.outputDir = options.output;
      }
      
      const miner = new Miner(minerConfig);
      await miner.run();
    } catch (error) {
      console.error('Error during mining:', error);
      process.exit(1);
    }
  });
