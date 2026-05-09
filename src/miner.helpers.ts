import { CallExpression, Node, Project, SyntaxKind } from "ts-morph";
import { defaultTestMetrics } from "./metrics/metric.helpers.ts";
import { metricsRecord } from "./metrics/metric.helpers.ts";
import type { ExtractedTestCase } from "./types.ts";
import { Metric } from "./metrics/metric.ts";

export class MinerHelpers {
  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static sanitizePathSegment(s: string, maxLen = 64): string {
    const cleaned = s
      .replace(/[/\\?*:|"<>]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, maxLen);
    return cleaned || "unnamed";
  }

  static extractTestCasesFromSource(
    content: string,
    virtualFilename = "tests.ts",
    metrics: readonly Metric<unknown>[] = defaultTestMetrics,
  ): ExtractedTestCase[] {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(virtualFilename, content, {
      overwrite: true,
    });

    const tests: ExtractedTestCase[] = [];
    const testCalls = sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((call) => MinerHelpers.isItOrTestCall(call));

    for (const testCall of testCalls) {
      const args = testCall.getArguments();
      const testName =
        args[0]?.getText().replace(/^["']|["']$/g, "") || "unknown";
      const testBody = args[1];
      if (!testBody) continue;

      const text = testCall.getText();

      tests.push({
        text,
        testName,
        metrics: metricsRecord(testCall, metrics),
      });
    }

    return tests;
  }

  private static getRootIdentifierName(expr: Node): string | undefined {
    if (Node.isIdentifier(expr)) return expr.getText();
    if (Node.isPropertyAccessExpression(expr))
      return MinerHelpers.getRootIdentifierName(expr.getExpression());
    return undefined;
  }

  private static isItOrTestCall(call: CallExpression): boolean {
    const root = MinerHelpers.getRootIdentifierName(call.getExpression());
    return root === "it" || root === "test";
  }
}
