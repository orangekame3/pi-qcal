# pi-qcal

`pi-qcal` is a pi extension for evaluating quantum calibration results with external LLM/VLM evaluators.

The extension is independent of any particular calibration database or experiment-management system. Users or other pi extensions can provide local files, images, JSON artifacts, notebook exports, or arbitrary calibration evidence directly.

The core design goal is to keep **calibration evidence acquisition** outside this package and make `pi-qcal` focus only on **calibration evaluation**.

```text
local files / notebooks / lab scripts / external adapters
        |
        v
CalibrationEvidence bundle
        |
        v
pi-qcal evaluator interface
        |
        +--> ising-calibration model via vLLM
        +--> generic OpenAI-compatible VLM/LLM
        +--> future domain-specific calibration evaluators
```

## Design principles

1. **No experiment-store dependency**
   - `pi-qcal` should not mention or depend on any specific calibration database, dashboard, or lab-management tool.
   - Other packages can adapt their native artifacts into `CalibrationEvidence` and call `qcal_evaluate_bundle`.

2. **Evaluator-agnostic core**
   - The same calibration evidence bundle should be evaluable by vLLM endpoints, OpenAI-compatible APIs, or future VLMs.

3. **Operational interface first**
   - Evaluators receive calibration context, task intent, numeric artifacts, plots/images, and optional history.
   - The default mode is practical operational diagnosis, not benchmark reproduction.
   - Evaluators return a structured judgment rather than only free-form text.

4. **Evidence, not automatic control**
   - Evaluation results can support calibration decisions.
   - They should not automatically commit parameters, apply candidates, or execute calibration tasks without explicit user confirmation.

## Core data model

### CalibrationEvidence

A provider-neutral bundle of calibration artifacts.

```ts
export interface CalibrationEvidence {
  id?: string;
  source: "local" | "manual" | "notebook" | "external" | string;

  target?: CalibrationTarget;
  task?: CalibrationTaskContext;

  metrics?: Record<string, number | string | boolean | null>;
  parameters?: Record<string, number | string | boolean | null>;
  resultJson?: unknown;

  figures?: CalibrationFigure[];
  logs?: string[];
  notes?: string;
  history?: CalibrationEvidenceSummary[];
}
```

### CalibrationTarget

```ts
export interface CalibrationTarget {
  kind: "qubit" | "coupling" | "chip" | "system" | string;
  id?: string;
  qids?: string[];
  couplingId?: string;
  chipId?: string;
}
```

### CalibrationTaskContext

```ts
export interface CalibrationTaskContext {
  name?: string;
  objective?: string;
  backend?: string;
  startedAt?: string;
  completedAt?: string;
  status?: string;
}
```

### CalibrationFigure

```ts
export interface CalibrationFigure {
  path?: string;
  url?: string;
  mimeType?: string;
  caption?: string;
  role?: "plot" | "heatmap" | "trace" | "screenshot" | string;
  data?: unknown; // e.g. Plotly JSON, extracted traces, or parsed numeric image metadata
}
```

## Evaluator interface

```ts
export interface QCalEvaluator {
  name: string;
  description?: string;
  inputModalities: Array<"text" | "image" | "json" | "timeseries">;

  evaluate(input: EvaluationRequest): Promise<EvaluationResult>;
}

export interface EvaluationRequest {
  evaluator: string;
  evidence: CalibrationEvidence;
  rubric?: EvaluationRubric;
  prompt?: string;
  options?: Record<string, unknown>;
}

export interface EvaluationRubric {
  mode?: "operational_diagnosis" | "parameter_extraction" | "fit_check";
  objective?: string;
  familyBackground?: string;
  allowedLabels?: string[];
  extractionSchema?: Record<string, unknown>;
  supportExamples?: CalibrationEvidenceSummary[];
}
```

Default mode is `operational_diagnosis`, which combines plot description, broad conclusion, scientific significance, fit reliability, parameter extraction when justified, and safe next-action recommendation into one advisory result.

Use narrower modes only when useful:

- `parameter_extraction`: focus on extracting machine-readable parameters.
- `fit_check`: focus on fit reliability for downstream parameter use.

## Evaluation result schema

```ts
export interface EvaluationResult {
  evaluator: string;
  provider: string;
  model: string;

  decision: "pass" | "warning" | "fail" | "unknown";
  confidence?: number;

  summary: string;
  evidence: string[];
  suspectedIssues?: string[];
  recommendedNextActions?: string[];

  scores?: Record<string, number>;
  rawModelOutput?: string;
}
```

## Installation / local testing

From this repository:

```bash
pi -e .
```

Or install it as a local pi package:

```bash
pi install ./path/to/pi-qcal
```

Check non-secret provider status inside pi:

```text
/qcal-status
```

## Initial pi tools

### `qcal_evaluate_bundle`

Evaluate a provider-neutral evidence bundle.

```ts
{
  evaluator: "ising-calibration" | "generic-vlm" | string,
  evidence: CalibrationEvidence,
  provider?: "spark-vllm" | "openai-compatible" | string,
  model?: string,
  prompt?: string
}
```

### `qcal_evaluate_local`

Evaluate local artifacts without depending on any external evidence store.

```ts
{
  files?: string[],
  figures?: string[],
  notes?: string,
  evaluator: string,
  provider?: string,
  model?: string
}
```

## Provider targets

### `spark-vllm`

For calibration-evaluation models served by vLLM on an SSH-accessible Spark host.

Expected configuration:

```bash
PI_QCAL_SPARK_HOST=spark
PI_QCAL_VLLM_BASE_URL=http://localhost:8000/v1
PI_QCAL_VLLM_MODEL=ising-calibration
# Optional: only set true if the vLLM server supports OpenAI response_format JSON mode reliably.
PI_QCAL_VLLM_RESPONSE_FORMAT_JSON=false
```

If the vLLM server is only reachable from the remote host, create a tunnel such as:

```bash
ssh -N -L 18000:localhost:8000 spark
PI_QCAL_VLLM_BASE_URL=http://localhost:18000/v1
```


### `openai-compatible`

For generic local or hosted VLM/LLM endpoints that expose an OpenAI-compatible API.

```bash
PI_QCAL_OPENAI_BASE_URL=http://localhost:8000/v1
PI_QCAL_OPENAI_API_KEY=...
PI_QCAL_OPENAI_MODEL=...
```

## Safety

`pi-qcal` is an evaluation extension. It should not directly mutate calibration parameters or execute experiments. If integrated with an external operational workflow, any hardware actions should remain confirmation-gated by that workflow.
