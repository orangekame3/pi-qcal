import type { EvaluationResult } from "../schema.ts";

export function formatEvaluationResult(result: EvaluationResult): string {
  const lines = [
    `Evaluator: ${result.evaluator}`,
    `Provider/model: ${result.provider}/${result.model}`,
    `Decision: ${result.decision}${typeof result.confidence === "number" ? ` (confidence ${result.confidence})` : ""}`,
    "",
    result.summary,
  ];

  if (result.evidence.length) {
    lines.push("", "Evidence:", ...result.evidence.map((item) => `- ${item}`));
  }
  if (result.suspectedIssues?.length) {
    lines.push("", "Suspected issues:", ...result.suspectedIssues.map((item) => `- ${item}`));
  }
  if (result.recommendedNextActions?.length) {
    lines.push("", "Recommended next actions:", ...result.recommendedNextActions.map((item) => `- ${item}`));
  }

  return lines.join("\n");
}
