import type { EvaluationDecision, EvaluationRequest, EvaluationResult } from "../schema.ts";
import type { QCalProvider } from "../providers/types.ts";
import { buildSystemPrompt, buildUserPrompt } from "./prompts.ts";

function parseJsonObject(text: string): any | undefined {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return undefined;
    try {
      return JSON.parse(match[0]);
    } catch {
      return undefined;
    }
  }
}

function normalizeDecision(value: unknown): EvaluationDecision {
  if (value === "pass" || value === "warning" || value === "fail" || value === "unknown") return value;
  return "unknown";
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).filter(Boolean);
}

function numberRecord(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const output: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw)) output[key] = raw;
  }
  return Object.keys(output).length ? output : undefined;
}

function inferDecisionFromText(text: string): EvaluationDecision {
  const lower = text.toLowerCase();
  // Check negative outcomes first; calibration reports often contain phrases like
  // "no usable parameters", which should not be classified as pass just because
  // they contain the word "usable".
  if (/\b(fail|failed|failure|unusable|no signal|no usable|cannot extract|no measurable difference)\b/.test(lower)) return "fail";
  if (/\b(warning|marginal|suboptimal|unreliable|needs attention|treat with caution)\b/.test(lower)) return "warning";
  if (/\b(pass|passed|success|successful)\b/.test(lower)) return "pass";
  return "unknown";
}

export async function evaluateWithProvider(
  request: EvaluationRequest,
  provider: QCalProvider,
  signal?: AbortSignal,
): Promise<EvaluationResult> {
  const completion = await provider.complete(
    {
      model: request.model,
      messages: [
        { role: "system", content: buildSystemPrompt(request.evaluator) },
        { role: "user", content: buildUserPrompt(request) },
      ],
      responseFormatJson: true,
      temperature: typeof request.options?.temperature === "number" ? request.options.temperature : 0,
      maxTokens: typeof request.options?.maxTokens === "number" ? request.options.maxTokens : undefined,
      figures: request.evidence.figures,
      evaluationRequest: request,
    },
    signal,
  );

  const parsed = parseJsonObject(completion.text);
  if (!parsed) {
    const inferredDecision = inferDecisionFromText(completion.text);
    return {
      evaluator: request.evaluator,
      provider: completion.provider,
      model: completion.model,
      decision: inferredDecision,
      summary: completion.text.slice(0, 1000),
      evidence: [
        inferredDecision === "unknown"
          ? "Evaluator did not return parseable JSON."
          : "Evaluator did not return parseable JSON; decision was inferred from free-form text.",
      ],
      rawModelOutput: completion.text,
    };
  }

  return {
    evaluator: request.evaluator,
    provider: completion.provider,
    model: completion.model,
    decision: normalizeDecision(parsed.decision),
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : undefined,
    summary: typeof parsed.summary === "string" ? parsed.summary : JSON.stringify(parsed).slice(0, 1000),
    evidence: stringArray(parsed.evidence) ?? [],
    suspectedIssues: stringArray(parsed.suspectedIssues),
    recommendedNextActions: stringArray(parsed.recommendedNextActions),
    scores: numberRecord(parsed.scores),
    rawModelOutput: completion.text,
  };
}
