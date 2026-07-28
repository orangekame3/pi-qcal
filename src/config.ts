import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export type QCalProviderType = "vllm" | "openai-compatible" | "nvidia" | "ollama" | string;

export interface QCalProfileConfig {
  provider?: QCalProviderType;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  responseFormatJson?: boolean;
  temperature?: number;
  maxTokens?: number;
  enableThinking?: boolean;
}

export interface QCalConfig {
  defaultProfile?: string;
  profiles: Record<string, QCalProfileConfig>;
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
  const config: QCalConfig = { profiles: {} };

  for (const path of candidateConfigPaths(cwd)) {
    const resolved = resolve(path);
    if (!existsSync(resolved)) continue;
    const parsed = parseTomlSubset(readFileSync(resolved, "utf8"));

    // Preferred schema.
    config.defaultProfile = typeof parsed.defaultProfile === "string" ? parsed.defaultProfile : config.defaultProfile;
    if (parsed.profiles && typeof parsed.profiles === "object") {
      for (const [name, profile] of Object.entries(parsed.profiles)) {
        if (profile && typeof profile === "object") {
          config.profiles[name] = { ...(profile as QCalProfileConfig) };
        }
      }
    }

    // Backward-compatible read of the short-lived defaultProvider/providers schema.
    config.defaultProfile ??= typeof parsed.defaultProvider === "string" ? parsed.defaultProvider : undefined;
    if (parsed.providers && typeof parsed.providers === "object") {
      for (const [name, profile] of Object.entries(parsed.providers)) {
        if (profile && typeof profile === "object" && !config.profiles[name]) {
          config.profiles[name] = { provider: name, ...(profile as QCalProfileConfig) };
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
    profiles: { ...config.profiles },
  };

  if (process.env.PI_QCAL_PROFILE) next.defaultProfile = process.env.PI_QCAL_PROFILE;
  // Backward-compatible alias.
  if (process.env.PI_QCAL_PROVIDER && !process.env.PI_QCAL_PROFILE) next.defaultProfile = process.env.PI_QCAL_PROVIDER;

  const vllmProfileName = process.env.PI_QCAL_VLLM_PROFILE ?? "spark-ising";
  const vllm = { provider: "vllm", ...(next.profiles[vllmProfileName] ?? {}) };
  if (process.env.PI_QCAL_VLLM_BASE_URL) vllm.baseUrl = process.env.PI_QCAL_VLLM_BASE_URL;
  if (process.env.PI_QCAL_VLLM_MODEL) vllm.model = process.env.PI_QCAL_VLLM_MODEL;
  if (process.env.PI_QCAL_VLLM_API_KEY) vllm.apiKey = process.env.PI_QCAL_VLLM_API_KEY;
  if (process.env.PI_QCAL_VLLM_RESPONSE_FORMAT_JSON) {
    vllm.responseFormatJson = process.env.PI_QCAL_VLLM_RESPONSE_FORMAT_JSON === "true";
  }
  if (Object.keys(vllm).length > 1) next.profiles[vllmProfileName] = vllm;

  const nvidiaProfileName = process.env.PI_QCAL_NVIDIA_PROFILE ?? "nvidia";
  const nvidia = { provider: "nvidia", baseUrl: "https://integrate.api.nvidia.com/v1", ...(next.profiles[nvidiaProfileName] ?? {}) };
  if (process.env.PI_QCAL_NVIDIA_BASE_URL) nvidia.baseUrl = process.env.PI_QCAL_NVIDIA_BASE_URL;
  if (process.env.PI_QCAL_NVIDIA_MODEL) nvidia.model = process.env.PI_QCAL_NVIDIA_MODEL;
  if (process.env.PI_QCAL_NVIDIA_API_KEY ?? process.env.NVIDIA_API_KEY) {
    nvidia.apiKey = process.env.PI_QCAL_NVIDIA_API_KEY ?? process.env.NVIDIA_API_KEY;
  }
  if (process.env.PI_QCAL_NVIDIA_MAX_TOKENS) nvidia.maxTokens = Number(process.env.PI_QCAL_NVIDIA_MAX_TOKENS);
  if (process.env.PI_QCAL_NVIDIA_TEMPERATURE) nvidia.temperature = Number(process.env.PI_QCAL_NVIDIA_TEMPERATURE);
  if (Object.keys(nvidia).length > 2) next.profiles[nvidiaProfileName] = nvidia;

  const openaiProfileName = process.env.PI_QCAL_OPENAI_PROFILE ?? "openai";
  const openai = { provider: "openai-compatible", ...(next.profiles[openaiProfileName] ?? {}) };
  if (process.env.PI_QCAL_OPENAI_BASE_URL ?? process.env.OPENAI_BASE_URL) {
    openai.baseUrl = process.env.PI_QCAL_OPENAI_BASE_URL ?? process.env.OPENAI_BASE_URL;
  }
  if (process.env.PI_QCAL_OPENAI_MODEL ?? process.env.OPENAI_MODEL) {
    openai.model = process.env.PI_QCAL_OPENAI_MODEL ?? process.env.OPENAI_MODEL;
  }
  if (process.env.PI_QCAL_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY) {
    openai.apiKey = process.env.PI_QCAL_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  }
  if (Object.keys(openai).length > 1) next.profiles[openaiProfileName] = openai;

  const ollamaProfileName = process.env.PI_QCAL_OLLAMA_PROFILE ?? "ollama";
  const ollama = { provider: "ollama", ...(next.profiles[ollamaProfileName] ?? {}) };
  if (process.env.PI_QCAL_OLLAMA_BASE_URL ?? process.env.OLLAMA_HOST) {
    ollama.baseUrl = process.env.PI_QCAL_OLLAMA_BASE_URL ?? process.env.OLLAMA_HOST;
  }
  if (process.env.PI_QCAL_OLLAMA_MODEL) ollama.model = process.env.PI_QCAL_OLLAMA_MODEL;
  if (Object.keys(ollama).length > 1) next.profiles[ollamaProfileName] = ollama;

  return next;
}

export function resolveProfileConfig(config: QCalConfig, profileName?: string, model?: string): {
  profile: string;
  provider: QCalProviderType;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  responseFormatJson?: boolean;
  temperature?: number;
  maxTokens?: number;
  enableThinking?: boolean;
} {
  const profile = profileName ?? config.defaultProfile ?? "local";
  const profileConfig = config.profiles[profile] ?? {};
  const apiKey = profileConfig.apiKey ?? (profileConfig.apiKeyEnv ? process.env[profileConfig.apiKeyEnv] : undefined);

  return {
    profile,
    provider: profileConfig.provider ?? profile,
    baseUrl: profileConfig.baseUrl,
    model: model ?? profileConfig.model,
    apiKey,
    responseFormatJson: profileConfig.responseFormatJson,
    temperature: profileConfig.temperature,
    maxTokens: profileConfig.maxTokens,
    enableThinking: profileConfig.enableThinking,
  };
}

// Backward-compatible export name for existing imports.
export const resolveProviderConfig = resolveProfileConfig;
