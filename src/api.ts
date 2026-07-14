import type { ModelsConfig } from "@shared/schema";

export interface MetaResponse {
  modelsJsonPath: string;
  backupDir: string;
  apiTypes: string[];
  builtinProviders: string[];
}

export interface ConfigResponse {
  path: string;
  exists: boolean;
  config: ModelsConfig;
  raw: string;
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
