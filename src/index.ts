import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildLocalEvidence } from "./adapters/local.ts";
import { loadQCalConfig, resolveProfileConfig } from "./config.ts";
import { evaluateWithProvider } from "./evaluators/index.ts";
import { createProviderFromConfig } from "./providers/openaiCompatible.ts";
import type { EvaluationRequest } from "./schema.ts";
import { formatEvaluationResult } from "./tools/format.ts";
import {
  EvaluateBundleParamsSchema,
  EvaluateLocalParamsSchema,
  type EvaluateBundleParams,
  type EvaluateLocalParams,
} from "./tools/schemas.ts";

async function runEvaluation(request: EvaluationRequest, cwd: string, signal?: AbortSignal) {
  const provider = createProviderFromConfig(request.profile ?? request.provider, request.model, cwd);
  return evaluateWithProvider(request, provider, signal);
}

export default function piQcalExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "qcal_evaluate_bundle",
    label: "QCal Evaluate Bundle",
    description: "Evaluate a provider-neutral quantum calibration evidence bundle with an LLM/VLM evaluator.",
    promptSnippet: "Evaluate quantum calibration evidence bundles using external LLM/VLM evaluators.",
    promptGuidelines: [
      "Use qcal_evaluate_bundle when calibration evidence is already available as structured JSON and the user wants an LLM/VLM evaluation.",
      "Treat qcal_evaluate_bundle results as advisory evidence; do not execute calibration tasks or commit parameters from them without explicit confirmation via the relevant operational workflow.",
    ],
    parameters: EvaluateBundleParamsSchema,
    async execute(_toolCallId, params: EvaluateBundleParams, signal, _onUpdate, ctx) {
      const request: EvaluationRequest = {
        evaluator: params.evaluator,
        evidence: params.evidence,
        rubric: params.rubric,
        prompt: params.prompt,
        profile: params.profile,
        provider: params.provider,
        model: params.model,
      };
      const result = await runEvaluation(request, ctx.cwd, signal ?? ctx.signal);
      return {
        content: [{ type: "text", text: formatEvaluationResult(result) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "qcal_evaluate_local",
    label: "QCal Evaluate Local",
    description: "Build calibration evidence from local JSON/text/image artifacts and evaluate it.",
    promptSnippet: "Evaluate local quantum calibration files or figures with external LLM/VLM evaluators.",
    promptGuidelines: [
      "Use qcal_evaluate_local when the user has local calibration JSON, logs, notes, or figures.",
      "Only pass local file paths that the user intended to analyze; calibration artifacts may contain sensitive device information.",
    ],
    parameters: EvaluateLocalParamsSchema,
    async execute(_toolCallId, params: EvaluateLocalParams, signal, _onUpdate, ctx) {
      const evidence = await buildLocalEvidence({ files: params.files, figures: params.figures, notes: params.notes });
      const request: EvaluationRequest = {
        evaluator: params.evaluator,
        evidence,
        rubric: params.rubric,
        prompt: params.prompt,
        profile: params.profile,
        provider: params.provider,
        model: params.model,
      };
      const result = await runEvaluation(request, ctx.cwd, signal ?? ctx.signal);
      return {
        content: [{ type: "text", text: formatEvaluationResult(result) }],
        details: { result, evidence },
      };
    },
  });

  pi.registerCommand("qcal-status", {
    description: "Show pi-qcal provider configuration status without exposing secrets.",
    handler: async (_args, ctx) => {
      const config = loadQCalConfig(ctx.cwd);
      const profile = config.defaultProfile ?? "local";
      const resolved = resolveProfileConfig(config, profile);
      ctx.ui.notify(
        [
          `pi-qcal config: ${config.path ?? "env/defaults only"}`,
          `pi-qcal profile: ${profile}`,
          `provider: ${resolved.provider}`,
          `base url: ${resolved.baseUrl ? "configured" : "missing"}`,
          `model: ${resolved.model ?? "missing"}`,
          `api key: ${resolved.apiKey ? "configured" : "missing"}`,
        ].join("\n"),
        "info",
      );
    },
  });
}
