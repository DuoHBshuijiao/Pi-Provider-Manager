import { deleteAt, getAt, setAt, type PathSeg } from "./json-path.js";
import type { ModelsConfig, ProviderConfig } from "./schema.js";

export const PI_CACHE_RETENTION = "PI_CACHE_RETENTION";
export const PI_CACHE_RETENTION_LONG = "long";
export const DEFAULT_PROMPT_CACHE = { short: 300, long: 3600 } as const;

export interface FieldPatch {
  path: PathSeg[];
  before: unknown | null;
  after: unknown;
}

export function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function pushSet(patches: FieldPatch[], config: ModelsConfig, path: PathSeg[], after: unknown): void {
  const beforeRaw = getAt(config, path);
  const before = beforeRaw === undefined ? null : beforeRaw;
  if (valuesEqual(beforeRaw, after)) return;
  patches.push({ path, before, after });
}

export function applyPatches(config: ModelsConfig, patches: FieldPatch[], direction: "forward" | "reverse"): ModelsConfig {
  let next = config;
  for (const patch of patches) {
    const value = direction === "forward" ? patch.after : patch.before;
    next = value === null ? deleteAt(next, patch.path) : setAt(next, patch.path, value);
  }
  return next;
}

export function buildThirdPartyLongCachePatches(
  config: ModelsConfig,
  providerName: string,
): FieldPatch[] {
  const provider = config.providers[providerName];
  if (!provider) return [];

  const patches: FieldPatch[] = [];
  const compatPath = ["providers", providerName, "compat"] as PathSeg[];
  const longPath = [...compatPath, "supportsLongCacheRetention"] as PathSeg[];
  const currentLong = getAt(config, longPath);
  if (currentLong !== false && currentLong !== true) {
    pushSet(patches, config, longPath, true);
  }

  const api = provider.api;
  if (api === "anthropic-messages") {
    const toolsPath = [...compatPath, "supportsCacheControlOnTools"] as PathSeg[];
    const currentTools = getAt(config, toolsPath);
    if (currentTools !== false && currentTools !== true) {
      pushSet(patches, config, toolsPath, true);
    }
  }

  for (const [index, model] of (provider.models ?? []).entries()) {
    const cachePath = ["providers", providerName, "models", index, "promptCache"] as PathSeg[];
    const longCachePath = [...cachePath, "long"] as PathSeg[];
    const existingLong = getAt(config, longCachePath);
    if (typeof existingLong === "number") continue;
    if (model.promptCache == null) {
      pushSet(patches, config, cachePath, { ...DEFAULT_PROMPT_CACHE });
    } else {
      pushSet(patches, config, longCachePath, DEFAULT_PROMPT_CACHE.long);
    }
  }

  return patches;
}

export function providerApiIsAnthropic(provider: ProviderConfig | undefined): boolean {
  return provider?.api === "anthropic-messages";
}

export const SESSION_COMMANDS = {
  powershell: "$env:PI_CACHE_RETENTION='long'; pi",
  powershellRpc: "$env:PI_CACHE_RETENTION='long'; pi --mode rpc",
  bash: "PI_CACHE_RETENTION=long pi",
  bashRpc: "PI_CACHE_RETENTION=long pi --mode rpc",
} as const;
