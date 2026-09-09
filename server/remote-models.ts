import {
  catalogFetchBlockReason,
  parseRemoteModelsPayload,
  resolveProviderApi,
  resolveProviderBaseUrl,
  resolveProviderEnvKeys,
  type FetchRemoteModelsRequest,
  type FetchRemoteModelsResponse,
} from "../shared/remote-models.js";
import { readStoredCredential, type ResolvedCatalogAuth } from "./auth-store.js";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_PAGES = 5;

function interpolateEnvValue(raw: string, extraEnv?: Record<string, string>): string {
  if (raw.startsWith("!") && !raw.startsWith("!!")) {
    return "";
  }

  const lookup = (name: string) => extraEnv?.[name] ?? process.env[name] ?? "";

  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === "$" && raw[i + 1] === "$") {
      out += "$";
      i += 1;
      continue;
    }
    if (ch === "$" && raw[i + 1] === "{") {
      const end = raw.indexOf("}", i + 2);
      if (end === -1) {
        out += ch;
        continue;
      }
      const name = raw.slice(i + 2, end);
      out += lookup(name);
      i = end;
      continue;
    }
    if (ch === "$" && /[A-Za-z_]/.test(raw[i + 1] ?? "")) {
      let end = i + 1;
      while (end < raw.length && /[A-Za-z0-9_]/.test(raw[end]!)) end += 1;
      out += lookup(raw.slice(i + 1, end));
      i = end - 1;
      continue;
    }
    out += ch;
  }
  return out;
}

async function resolveCatalogAuth(
  req: FetchRemoteModelsRequest,
): Promise<ResolvedCatalogAuth | undefined> {
  const raw = req.apiKey?.trim();
  if (raw) {
    const interpolated = interpolateEnvValue(raw).trim();
    if (interpolated) return { token: interpolated, scheme: "api_key" };
  }

  if (req.providerName) {
    const stored = await readStoredCredential(req.providerName);
    if (stored?.type === "oauth") {
      return { token: stored.access.trim(), scheme: "oauth" };
    }
    if (stored?.type === "api_key" && stored.key) {
      const interpolated = interpolateEnvValue(stored.key, stored.env).trim();
      if (interpolated) {
        return { token: interpolated, scheme: "api_key", env: stored.env };
      }
    }
  }

  const keys = resolveProviderEnvKeys(req.providerName);
  if (!keys) return undefined;
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return { token: value, scheme: "api_key" };
  }
  return undefined;
}

function withAuthHint(
  message: string,
  hadAuth: boolean,
  providerName: string | undefined,
): string {
  if (hadAuth || !providerName) return message;
  if (!/\bHTTP 40[13]\b/.test(message)) return message;
  return `${message}。内建供应商请在 Pi 交互模式对该供应商执行 /login，凭证在 ~/.pi/agent/auth.json，不必写进本页。`;
}

function assertHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`无效的模型目录地址：${value}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("只支持 http/https 地址");
  }
  return url;
}

function withListQuery(url: string, api?: string): string {
  const parsed = assertHttpUrl(url);
  if (parsed.hostname.includes("openrouter.ai") && !parsed.searchParams.has("output_modalities")) {
    parsed.searchParams.set("output_modalities", "all");
  }
  const anthropicList =
    api === "anthropic-messages" || parsed.hostname.includes("api.anthropic.com");
  if (anthropicList && !parsed.searchParams.has("limit")) {
    parsed.searchParams.set("limit", "1000");
  }
  return parsed.toString();
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function hasVersionSuffix(root: string): boolean {
  return /\/v\d+[a-z]*$/i.test(root);
}

export function candidateModelUrls(baseUrl: string, api?: string): string[] {
  const root = baseUrl.replace(/\/+$/, "");
  const urls: string[] = [];
  const add = (value: string) => {
    const normalized = withListQuery(value.replace(/\/+$/, ""), api);
    if (!urls.includes(normalized)) urls.push(normalized);
  };

  if (/\/models$/i.test(root) || /\/api\/tags$/i.test(root)) {
    add(root);
    return urls;
  }

  try {
    const parsed = new URL(root);
    if (isLocalHost(parsed.hostname) || parsed.port === "11434") {
      add(`${parsed.origin}/v1/models`);
      add(`${parsed.origin}/api/tags`);
      if (!hasVersionSuffix(root)) add(`${root}/models`);
      return urls;
    }
  } catch {
    // ignore
  }

  if (api === "google-generative-ai") {
    add(`${root}/models`);
    return urls;
  }

  if (api === "anthropic-messages" && !hasVersionSuffix(root)) {
    add(`${root}/v1/models`);
    add(`${root}/models`);
    return urls;
  }

  const openaiLike =
    !api || api === "openai-completions" || api === "openai-responses";
  if (openaiLike && !hasVersionSuffix(root)) {
    add(`${root}/v1/models`);
    add(`${root}/models`);
    return urls;
  }

  add(`${root}/models`);
  if (!hasVersionSuffix(root)) {
    add(`${root}/v1/models`);
  }

  return urls;
}

function buildHeaders(
  req: FetchRemoteModelsRequest,
  auth: ResolvedCatalogAuth | undefined,
  url: string,
  api?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "Pi-Provider-Manager/1.0",
  };

  if (req.headers) {
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.trim() && value) headers[key] = interpolateEnvValue(value, auth?.env);
    }
  }

  const hasAuth =
    Object.keys(headers).some((key) => key.toLowerCase() === "authorization") ||
    Object.keys(headers).some((key) => key.toLowerCase() === "x-api-key") ||
    Object.keys(headers).some((key) => key.toLowerCase() === "x-goog-api-key");

  if (!auth?.token || hasAuth) return headers;

  const apiKey = auth.token;
  const useBearer = auth.scheme === "oauth";

  if (api === "google-generative-ai" || url.includes("generativelanguage.googleapis.com")) {
    if (useBearer) {
      headers.Authorization = `Bearer ${apiKey}`;
      return headers;
    }
    headers["x-goog-api-key"] = apiKey;
    return headers;
  }

  if (api === "anthropic-messages" || url.includes("api.anthropic.com")) {
    headers["anthropic-version"] = headers["anthropic-version"] ?? "2023-06-01";
    if (useBearer) {
      headers.Authorization = `Bearer ${apiKey}`;
      return headers;
    }
    headers["x-api-key"] = apiKey;
    return headers;
  }

  if (req.authHeader === false && !useBearer) {
    headers.Authorization = apiKey;
    return headers;
  }

  headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function appendGoogleKey(url: string, apiKey: string | undefined, api?: string): string {
  if (!apiKey) return url;
  if (api !== "google-generative-ai" && !url.includes("generativelanguage.googleapis.com")) {
    return url;
  }
  const parsed = new URL(url);
  if (!parsed.searchParams.has("key")) parsed.searchParams.set("key", apiKey);
  if (!parsed.searchParams.has("pageSize")) parsed.searchParams.set("pageSize", "1000");
  return parsed.toString();
}

function parseJsonBody(text: string, status: number, contentType: string, url: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const type = contentType.split(";")[0]?.trim() || "未知类型";
    throw new Error(`HTTP ${status} 返回的不是 JSON（${type}）（${url}）`);
  }
}

function errorSnippet(payload: unknown, fallback: string): string {
  const rec = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const nested = rec?.error;
  if (typeof nested === "string") return nested.slice(0, 240);
  if (nested && typeof nested === "object") {
    const message = (nested as { message?: unknown }).message;
    if (typeof message === "string") return message.slice(0, 240);
  }
  if (typeof rec?.message === "string") return rec.message.slice(0, 240);
  return fallback.slice(0, 240);
}

async function fetchPage(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; payload: unknown; ok: boolean }> {
  const res = await fetch(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
  });
  const length = Number(res.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) {
    throw new Error("模型目录响应过大");
  }
  const text = await res.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new Error("模型目录响应过大");
  }
  const contentType = res.headers.get("content-type") ?? "";
  const payload = parseJsonBody(text, res.status, contentType, url);
  return { status: res.status, payload, ok: res.ok };
}

function nextPageUrl(
  current: string,
  payload: unknown,
  dialect: string,
  pageIndex: number,
): string | undefined {
  if (pageIndex >= MAX_PAGES - 1) return undefined;
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  if (!root) return undefined;

  if (dialect === "google" && typeof root.nextPageToken === "string" && root.nextPageToken) {
    const url = new URL(current);
    url.searchParams.set("pageToken", root.nextPageToken);
    return url.toString();
  }

  if (dialect === "anthropic" && root.has_more === true) {
    const lastId =
      (typeof root.last_id === "string" && root.last_id) ||
      (Array.isArray(root.data)
        ? String((root.data[root.data.length - 1] as { id?: string } | undefined)?.id ?? "")
        : "");
    if (!lastId) return undefined;
    const url = new URL(current);
    url.searchParams.set("limit", url.searchParams.get("limit") ?? "100");
    url.searchParams.set("after_id", lastId);
    return url.toString();
  }

  return undefined;
}

export async function fetchRemoteModels(
  req: FetchRemoteModelsRequest,
): Promise<FetchRemoteModelsResponse> {
  const blocked = catalogFetchBlockReason(req.providerName, req.baseUrl);
  if (blocked) {
    throw new Error(blocked);
  }

  const baseUrl = resolveProviderBaseUrl(req.providerName, req.baseUrl);
  if (!baseUrl) {
    throw new Error("请先填写 Base URL，或使用已有默认地址的内建 Provider");
  }

  const api = resolveProviderApi(req.providerName, req.api);
  const auth = await resolveCatalogAuth(req);
  const urls = candidateModelUrls(baseUrl, api);
  if (urls.length === 0) {
    throw new Error("无法从 Base URL 构造模型目录地址");
  }

  let lastError = "无法拉取模型目录";

  for (const rawUrl of urls) {
    const url = appendGoogleKey(rawUrl, auth?.token, api);
    const headers = buildHeaders(req, auth, url, api);

    try {
      let pageUrl: string | undefined = url;
      let dialect = "unknown";
      let usedUrl = url;
      let pageIndex = 0;
      let gotOk = false;
      const models: FetchRemoteModelsResponse["models"] = [];
      const seen = new Set<string>();

      while (pageUrl) {
        const page = await fetchPage(pageUrl, headers);
        if (!page.ok) {
          lastError = withAuthHint(
            `HTTP ${page.status}：${errorSnippet(page.payload, "拉取失败")}（${pageUrl}）`,
            Boolean(auth?.token),
            req.providerName,
          );
          if ([401, 403].includes(page.status)) {
            throw new Error(lastError);
          }
          if ([404, 405].includes(page.status)) break;
          throw new Error(lastError);
        }

        gotOk = true;
        const parsed = parseRemoteModelsPayload(page.payload);
        if (parsed.dialect !== "unknown") dialect = parsed.dialect;
        for (const hint of parsed.models) {
          if (seen.has(hint.id)) continue;
          seen.add(hint.id);
          models.push(hint);
        }
        usedUrl = pageUrl;
        pageUrl = nextPageUrl(pageUrl, page.payload, parsed.dialect, pageIndex);
        pageIndex += 1;
      }

      if (!gotOk) continue;
      if (models.length === 0 && dialect === "unknown") {
        lastError = `未识别的模型目录格式（${url}）`;
        continue;
      }

      models.sort((a, b) => a.id.localeCompare(b.id));
      return { url: usedUrl, dialect, models };
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        lastError = `请求超时：${url}`;
        continue;
      }
      if (error instanceof Error && error.message.startsWith("HTTP ")) {
        throw new Error(withAuthHint(error.message, Boolean(auth?.token), req.providerName));
      }
      lastError = withAuthHint(
        error instanceof Error ? error.message : String(error),
        Boolean(auth?.token),
        req.providerName,
      );
    }
  }

  throw new Error(lastError);
}
