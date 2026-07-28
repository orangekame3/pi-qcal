import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { CalibrationEvidence, CalibrationFigure } from "../schema.ts";

const TEXT_EXTENSIONS = new Set([".txt", ".log", ".md", ".csv", ".tsv"]);
const JSON_EXTENSIONS = new Set([".json", ".jsonl"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function guessMimeType(path: string): string | undefined {
  const ext = extname(path).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".json") return "application/json";
  if (ext === ".csv") return "text/csv";
  if (ext === ".txt" || ext === ".log" || ext === ".md") return "text/plain";
  return undefined;
}

function looksLikePlotlyFigure(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Array.isArray((value as any).data) &&
      typeof (value as any).layout === "object",
  );
}

async function readJson(path: string): Promise<unknown> {
  const text = await readFile(path, "utf8");
  if (extname(path).toLowerCase() === ".jsonl") {
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
  return JSON.parse(text);
}

export interface LocalEvidenceInput {
  files?: string[];
  figures?: string[];
  notes?: string;
  source?: string;
}

export async function buildLocalEvidence(input: LocalEvidenceInput): Promise<CalibrationEvidence> {
  const logs: string[] = [];
  const figures: CalibrationFigure[] = [];
  const resultJson: Record<string, unknown> = {};

  for (const path of input.files ?? []) {
    const ext = extname(path).toLowerCase();
    if (JSON_EXTENSIONS.has(ext)) {
      const json = await readJson(path);
      resultJson[basename(path)] = json;
      if (looksLikePlotlyFigure(json)) {
        figures.push({ path, mimeType: "application/json", role: "plotly", data: json });
      }
    } else if (TEXT_EXTENSIONS.has(ext)) {
      logs.push(`--- ${path} ---\n${await readFile(path, "utf8")}`);
    } else if (IMAGE_EXTENSIONS.has(ext)) {
      figures.push({ path, mimeType: guessMimeType(path), role: "plot" });
    } else {
      logs.push(`Skipped unsupported local artifact: ${path}`);
    }
  }

  for (const path of input.figures ?? []) {
    figures.push({ path, mimeType: guessMimeType(path), role: "plot" });
  }

  return {
    source: input.source ?? "local",
    resultJson: Object.keys(resultJson).length ? resultJson : undefined,
    figures: figures.length ? figures : undefined,
    logs: logs.length ? logs : undefined,
    notes: input.notes,
  };
}
