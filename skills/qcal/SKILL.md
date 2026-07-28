---
name: qcal
description: Evaluate quantum calibration evidence with pi-qcal LLM/VLM tools. Use when the user asks to assess calibration quality, run an ising-calibration evaluator, or inspect local calibration figures/artifacts with an external VLM/LLM evaluator.
---

# pi-qcal

Use pi-qcal tools to evaluate calibration evidence. The tools are advisory and read-only from a hardware/control perspective.

## Tool choice

- Use `qcal_evaluate_local` when the user has local JSON, logs, notes, or image files.
- Use `qcal_evaluate_bundle` when evidence is already structured as a `CalibrationEvidence` bundle.
- Prefer rubric mode `operational_diagnosis` for practical calibration review.
- Use rubric mode `parameter_extraction` or `fit_check` only when the user asks for a narrower review.

## Source independence

Do not assume any specific experiment database, dashboard, or lab-management system. If evidence comes from another pi extension or external tool, have that tool produce or describe a `CalibrationEvidence` bundle, then call `qcal_evaluate_bundle`.

If no structured evidence is available, ask for local artifact paths or notes and use `qcal_evaluate_local`.

## Provider configuration

Provider configuration is profile-based. A profile selects an endpoint/model, while `provider` names the serving backend such as `vllm`, `ollama`, or `openai-compatible`.

Example `qcal.toml`:

```toml
defaultProfile = "local"

[profiles.local]
provider = "ollama"
baseUrl = "http://localhost:11434"
model = "llava:latest"

[profiles.spark-ising]
provider = "vllm"
baseUrl = "http://localhost:18000/v1"
model = "nvidia/Ising-Calibration-1-35B-A3B"
apiKeyEnv = "PI_QCAL_VLLM_API_KEY"
responseFormatJson = false
```

Use `/qcal-status` to show non-secret configuration status.

## Safety

- pi-qcal evaluations are advisory.
- Do not execute calibration tasks, commit candidates, apply parameters, or publish reports solely because pi-qcal returned `pass` or `fail`.
- Require explicit confirmation through the relevant operational workflow for any write or hardware action.
- Do not pass sensitive local files unless the user intended them to be analyzed by the configured external model endpoint.
