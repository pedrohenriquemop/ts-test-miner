import { type CallExpression, Node, SyntaxKind } from "ts-morph";
import { Metric } from "./metric.ts";

export class LineCountMetric extends Metric<number> {
  readonly name = "lineCount" as const;

  extract(testCall: CallExpression): number {
    return testCall.getEndLineNumber() - testCall.getStartLineNumber() + 1;
  }
}

export class AssertionCountMetric extends Metric<number> {
  readonly name = "assertionCount" as const;

  extract(testCall: CallExpression): number {
    const testBody = testCall.getArguments()[1];
    if (!testBody) return 0;

    return testBody
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((c) => {
        const exp = c.getExpression();
        return Node.isIdentifier(exp) && exp.getText() === "expect";
      }).length;
  }
}

export class AssertionsWithoutMessagesMetric extends Metric<number> {
  readonly name = "assertionsWithoutMessages" as const;

  extract(testCall: CallExpression): number {
    const testBody = testCall.getArguments()[1];
    if (!testBody) return 0;

    const assertions = testBody
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((c) => c.getExpression().getText() === "expect");

    return assertions.filter((assertion) => {
      const parent = assertion.getParent();
      if (Node.isPropertyAccessExpression(parent)) {
        const matcherCall = parent.getParent();
        if (Node.isCallExpression(matcherCall)) {
          // Geralmente, se o matcher tem > 1 argumento, o segundo é a mensagem de erro
          return matcherCall.getArguments().length <= 1;
        }
      }
      return true;
    }).length;
  }
}

export class ControlFlowCountMetric extends Metric<number> {
  readonly name = "controlFlowCount" as const;

  extract(testCall: CallExpression): number {
    const testBody = testCall.getArguments()[1];
    if (!testBody) return 0;

    const kinds = [
      SyntaxKind.IfStatement,
      SyntaxKind.ForStatement,
      SyntaxKind.ForInStatement,
      SyntaxKind.ForOfStatement,
      SyntaxKind.SwitchStatement,
      SyntaxKind.WhileStatement,
      SyntaxKind.DoStatement,
      SyntaxKind.ConditionalExpression, // ternary operator
    ];

    return kinds.reduce(
      (acc, kind) => acc + testBody.getDescendantsOfKind(kind).length,
      0,
    );
  }
}

export class ConjunctionsInNameMetric extends Metric<boolean> {
  readonly name = "hasConjunctionsInName" as const;

  extract(testCall: CallExpression): boolean {
    const firstArg = testCall.getArguments()[0];
    if (
      !Node.isStringLiteral(firstArg) &&
      !Node.isNoSubstitutionTemplateLiteral(firstArg)
    ) {
      return false;
    }
    const name = firstArg.getLiteralText().toLowerCase();
    const conjunctions = [" and ", " or ", " & ", " also ", " with "];
    return conjunctions.some((c) => name.includes(c));
  }
}

export class DistinctMatchersMetric extends Metric<number> {
  readonly name = "distinctMatchersCount" as const;

  extract(testCall: CallExpression): number {
    const testBody = testCall.getArguments()[1];
    if (!testBody) return 0;

    const matchers = testBody
      .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .filter((p) => p.getExpression().getText() === "expect")
      .map((p) => p.getName());

    return new Set(matchers).size;
  }
}

export class HardcodedLiteralCountMetric extends Metric<number> {
  readonly name = "hardcodedLiteralCount" as const;

  extract(testCall: CallExpression): number {
    const testBody = testCall.getArguments()[1];
    if (!testBody) return 0;

    return (
      testBody.getDescendantsOfKind(SyntaxKind.StringLiteral).length +
      testBody.getDescendantsOfKind(SyntaxKind.NumericLiteral).length
    );
  }
}
