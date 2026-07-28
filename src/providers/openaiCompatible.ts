import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type {
  ModelMessage,
  ModelMessageContent,
  ProviderCompletionRequest,
  ProviderCompletionResult,
  QCalProvider,
} from "./types.ts";
import { loadQCalConfig, resolveProfileConfig } from "../config.ts";
import type { CalibrationFigure } from "../schema.ts";

export interface OpenAICompatibleProviderOptions {
  name?: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  defaultTemperature?: number;
  responseFormatJson?: boolean;
}

function guessMimeType(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

async function figureToImageContent(figure: CalibrationFigure): Promise<ModelMessageContent | undefined> {
  if (figure.url) {
    return { type: "image_url", image_url: { url: figure.url } };
  }
  if (!figure.path) return undefined;

  const mimeType = figure.mimeType ?? guessMimeType(figure.path);
  if (!mimeType.startsWith("image/")) return undefined;

  const data = await readFile(figure.path);
  return {
    type: "image_url",
    image_url: { url: `data:${mimeType};base64,${data.toString("base64")}` },
  };
}

async function attachFigures(messages: ModelMessage[], figures: CalibrationFigure[] | undefined): Promise<ModelMessage[]> {
  if (!figures?.length) return messages;

  const imageParts = (await Promise.all(figures.map(figureToImageContent))).filter(
    (part): part is ModelMessageContent => Boolean(part),
  );
  if (!imageParts.length) return messages;

  const lastUserIndex = messages.map((m) => m.role).lastIndexOf("user");
  if (lastUserIndex < 0) return messages;

  const original = messages[lastUserIndex];
  const textPart: ModelMessageContent = {
    type: "text",
    text: typeof original.content === "string" ? original.content : "Evaluate the attached calibration figures.",
  };

  return messages.map((message, index) =>
    index === lastUserIndex ? { ...message, content: [textPart, ...imageParts] } : message,
  );
}

export function createOpenAICompatibleProvider(options: OpenAICompatibleProviderOptions): QCalProvider {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const providerName = options.name ?? "openai-compatible";

  return {
    name: providerName,
    async complete(request: ProviderCompletionRequest, signal?: AbortSignal): Promise<ProviderCompletionResult> {
      const messages = await attachFigures(request.messages, request.figures);
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: request.model ?? options.model,
          messages,
          temperature: request.temperature ?? options.defaultTemperature ?? 0,
          ...(request.responseFormatJson && options.responseFormatJson !== false ? { response_format: { type: "json_object" } } : {}),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${providerName} request failed: HTTP ${response.status} ${text}`);
      }

      const json = (await response.json()) as any;
      const text = json?.choices?.[0]?.message?.content;
      if (typeof text !== "string") {
        throw new Error(`${providerName} response did not contain choices[0].message.content`);
      }

      return {
        provider: providerName,
        model: request.model ?? options.model,
        text,
        raw: json,
      };
    },
  };
}

function createOllamaProvider(options: OpenAICompatibleProviderOptions): QCalProvider {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const providerName = options.name ?? "ollama";

  return {
    name: providerName,
    async complete(request: ProviderCompletionRequest, signal?: AbortSignal): Promise<ProviderCompletionResult> {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: request.model ?? options.model,
          messages: request.messages.map((message) => ({
            role: message.role,
            content: typeof message.content === "string" ? message.content : message.content.map((part) => part.type === "text" ? part.text : "[image]").join("\n"),
          })),
          stream: false,
          options: { temperature: request.temperature ?? options.defaultTemperature ?? 0 },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${providerName} request failed: HTTP ${response.status} ${text}`);
      }

      const json = (await response.json()) as any;
      const text = json?.message?.content;
      if (typeof text !== "string") {
        throw new Error(`${providerName} response did not contain message.content`);
      }

      return { provider: providerName, model: request.model ?? options.model, text, raw: json };
    },
  };
}

export function createProviderFromConfig(profileName?: string, model?: string, cwd?: string): QCalProvider {
  const config = loadQCalConfig(cwd);
  const resolved = resolveProfileConfig(config, profileName, model);

  if (!resolved.baseUrl) {
    throw new Error(`Missing baseUrl for pi-qcal profile '${resolved.profile}'. Configure it in qcal.toml or environment variables.`);
  }
  if (!resolved.model) {
    throw new Error(`Missing model for pi-qcal profile '${resolved.profile}'. Configure it in qcal.toml or environment variables.`);
  }

  if (resolved.provider === "ollama") {
    return createOllamaProvider({
      name: `${resolved.profile}/ollama`,
      baseUrl: resolved.baseUrl,
      model: resolved.model,
      responseFormatJson: resolved.responseFormatJson,
    });
  }

  if (resolved.provider !== "vllm" && resolved.provider !== "openai-compatible") {
    throw new Error(`Unsupported pi-qcal provider '${resolved.provider}' for profile '${resolved.profile}'.`);
  }

  return createOpenAICompatibleProvider({
    name: `${resolved.profile}/${resolved.provider}`,
    baseUrl: resolved.baseUrl,
    apiKey: resolved.apiKey,
    model: resolved.model,
    responseFormatJson: resolved.responseFormatJson,
  });
}

export function createProviderFromEnv(profileName?: string, model?: string): QCalProvider {
  return createProviderFromConfig(profileName, model);
}
