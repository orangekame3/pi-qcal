import { Type, type Static } from "typebox";
import { CalibrationEvidenceSchema, EvaluationRubricSchema } from "../schema.ts";

export const EvaluateBundleParamsSchema = Type.Object({
  evaluator: Type.String({ default: "generic-vlm" }),
  evidence: CalibrationEvidenceSchema,
  provider: Type.Optional(Type.String({ description: "Provider name, e.g. spark-vllm or openai-compatible" })),
  model: Type.Optional(Type.String()),
  prompt: Type.Optional(Type.String()),
  rubric: Type.Optional(EvaluationRubricSchema),
});

export const EvaluateLocalParamsSchema = Type.Object({
  files: Type.Optional(Type.Array(Type.String())),
  figures: Type.Optional(Type.Array(Type.String())),
  notes: Type.Optional(Type.String()),
  evaluator: Type.String({ default: "generic-vlm" }),
  provider: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  prompt: Type.Optional(Type.String()),
  rubric: Type.Optional(EvaluationRubricSchema),
});

export type EvaluateBundleParams = Static<typeof EvaluateBundleParamsSchema>;
export type EvaluateLocalParams = Static<typeof EvaluateLocalParamsSchema>;
