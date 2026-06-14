import { Octokit } from "@octokit/rest";
import * as fs from "fs";
import * as path from "path";
import { DEFAULT_METRICS } from "../metrics/metric.helpers.ts";
import {
  assertionCountMetric,
  lineCountMetric,
} from "../metrics/metric.registry.ts";
import { MinerHelpers } from "./miner.helpers.ts";
import type { ExtractedTestCase, MinerConfig } from "../types.ts";
import type { MetricDescriptor } from "../metrics/metric.ts";

export class Miner {
  private readonly octokit: Octokit;
  private readonly config: MinerConfig;
  private readonly metrics: readonly MetricDescriptor<unknown>[];

  constructor(config: MinerConfig) {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error("GITHUB_TOKEN is not set");
    }

    this.config = config;
    this.metrics = config.metrics ?? DEFAULT_METRICS;
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  private passesHeuristic(tc: ExtractedTestCase): boolean {
    const lineCount = Number(tc.metrics[lineCountMetric.name] ?? 0);
    const assertionCount = Number(tc.metrics[assertionCountMetric.name] ?? 0);

    return (
      lineCount > this.config.heuristics.minLines ||
      assertionCount > this.config.heuristics.minAssertions
    );
  }

  async run(): Promise<void> {
    console.log("Starting miner...");
    const manifesto: unknown[] = [];
    let totalDownloaded = 0;

    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir);
    }

    try {
      const {
        data: { items: repos },
      } = await this.octokit.search.repos({
        q: `language:${this.config.language} stars:>${this.config.minStars}`,
        sort: "stars",
        per_page: this.config.maxRepos,
      });

      for (const repo of repos) {
        if (totalDownloaded >= this.config.globalFileLimit) break;

        console.log(`\nRepo name: ${repo.full_name}`);
        let filesMinedInThisRepo = 0;

        try {
          const searchResponse = await this.octokit.search.code({
            q: `repo:${repo.full_name} extension:ts describe`,
          });

          const testFiles = searchResponse.data.items.filter((file) =>
            /[\/\\](test|spec|__tests__)[\/\\]/i.test(file.path),
          );

          for (const file of testFiles) {
            if (
              filesMinedInThisRepo >= this.config.maxFilesPerRepo ||
              totalDownloaded >= this.config.globalFileLimit
            )
              break;

            try {
              const { data: contentData } =
                (await this.octokit.repos.getContent({
                  owner: repo.owner?.login || "",
                  repo: repo.name,
                  path: file.path,
                })) as { data: { content: string } };

              const content = Buffer.from(
                contentData.content,
                "base64",
              ).toString("utf-8");

              let extracted: ExtractedTestCase[];
              try {
                extracted = MinerHelpers.extractTestCasesFromSource(
                  content,
                  path.basename(file.path),
                  this.metrics,
                );
              } catch {
                continue;
              }

              let savedAnyFromThisSourceFile = false;
              const repoSlug = repo.full_name.replace(/\//g, "__");
              const baseStem = MinerHelpers.sanitizePathSegment(
                path.basename(file.name, path.extname(file.name)),
                48,
              );

              for (let i = 0; i < extracted.length; i++) {
                if (totalDownloaded >= this.config.globalFileLimit) break;

                const tc = extracted[i];
                if (!this.passesHeuristic(tc)) continue;

                const outName = `${repoSlug}__${baseStem}__${i}.ts`;
                const filePath = path.join(this.config.outputDir, outName);

                fs.writeFileSync(filePath, tc.text);

                manifesto.push({
                  file: outName,
                  repo: repo.full_name,
                  metrics: { ...tc.metrics },
                  originalPath: file.path,
                  testName: tc.testName,
                  testIndexInFile: i,
                });

                savedAnyFromThisSourceFile = true;
                totalDownloaded++;
                console.log(
                  `\t> Saved: ${outName} (${totalDownloaded}/${this.config.globalFileLimit})`,
                );
              }

              if (savedAnyFromThisSourceFile) filesMinedInThisRepo++;
            } catch {
              continue;
            }
          }

          console.log(`\t> Cooldown: ${this.config.cooldownMs / 1000}s...`);
          await MinerHelpers.sleep(this.config.cooldownMs);
        } catch (err: unknown) {
          const e = err as {
            response?: { headers?: Record<string, string> };
            message?: string;
          };
          if (e.response?.headers?.["x-ratelimit-reset"]) {
            const resetTimeMs =
              Number(e.response.headers["x-ratelimit-reset"]) * 1000;
            const extraMs = 2000;
            const waitTime = resetTimeMs - Date.now() + extraMs;
            console.log(
              `\t⚠️ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`,
            );
            await MinerHelpers.sleep(waitTime);
          } else {
            console.warn(`\t!!! Error at ${repo.full_name}: ${e.message}`);
          }
        }
      }

      fs.writeFileSync(
        "manifesto_tests.json",
        JSON.stringify(manifesto, null, 2),
      );
      console.log(
        `\nMining finished. ${totalDownloaded} files saved at ${this.config.outputDir}`,
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("!!! Fatal error:", msg);
    }
  }
}
