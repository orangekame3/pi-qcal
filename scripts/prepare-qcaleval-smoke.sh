#!/usr/bin/env bash
set -euo pipefail

WORKDIR="${1:-/tmp/qcaleval-hf}"
DATASET_URL="https://huggingface.co/datasets/nvidia/QCalEval/resolve/main/test-00000-of-00001.parquet"
PARQUET="$WORKDIR/test.parquet"
SAMPLE_DIR="$WORKDIR/sample"

mkdir -p "$WORKDIR" "$SAMPLE_DIR"

if [[ ! -f "$PARQUET" ]]; then
  echo "Downloading QCalEval test split to $PARQUET"
  curl -L -o "$PARQUET" "$DATASET_URL"
else
  echo "Using existing $PARQUET"
fi

uv run --with pandas --with pyarrow --with pillow python - "$PARQUET" "$SAMPLE_DIR" <<'PY'
import json
import os
import sys

import pandas as pd

parquet_path = sys.argv[1]
sample_dir = sys.argv[2]
samples = [
    "drag_success_a",
    "drag_failure_position_far_offset_a",
    "gmm_failure_no_signal_a",
]

df = pd.read_parquet(parquet_path)
for sample_id in samples:
    row = df[df["id"].eq(sample_id)].iloc[0]
    out_dir = os.path.join(sample_dir, sample_id)
    os.makedirs(out_dir, exist_ok=True)

    image = row["images"][0]
    with open(os.path.join(out_dir, "image.png"), "wb") as f:
        f.write(image["bytes"])

    meta = {
        key: row[key]
        for key in [
            "id",
            "experiment_family",
            "experiment_type",
            "experiment_background",
            "q2_answer",
            "q4_answer",
            "q6_answer",
            "q6_expected_status",
        ]
    }
    with open(os.path.join(out_dir, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print(f"prepared {sample_id}: {row['q6_expected_status']} -> {out_dir}")
PY

echo "Prepared samples under $SAMPLE_DIR"
