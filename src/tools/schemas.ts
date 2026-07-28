import { Type, type Static } from "typebox";
import { CalibrationEvidenceSchema, EvaluationRubricSchema } from "../schema.ts";

export const EvaluateBundleParamsSchema = Type.Object({
  evaluator: Type.String({ default: "generic-vlm" }),
  evidence: CalibrationEvidenceSchema,
  profile: Type.Optional(Type.String({ description: "Configuration profile name, e.g. local, spark-ising, or openai" })),
  provider: Type.Optional(Type.String({ description: "Deprecated alias for profile" })),
  model: Type.Optional(Type.String()),
  prompt: Type.Optional(Type.String()),
  rubric: Type.Optional(EvaluationRubricSchema),
});

export const EvaluateLocalParamsSchema = Type.Object({
  files: Type.Optional(Type.Array(Type.String())),
  figures: Type.Optional(Type.Array(Type.String())),
  notes: Type.Optional(Type.String()),
  evaluator: Type.String({ default: "generic-vlm" }),
  profile: Type.Optional(Type.String({ description: "Configuration profile name, e.g. local, spark-ising, or openai" })),
  provider: Type.Optional(Type.String({ description: "Deprecated alias for profile" })),
  model: Type.Optional(Type.String()),
  prompt: Type.Optional(Type.String()),
  rubric: Type.Optional(EvaluationRubricSchema),
});

export type EvaluateBundleParams = Static<typeof EvaluateBundleParamsSchema>;
export type EvaluateLocalParams = Static<typeof EvaluateLocalParamsSchema>;
