import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { buildLocalEvidence } from "../src/adapters/local.ts";
import { evaluateWithProvider } from "../src/evaluators/index.ts";
import { createProviderFromConfig } from "../src/providers/openaiCompatible.ts";

interface SampleCase {
  id: string;
  expectedStatus: string;
  acceptableDecisions: string[];
}

const SAMPLE_CASES: SampleCase[] = [
  { id: "drag_success_a", expectedStatus: "SUCCESS", acceptableDecisions: ["pass"] },
  { id: "drag_failure_position_far_offset_a", expectedStatus: "OPTIMAL_NOT_CENTERED", acceptableDecisions: ["warning", "fail"] },
  { id: "gmm_failure_no_signal_a", expectedStatus: "NO_SIGNAL", acceptableDecisions: ["fail"] },
];

function argValue(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const sampleDir = argValue("sample-dir", "/tmp/qcaleval-hf/sample")!;
const profile = argValue("profile", process.env.PI_QCAL_PROFILE ?? "local")!;
const model = argValue("model", process.env.PI_QCAL_VLLM_MODEL);
const maxTokens = Number(argValue("max-tokens", "2048"));
const outputPath = argValue("output", "/tmp/pi-qcal-qcaleval-smoke-results.json");

const provider = createProviderFromConfig(profile, model);
const results = [];
let failures = 0;

for (const sampleCase of SAMPLE_CASES) {
  const dir = join(sampleDir, sampleCase.id);
  const metaPath = join(dir, "meta.json");
  const imagePath = join(dir, "image.png");

  if (!existsSync(metaPath) || !existsSync(imagePath)) {
    throw new Error(`Missing prepared sample files for ${sampleCase.id}. Expected ${metaPath} and ${imagePath}`);
  }

  const meta = JSON.parse(await readFile(metaPath, "utf8"));
  const evidence = await buildLocalEvidence({ figures: [imagePath] });
  evidence.resultJson = {
    id: meta.id,
    experiment_family: meta.experiment_family,
    experiment_type: meta.experiment_type,
  };
  evidence.task = {
    name: meta.experiment_type,
    objective: "Evaluate the calibration plot status from the benchmark image.",
  };
  evidence.target = { kind: "benchmark_sample", id: meta.id };
  evidence.notes = [
    `QCalEval Hugging Face sample ${meta.id}.`,
    "Ground truth labels are withheld from the prompt and used only for post-hoc smoke-test checks.",
    `Family: ${meta.experiment_family}.`,
    `Type: ${meta.experiment_type}.`,
  ].join("\n");

  const result = await evaluateWithProvider(
    {
      evaluator: "ising-calibration",
      profile,
      model,
      evidence,
      rubric: {
        mode: "operational_diagnosis",
        familyBackground: meta.experiment_background,
        allowedLabels: ["pass", "warning", "fail", "unknown"],
      },
      options: { maxTokens, temperature: 0 },
      prompt: "Evaluate the attached calibration plot. Be conservative. Do not assume access to ground truth labels.",
    },
    provider,
  );

  const ok = sampleCase.acceptableDecisions.includes(result.decision);
  if (!ok) failures += 1;
  const row = {
    sample: sampleCase.id,
    expectedStatus: sampleCase.expectedStatus,
    acceptableDecisions: sampleCase.acceptableDecisions,
    decision: result.decision,
    ok,
    summary: result.summary,
    result,
  };
  results.push(row);
  console.log(`${ok ? "✓" : "✗"} ${sampleCase.id}: expected ${sampleCase.expectedStatus}, decision ${result.decision}`);
}

mkdirSync(dirname(outputPath!), { recursive: true });
writeFileSync(outputPath!, JSON.stringify(results, null, 2));
console.log(`Wrote ${outputPath}`);

if (failures > 0) {
  console.error(`${failures} QCalEval smoke case(s) failed.`);
  process.exit(1);
}
