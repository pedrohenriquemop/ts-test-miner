import * as dotenv from "dotenv";
import { Miner } from "./miner.ts";
import type { MinerConfig } from "./types.ts";

dotenv.config();

const CONFIG: MinerConfig = {
  minStars: 200,
  language: "typescript",
  maxRepos: 100,
  maxFilesPerRepo: 100,
  globalFileLimit: 10,
  cooldownMs: 500,
  outputDir: "./tests",
  heuristics: {
    minLines: 10,
    minAssertions: 0,
  },
};

const miner = new Miner(CONFIG);
void miner.run();
