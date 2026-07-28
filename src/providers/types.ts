import type { CalibrationFigure, EvaluationRequest } from "../schema.ts";

export interface ModelMessageContentText {
  type: "text";
  text: string;
}

export interface ModelMessageContentImageUrl {
  type: "image_url";
  image_url: {
    url: string;
  };
}

export type ModelMessageContent = ModelMessageContentText | ModelMessageContentImageUrl;

export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string | ModelMessageContent[];
}

export interface ProviderCompletionRequest {
  messages: ModelMessage[];
  model?: string;
  temperature?: number;
  responseFormatJson?: boolean;
  figures?: CalibrationFigure[];
  evaluationRequest: EvaluationRequest;
}

export interface ProviderCompletionResult {
  provider: string;
  model: string;
  text: string;
  raw?: unknown;
}

export interface QCalProvider {
  name: string;
  complete(request: ProviderCompletionRequest, signal?: AbortSignal): Promise<ProviderCompletionResult>;
}
