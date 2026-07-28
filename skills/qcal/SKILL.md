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

The first target provider is an OpenAI-compatible vLLM endpoint serving calibration-evaluation models such as `ising-calibration`.

Useful environment variables:

```bash
PI_QCAL_PROVIDER=spark-vllm
PI_QCAL_VLLM_BASE_URL=http://localhost:8000/v1
PI_QCAL_VLLM_MODEL=ising-calibration
```

For generic endpoints:

```bash
PI_QCAL_OPENAI_BASE_URL=http://localhost:8000/v1
PI_QCAL_OPENAI_API_KEY=...
PI_QCAL_OPENAI_MODEL=...
```

Use `/qcal-status` to show non-secret provider status.

## Safety

- pi-qcal evaluations are advisory.
- Do not execute calibration tasks, commit candidates, apply parameters, or publish reports solely because pi-qcal returned `pass` or `fail`.
- Require explicit confirmation through the relevant operational workflow for any write or hardware action.
- Do not pass sensitive local files unless the user intended them to be analyzed by the configured external model endpoint.
