import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface QCalProviderConfig {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  responseFormatJson?: boolean;
}

export interface QCalConfig {
  defaultProvider?: string;
  providers: Record<string, QCalProviderConfig>;
  path?: string;
}

function parseValue(raw: string): unknown {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  const num = Number(value);
  if (Number.isFinite(num) && value !== "") return num;
  return value;
}

function setNested(root: Record<string, any>, path: string[], key: string, value: unknown): void {
  let current = root;
  for (const part of path) {
    current[part] ??= {};
    current = current[part];
  }
  current[key] = value;
}

function parseTomlSubset(text: string): Record<string, any> {
  const root: Record<string, any> = {};
  let section: string[] = [];

  for (const originalLine of text.split(/\r?\n/)) {
    const line = originalLine.replace(/\s+#.*$/, "").trim();
    if (!line) continue;

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1].split(".").map((part) => part.trim()).filter(Boolean);
      continue;
    }

    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = parseValue(line.slice(eq + 1));
    setNested(root, section, key, value);
  }

  return root;
}

function candidateConfigPaths(cwd: string): string[] {
  return [
    process.env.PI_QCAL_CONFIG,
    join(cwd, ".pi", "qcal.toml"),
    join(cwd, "qcal.toml"),
    join(homedir(), ".config", "pi-qcal", "config.toml"),
  ].filter((path): path is string => Boolean(path));
}

export function loadQCalConfig(cwd = process.cwd()): QCalConfig {
  const config: QCalConfig = { providers: {} };

  for (const path of candidateConfigPaths(cwd)) {
    const resolved = resolve(path);
    if (!existsSync(resolved)) continue;
    const parsed = parseTomlSubset(readFileSync(resolved, "utf8"));
    config.defaultProvider = typeof parsed.defaultProvider === "string" ? parsed.defaultProvider : config.defaultProvider;
    if (parsed.providers && typeof parsed.providers === "object") {
      for (const [name, provider] of Object.entries(parsed.providers)) {
        if (provider && typeof provider === "object") {
          config.providers[name] = { ...(provider as QCalProviderConfig) };
        }
      }
    }
    config.path = resolved;
    break;
  }

  return applyEnvOverrides(config);
}

function applyEnvOverrides(config: QCalConfig): QCalConfig {
  const next: QCalConfig = {
    ...config,
    providers: { ...config.providers },
  };

  if (process.env.PI_QCAL_PROVIDER) next.defaultProvider = process.env.PI_QCAL_PROVIDER;

  const spark = { ...(next.providers["spark-vllm"] ?? {}) };
  if (process.env.PI_QCAL_VLLM_BASE_URL) spark.baseUrl = process.env.PI_QCAL_VLLM_BASE_URL;
  if (process.env.PI_QCAL_VLLM_MODEL) spark.model = process.env.PI_QCAL_VLLM_MODEL;
  if (process.env.PI_QCAL_VLLM_API_KEY) spark.apiKey = process.env.PI_QCAL_VLLM_API_KEY;
  if (process.env.PI_QCAL_VLLM_RESPONSE_FORMAT_JSON) {
    spark.responseFormatJson = process.env.PI_QCAL_VLLM_RESPONSE_FORMAT_JSON === "true";
  }
  if (Object.keys(spark).length) next.providers["spark-vllm"] = spark;

  const openai = { ...(next.providers["openai-compatible"] ?? {}) };
  if (process.env.PI_QCAL_OPENAI_BASE_URL ?? process.env.OPENAI_BASE_URL) {
    openai.baseUrl = process.env.PI_QCAL_OPENAI_BASE_URL ?? process.env.OPENAI_BASE_URL;
  }
  if (process.env.PI_QCAL_OPENAI_MODEL ?? process.env.OPENAI_MODEL) {
    openai.model = process.env.PI_QCAL_OPENAI_MODEL ?? process.env.OPENAI_MODEL;
  }
  if (process.env.PI_QCAL_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY) {
    openai.apiKey = process.env.PI_QCAL_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  }
  if (Object.keys(openai).length) next.providers["openai-compatible"] = openai;

  return next;
}

export function resolveProviderConfig(config: QCalConfig, providerName?: string, model?: string): {
  name: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  responseFormatJson?: boolean;
} {
  const name = providerName ?? config.defaultProvider ?? "openai-compatible";
  const provider = config.providers[name] ?? {};
  const apiKey = provider.apiKey ?? (provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : undefined);

  return {
    name,
    baseUrl: provider.baseUrl,
    model: model ?? provider.model,
    apiKey,
    responseFormatJson: provider.responseFormatJson,
  };
}
