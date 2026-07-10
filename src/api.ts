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
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `请求失败: ${res.status}`);
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
