import { Type, type Static } from "typebox";

const UnknownRecord = Type.Record(Type.String(), Type.Unknown());

export const CalibrationTargetSchema = Type.Object({
  kind: Type.String({ description: "Target kind, e.g. qubit, coupling, chip, system" }),
  id: Type.Optional(Type.String()),
  qids: Type.Optional(Type.Array(Type.String())),
  couplingId: Type.Optional(Type.String()),
  chipId: Type.Optional(Type.String()),
});

export const CalibrationTaskContextSchema = Type.Object({
  name: Type.Optional(Type.String()),
  objective: Type.Optional(Type.String()),
  backend: Type.Optional(Type.String()),
  startedAt: Type.Optional(Type.String()),
  completedAt: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
});

export const CalibrationFigureSchema = Type.Object({
  path: Type.Optional(Type.String()),
  url: Type.Optional(Type.String()),
  mimeType: Type.Optional(Type.String()),
  caption: Type.Optional(Type.String()),
  role: Type.Optional(Type.String()),
  data: Type.Optional(Type.Unknown()),
});

export const CalibrationEvidenceSummarySchema = Type.Object({
  id: Type.Optional(Type.String()),
  summary: Type.String(),
  decision: Type.Optional(Type.String()),
  timestamp: Type.Optional(Type.String()),
  metrics: Type.Optional(UnknownRecord),
});

export const CalibrationEvidenceSchema = Type.Object({
  id: Type.Optional(Type.String()),
  source: Type.String({ description: "Evidence source, e.g. local, manual, notebook, external" }),
  target: Type.Optional(CalibrationTargetSchema),
  task: Type.Optional(CalibrationTaskContextSchema),
  metrics: Type.Optional(UnknownRecord),
  parameters: Type.Optional(UnknownRecord),
  resultJson: Type.Optional(Type.Unknown()),
  figures: Type.Optional(Type.Array(CalibrationFigureSchema)),
  logs: Type.Optional(Type.Array(Type.String())),
  notes: Type.Optional(Type.String()),
  history: Type.Optional(Type.Array(CalibrationEvidenceSummarySchema)),
});

export const EvaluationModeSchema = Type.Union([
  Type.Literal("operational_diagnosis"),
  Type.Literal("parameter_extraction"),
  Type.Literal("fit_check"),
]);

export const EvaluationRubricSchema = Type.Object({
  mode: Type.Optional(EvaluationModeSchema),
  objective: Type.Optional(Type.String()),
  passCriteria: Type.Optional(Type.Array(Type.String())),
  warningCriteria: Type.Optional(Type.Array(Type.String())),
  failCriteria: Type.Optional(Type.Array(Type.String())),
  scoreNames: Type.Optional(Type.Array(Type.String())),
  familyBackground: Type.Optional(Type.String()),
  allowedLabels: Type.Optional(Type.Array(Type.String())),
  extractionSchema: Type.Optional(UnknownRecord),
  supportExamples: Type.Optional(Type.Array(CalibrationEvidenceSummarySchema)),
});

export const EvaluationRequestSchema = Type.Object({
  evaluator: Type.String(),
  evidence: CalibrationEvidenceSchema,
  rubric: Type.Optional(EvaluationRubricSchema),
  prompt: Type.Optional(Type.String()),
  profile: Type.Optional(Type.String()),
  provider: Type.Optional(Type.String({ description: "Deprecated alias for profile" })),
  model: Type.Optional(Type.String()),
  options: Type.Optional(UnknownRecord),
});

export const EvaluationResultSchema = Type.Object({
  evaluator: Type.String(),
  provider: Type.String(),
  model: Type.String(),
  decision: Type.String(),
  confidence: Type.Optional(Type.Number()),
  summary: Type.String(),
  evidence: Type.Array(Type.String()),
  suspectedIssues: Type.Optional(Type.Array(Type.String())),
  recommendedNextActions: Type.Optional(Type.Array(Type.String())),
  scores: Type.Optional(Type.Record(Type.String(), Type.Number())),
  rawModelOutput: Type.Optional(Type.String()),
});

export type CalibrationTarget = Static<typeof CalibrationTargetSchema>;
export type CalibrationTaskContext = Static<typeof CalibrationTaskContextSchema>;
export type CalibrationFigure = Static<typeof CalibrationFigureSchema>;
export type CalibrationEvidenceSummary = Static<typeof CalibrationEvidenceSummarySchema>;
export type CalibrationEvidence = Static<typeof CalibrationEvidenceSchema>;
export type EvaluationMode = Static<typeof EvaluationModeSchema>;
export type EvaluationRubric = Static<typeof EvaluationRubricSchema>;
export type EvaluationRequest = Static<typeof EvaluationRequestSchema>;
export type EvaluationResult = Static<typeof EvaluationResultSchema>;

export type EvaluationDecision = "pass" | "warning" | "fail" | "unknown";
