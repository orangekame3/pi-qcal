import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildLocalEvidence } from "./adapters/local.ts";
import { evaluateWithProvider } from "./evaluators/index.ts";
import { createProviderFromEnv } from "./providers/openaiCompatible.ts";
import type { CalibrationEvidence, EvaluationRequest } from "./schema.ts";
import { formatEvaluationResult } from "./tools/format.ts";
import {
  EvaluateBundleParamsSchema,
  EvaluateLocalParamsSchema,
  type EvaluateBundleParams,
  type EvaluateLocalParams,
} from "./tools/schemas.ts";

async function runEvaluation(request: EvaluationRequest, signal?: AbortSignal) {
  const provider = createProviderFromEnv(request.provider, request.model);
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
        provider: params.provider,
        model: params.model,
      };
      const result = await runEvaluation(request, signal ?? ctx.signal);
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
        provider: params.provider,
        model: params.model,
      };
      const result = await runEvaluation(request, signal ?? ctx.signal);
      return {
        content: [{ type: "text", text: formatEvaluationResult(result) }],
        details: { result, evidence },
      };
    },
  });

  pi.registerCommand("qcal-status", {
    description: "Show pi-qcal provider configuration status without exposing secrets.",
    handler: async (_args, ctx) => {
      const provider = process.env.PI_QCAL_PROVIDER ?? "openai-compatible";
      const openaiBaseUrl = process.env.PI_QCAL_OPENAI_BASE_URL ?? process.env.OPENAI_BASE_URL;
      const vllmBaseUrl = process.env.PI_QCAL_VLLM_BASE_URL;
      const model = process.env.PI_QCAL_VLLM_MODEL ?? process.env.PI_QCAL_OPENAI_MODEL ?? process.env.OPENAI_MODEL;
      ctx.ui.notify(
        [
          `pi-qcal provider: ${provider}`,
          `openai base url: ${openaiBaseUrl ? "configured" : "missing"}`,
          `vllm base url: ${vllmBaseUrl ? "configured" : "missing"}`,
          `model: ${model ?? "missing"}`,
        ].join("\n"),
        "info",
      );
    },
  });
}
