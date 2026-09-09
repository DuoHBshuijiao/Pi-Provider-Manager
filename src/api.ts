import type { ModelsConfig } from "@shared/schema";
import type { BuiltinProviderInfo } from "@shared/builtins";
import type {
  FetchRemoteModelsRequest,
  FetchRemoteModelsResponse,
} from "@shared/remote-models";

export interface MetaResponse {
  modelsJsonPath: string;
  authJsonPath: string;
  backupDir: string;
  apiTypes: string[];
  builtinProviders: string[];
  builtinCatalog: BuiltinProviderInfo[];
  piVersion: string | null;
}

export interface ConfigResponse {
  path: string;
  exists: boolean;
  config: ModelsConfig;
  raw: string;
  issues: Array<{ path: string; message: string }>;
}

export interface ValidateResponse {
  success: boolean;
  issues: Array<{ path: string; message: string }>;
  data: ModelsConfig | null;
}

export interface SaveResponse {
  ok: boolean;
  path: string;
  backupPath: string | null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...init?.headers },
      ...init,
    });
  } catch {
    throw new Error("无法连接本地 API。请确认已运行 npm run dev，且服务端在 8787 端口监听。");
  }

  const text = await res.text();
  let data: (T & { error?: string }) | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as T & { error?: string };
    } catch {
      throw new Error(
        res.ok
          ? "服务器返回了无法解析的响应"
          : `请求失败: HTTP ${res.status}`,
      );
    }
  }

  if (!res.ok) {
    throw new Error(data?.error ?? `请求失败: HTTP ${res.status}`);
  }
  if (data === null) {
    throw new Error("服务器返回了空响应");
  }
  return data;
}

export function fetchMeta(): Promise<MetaResponse> {
  return request<MetaResponse>("/api/meta");
}

export function fetchConfig(): Promise<ConfigResponse> {
  return request<ConfigResponse>("/api/config");
}

export function saveConfig(config: ModelsConfig): Promise<SaveResponse> {
  return request<SaveResponse>("/api/config", {
    method: "PUT",
    body: JSON.stringify({ config }),
  });
}

export function validateConfig(config: unknown): Promise<ValidateResponse> {
  return request<ValidateResponse>("/api/validate", {
    method: "POST",
    body: JSON.stringify({ config }),
  });
}

export function fetchRemoteModels(
  body: FetchRemoteModelsRequest,
): Promise<FetchRemoteModelsResponse> {
  return request<FetchRemoteModelsResponse>("/api/remote-models", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function revealLocalFile(target: "auth" | "models"): Promise<{ ok: boolean; path: string }> {
  return request<{ ok: boolean; path: string }>("/api/reveal", {
    method: "POST",
    body: JSON.stringify({ target }),
  });
}
