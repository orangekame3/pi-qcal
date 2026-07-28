import type { EvaluationMode, EvaluationRequest } from "../schema.ts";

function jsonForPrompt(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function buildSystemPrompt(evaluator: string): string {
  return [
    evaluator === "ising-calibration"
      ? "You are a quantum calibration evaluator specialized in calibration plot understanding."
      : "You are a quantum calibration evaluation assistant specialized in calibration plot understanding.",
    "Default to practical operational diagnosis: identify whether the calibration appears usable, marginal, failed, or unknown; explain visual/numeric evidence; assess fit reliability when relevant; extract actionable parameters only when justified; and recommend safe next checks.",
    "Return only a JSON object matching this schema:",
    "{ decision: 'pass'|'warning'|'fail'|'unknown', confidence: number, summary: string, evidence: string[], suspectedIssues?: string[], recommendedNextActions?: string[], scores?: object }",
    "Do not invent measurements that are not present. Use 'unknown' when evidence is insufficient.",
    "Treat your output as advisory evidence, not permission to change hardware parameters.",
  ].join("\n");
}

function modePrompt(mode: EvaluationMode | undefined): string {
  switch (mode ?? "operational_diagnosis") {
    case "parameter_extraction":
      return "Mode: parameter extraction. Extract parameters only when visually/numerically justified; otherwise report uncertainty and avoid guessing.";
    case "fit_check":
      return "Mode: fit check. Focus on whether fits are reliable for downstream parameter extraction and why.";
    case "operational_diagnosis":
    default:
      return "Mode: operational diagnosis. Produce a practical calibration assessment combining plot description, conclusion, significance, fit reliability, usable parameters, and next safe actions.";
  }
}

export function buildUserPrompt(request: EvaluationRequest): string {
  const mode = request.rubric?.mode ?? "operational_diagnosis";
  const parts = [
    `Evaluator: ${request.evaluator}`,
    modePrompt(mode),
    request.rubric?.familyBackground ? `Experiment-family background:\n${request.rubric.familyBackground}` : undefined,
    request.rubric?.allowedLabels ? `Allowed labels/statuses:\n${jsonForPrompt(request.rubric.allowedLabels)}` : undefined,
    request.rubric?.extractionSchema ? `Extraction schema:\n${jsonForPrompt(request.rubric.extractionSchema)}` : undefined,
    request.rubric?.supportExamples ? `Support examples / demonstrations:\n${jsonForPrompt(request.rubric.supportExamples)}` : undefined,
    request.prompt ? `User prompt:\n${request.prompt}` : undefined,
    request.rubric ? `Rubric:\n${jsonForPrompt(request.rubric)}` : undefined,
    `Calibration evidence:\n${jsonForPrompt(request.evidence)}`,
  ].filter(Boolean);

  return parts.join("\n\n");
}
