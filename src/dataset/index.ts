import * as fs from "fs";
import * as path from "path";

import type { DatasetConfig } from '../config/index.ts';

/**
 * Consolidates the manifest into fixed-size slices for LLM labelling.
 * Generates a pair of files per slice: sampled_manifesto_{index}.json and aggregated_tests_{index}.txt.
 */
export function prepareLlmLabelingDataset(config: DatasetConfig, testsFolder: string = "tests"): void {
  try {
    const { sampleSize, manifestPath, outputDir } = config;
    if (!Number.isFinite(sampleSize) || sampleSize <= 0) {
      throw new Error("sampleSize must be a positive integer.");
    }

    const rawManifesto = fs.readFileSync(manifestPath, "utf-8");
    const fullManifesto = JSON.parse(rawManifesto) as unknown[];
    const total = fullManifesto.length;
    const batchCount = Math.ceil(total / sampleSize);

    if (total === 0) {
      console.warn("Manifest is empty; no files generated.");
      return;
    }

    const breakline = "\n" + "=".repeat(50) + "\n";

    for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
      const start = batchIndex * sampleSize;
      const sampledManifesto = fullManifesto.slice(start, start + sampleSize);

      let aggregatedContent = "";
      aggregatedContent += `[batch_index: ${batchIndex} | batch ${batchIndex + 1} of ${batchCount} | entries in this file: ${sampledManifesto.length}]\n`;
      aggregatedContent += breakline;

      sampledManifesto.forEach((entry: any, index: number) => {
        const filePath = path.join(testsFolder, entry.file);

        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");

          aggregatedContent += `[Test ${index + 1}: ${entry.file}]\n`;
          aggregatedContent += content;
          aggregatedContent += breakline;
        } else {
          console.warn(`⚠️ File not found: ${entry.file}`);
        }
      });

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputManifestoPath = path.join(
        outputDir,
        `sampled_manifesto_${batchIndex}.json`,
      );
      const outputTestsPath = path.join(
        outputDir,
        `aggregated_tests_${batchIndex}.txt`,
      );

      const manifestoFile = {
        batch_index: batchIndex,
        batch_count: batchCount,
        sample_size: sampleSize,
        entries: sampledManifesto,
      };

      fs.writeFileSync(
        outputManifestoPath,
        JSON.stringify(manifestoFile, null, 2),
      );
      fs.writeFileSync(outputTestsPath, aggregatedContent);

      console.log(
        `✅ Batch ${batchIndex}: ${outputManifestoPath}, ${outputTestsPath}`,
      );
    }

    console.log(`- Total batches: ${batchCount} (${batchCount * 2} files)`);
    console.log(`- Entries in manifest: ${total}`);
  } catch (error: any) {
    console.error("❌ Error preparing dataset:", error.message);
  }
}
