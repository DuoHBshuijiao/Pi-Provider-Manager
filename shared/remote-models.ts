import { getBuiltinProvider } from "./builtins.js";
import type { ModelDefinition } from "./schema.js";

export interface RemoteModelHint {
  id: string;
  name?: string;
  input?: Array<"text" | "image">;
  reasoning?: boolean;
  contextWindow?: number;
  maxTokens?: number;
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
}

export interface FetchRemoteModelsRequest {
  providerName?: string;
  baseUrl?: string;
  api?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  authHeader?: boolean;
}

export interface FetchRemoteModelsResponse {
  url: string;
  dialect: string;
  models: RemoteModelHint[];
}

export function resolveProviderBaseUrl(
  providerName: string | undefined,
  baseUrl: string | undefined,
): string | undefined {
  const trimmed = baseUrl?.trim();
  if (trimmed) return trimmed.replace(/\/+$/, "");
  const fallback = providerName ? getBuiltinProvider(providerName)?.baseUrl : undefined;
  return fallback ? fallback.replace(/\/+$/, "") : undefined;
}

export function resolveProviderApi(
  providerName: string | undefined,
  api: string | undefined,
): string | undefined {
  const trimmed = api?.trim();
  if (trimmed) return trimmed;
  return providerName ? getBuiltinProvider(providerName)?.api : undefined;
}

export function catalogFetchBlockReason(
  providerName: string | undefined,
  baseUrl: string | undefined,
): string | undefined {
  if (baseUrl?.trim()) return undefined;
  const meta = providerName ? getBuiltinProvider(providerName) : undefined;
  if (meta && (meta.listModels === false || !meta.baseUrl)) {
    return "该内建供应商没有公开的模型目录，请填写可列出模型的 Base URL";
  }
  if (!resolveProviderBaseUrl(providerName, baseUrl)) {
    return "请先填写 Base URL";
  }
  return undefined;
}

export function canListRemoteModels(
  providerName: string | undefined,
  baseUrl: string | undefined,
): boolean {
  return !catalogFetchBlockReason(providerName, baseUrl);
}

