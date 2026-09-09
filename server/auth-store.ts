import fs from "node:fs/promises";
import { resolveAuthJsonPath } from "./config-store.js";

export interface ApiKeyCredential {
  type: "api_key";
  key?: string;
  env?: Record<string, string>;
}

export interface OAuthCredential {
  type: "oauth";
  access: string;
  refresh?: string;
  expires?: number;
}

export type StoredCredential = ApiKeyCredential | OAuthCredential;

export interface ResolvedCatalogAuth {
  token: string;
  scheme: "api_key" | "oauth";
  env?: Record<string, string>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseCredential(raw: unknown): StoredCredential | undefined {
  const rec = asRecord(raw);
  if (!rec) return undefined;

  if (rec.type === "api_key") {
    const envRec = asRecord(rec.env);
    const env: Record<string, string> = {};
    if (envRec) {
      for (const [key, value] of Object.entries(envRec)) {
        if (typeof value === "string") env[key] = value;
      }
    }
    return {
      type: "api_key",
      key: typeof rec.key === "string" ? rec.key : undefined,
      env: Object.keys(env).length ? env : undefined,
    };
  }

  if (rec.type === "oauth" && typeof rec.access === "string" && rec.access.trim()) {
    return {
      type: "oauth",
      access: rec.access,
      refresh: typeof rec.refresh === "string" ? rec.refresh : undefined,
      expires: typeof rec.expires === "number" ? rec.expires : undefined,
    };
  }

  return undefined;
}

export async function readStoredCredential(
  providerName: string,
): Promise<StoredCredential | undefined> {
  try {
    const raw = await fs.readFile(resolveAuthJsonPath(), "utf-8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
    const root = asRecord(parsed);
    if (!root) return undefined;
    return parseCredential(root[providerName]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    return undefined;
  }
}