const SKIP_ID =
  /(embedding|whisper|tts|dall-e|moderation|transcribe|imagen|veo-|aqa\b|computer-use|text-embedding)/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function roundCost(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function pickItems(payload: unknown): { dialect: string; items: unknown[] } {
  if (Array.isArray(payload)) {
    return { dialect: "array", items: payload };
  }

  const root = asRecord(payload);
  if (!root) return { dialect: "unknown", items: [] };

  const models = root.models;
  if (Array.isArray(models) && models.length > 0) {
    const sample = asRecord(models[0]);
    if (sample && (sample.digest || sample.details || sample.modified_at)) {
      return { dialect: "ollama", items: models };
    }
    if (
      sample &&
      (str(sample.name)?.startsWith("models/") ||
        sample.displayName ||
        sample.supportedGenerationMethods ||
        sample.inputTokenLimit)
    ) {
      return { dialect: "google", items: models };
    }
  }

  const data = root.data;
  if (Array.isArray(data)) {
    const sample = asRecord(data[0]);
    if (sample?.architecture || sample?.canonical_slug) {
      return { dialect: "openrouter", items: data };
    }
    if (sample?.display_name && (sample.type === "model" || !sample.object)) {
      return { dialect: "anthropic", items: data };
    }
    return { dialect: "openai", items: data };
  }

  const nested = asRecord(root.data);
  if (nested && Array.isArray(nested.data)) {
    return { dialect: "openai", items: nested.data };
  }

  if (Array.isArray(root.result)) return { dialect: "array", items: root.result };
  if (Array.isArray(root.list)) return { dialect: "array", items: root.list };

  return { dialect: "unknown", items: [] };
}

function readId(item: Record<string, unknown>, dialect: string): string | undefined {
  if (dialect === "google") {
    const name = str(item.name) ?? str(item.baseModelId);
    return name ? name.replace(/^models\//, "") : undefined;
  }
  if (dialect === "ollama") {
    return str(item.model) ?? str(item.name);
  }
  return str(item.id) ?? str(item.model) ?? str(item.name);
}

function readName(
  item: Record<string, unknown>,
  dialect: string,
  id: string,
): string | undefined {
  const candidate =
    str(item.display_name) ??
    str(item.displayName) ??
    (dialect === "google" ? undefined : str(item.name));
  if (!candidate || candidate === id) return undefined;
  return candidate;
}

function readContextWindow(item: Record<string, unknown>): number | undefined {
  const top = asRecord(item.top_provider);
  const value =
    num(item.context_length) ??
    num(item.context_window) ??
    num(item.contextWindow) ??
    num(item.max_model_len) ??
    num(item.inputTokenLimit) ??
    num(item.max_input_tokens) ??
    num(top?.context_length);
  return value && value > 0 ? Math.round(value) : undefined;
}

function readMaxTokens(item: Record<string, unknown>): number | undefined {
  const top = asRecord(item.top_provider);
  const value =
    num(item.max_completion_tokens) ??
    num(item.max_output_tokens) ??
    num(item.outputTokenLimit) ??
    num(item.maxTokens) ??
    num(top?.max_completion_tokens);
  return value && value > 0 ? Math.round(value) : undefined;
}

function blobOf(item: Record<string, unknown>, id: string, name?: string): string {
  return [id, name, str(item.description), str(item.owned_by)].filter(Boolean).join(" ");
}

function readImage(item: Record<string, unknown>, id: string, name?: string): boolean {
  const architecture = asRecord(item.architecture);
  const modalities = [
    ...strings(item.input_modalities),
    ...strings(architecture?.input_modalities),
    ...strings(item.capabilities),
  ].map((value) => value.toLowerCase());

  if (modalities.some((value) => value === "image" || value === "vision" || value.includes("image"))) {
    return true;
  }

  const modality = str(architecture?.modality) ?? str(item.modality) ?? "";
  if (/image|vision/i.test(modality)) return true;

  const blob = blobOf(item, id, name);
  if (/text-only|embeddings only/i.test(blob)) return false;
  return /\b(vision|vl-|vl\b|multimodal|flash-vision|gpt-4o|gpt-4\.1|claude-3|claude-sonnet-4|claude-opus-4|gemini-1\.5|gemini-2|gemini-3)\b/i.test(
    blob,
  );
}

function readReasoning(
  item: Record<string, unknown>,
  id: string,
  name?: string,
): boolean | undefined {
  if (item.thinking === true) return true;
  if (item.thinking === false) return false;
  if (asRecord(item.reasoning)) return true;

  const params = strings(item.supported_parameters).map((value) => value.toLowerCase());
  if (params.some((value) => value === "reasoning" || value === "include_reasoning" || value === "reasoning_effort")) {
    return true;
  }

  const blob = blobOf(item, id, name).toLowerCase();
  if (/(reasoner|reasoning|\bthinking\b|\br1\b|qwq|o1-|o3-|o4-mini|deepseek-r1|deepseek-v4)/.test(blob)) {
    return true;
  }
  return undefined;
}

function readCost(item: Record<string, unknown>): RemoteModelHint["cost"] | undefined {
  const pricing = asRecord(item.pricing);
  if (!pricing) return undefined;

  const openrouter = Boolean(item.architecture || item.canonical_slug);
  const prompt = num(pricing.prompt ?? pricing.input);
  const completion = num(pricing.completion ?? pricing.output);
  const cacheRead = num(pricing.input_cache_read ?? pricing.cache_read);
  const cacheWrite = num(pricing.input_cache_write ?? pricing.cache_write);
  const perToken =
    openrouter ||
    (prompt !== undefined && prompt > 0 && prompt < 0.01) ||
    (completion !== undefined && completion > 0 && completion < 0.01);

  const convert = (value: number | undefined) => {
    if (value === undefined || value < 0) return undefined;
    return roundCost(perToken ? value * 1_000_000 : value);
  };

  const cost = {
    input: convert(prompt),
    output: convert(completion),
    cacheRead: convert(cacheRead),
    cacheWrite: convert(cacheWrite),
  };
  if (
    cost.input === undefined &&
    cost.output === undefined &&
    cost.cacheRead === undefined &&
    cost.cacheWrite === undefined
  ) {
    return undefined;
  }
  return cost;
}

function isChatModel(
  item: Record<string, unknown>,
  dialect: string,
  id: string,
): boolean {
  if (SKIP_ID.test(id)) return false;

  if (dialect === "google") {
    const methods = strings(item.supportedGenerationMethods);
    if (methods.length > 0 && !methods.some((method) => /generateContent/i.test(method))) {
      return false;
    }
  }

  const voices = item.supported_voices;
  if (Array.isArray(voices) && voices.length > 0) return false;

  return true;
}

function normalizeItem(raw: unknown, dialect: string): RemoteModelHint | null {
  if (typeof raw === "string" && raw.trim()) {
    const id = raw.trim();
    if (!isChatModel({}, dialect, id)) return null;
    return { id };
  }

  const item = asRecord(raw);
  if (!item) return null;

  const id = readId(item, dialect);
  if (!id || !isChatModel(item, dialect, id)) return null;

  const name = readName(item, dialect, id);
  const hint: RemoteModelHint = { id };
  if (name) hint.name = name;

  const contextWindow = readContextWindow(item);
  if (contextWindow) hint.contextWindow = contextWindow;

  const maxTokens = readMaxTokens(item);
  if (maxTokens) hint.maxTokens = maxTokens;

  if (readImage(item, id, name)) hint.input = ["text", "image"];

  const reasoning = readReasoning(item, id, name);
  if (reasoning !== undefined) hint.reasoning = reasoning;

  const cost = readCost(item);
  if (cost) hint.cost = cost;

  return hint;
}

export function parseRemoteModelsPayload(payload: unknown): {
  dialect: string;
  models: RemoteModelHint[];
} {
  const { dialect, items } = pickItems(payload);
  const seen = new Set<string>();
  const models: RemoteModelHint[] = [];

  for (const item of items) {
    const hint = normalizeItem(item, dialect);
    if (!hint || seen.has(hint.id)) continue;
    seen.add(hint.id);
    models.push(hint);
  }

  models.sort((a, b) => a.id.localeCompare(b.id));
  return { dialect, models };
}

export function applyRemoteModelHint(
  current: ModelDefinition,
  hint: RemoteModelHint,
): ModelDefinition {
  const next: ModelDefinition = { ...current, id: hint.id };
  if (hint.name) next.name = hint.name;
  else if (current.name && current.id !== hint.id) next.name = undefined;

  if (hint.input) next.input = hint.input;
  if (hint.reasoning !== undefined) next.reasoning = hint.reasoning;
  if (hint.contextWindow) next.contextWindow = hint.contextWindow;
  if (hint.maxTokens) next.maxTokens = hint.maxTokens;
  if (hint.cost) next.cost = { ...(current.cost ?? {}), ...hint.cost };

  return next;
}

export function formatRemoteModelLabel(model: RemoteModelHint): string {
  const title = model.name && model.name !== model.id ? `${model.name} (${model.id})` : model.id;
  const bits: string[] = [];
  if (model.input?.includes("image")) bits.push("多模态");
  else bits.push("文本");
  if (model.reasoning) bits.push("思考");
  if (model.contextWindow) {
    const k = model.contextWindow >= 1000 ? `${Math.round(model.contextWindow / 1000)}k` : String(model.contextWindow);
    bits.push(k);
  }
  return `${title} · ${bits.join(" · ")}`;
}

export function resolveProviderEnvKeys(providerName: string | undefined): readonly string[] | undefined {
  if (!providerName) return undefined;
  return getBuiltinProvider(providerName)?.envKeys;
}
