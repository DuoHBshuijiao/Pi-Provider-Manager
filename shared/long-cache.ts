import { deleteAt, getAt, setAt, type PathSeg } from "./json-path.js";
import type { ModelsConfig, ProviderConfig } from "./schema.js";

export const PI_CACHE_RETENTION = "PI_CACHE_RETENTION";
export const PI_CACHE_RETENTION_LONG = "long";
export const PI_PPM_ENV_PROBE = "PI_PPM_ENV_PROBE";
export const LONG_CACHE_SIDECAR_NAME = "provider-manager-long-cache.json";
export const LONG_CACHE_BASELINE_NAME = "provider-manager-long-cache-baseline.json";
export const LONG_CACHE_EXTENSION_NAME = "provider-manager-long-cache.js";
export const LONG_CACHE_EXTENSION_MARKER = "@pi-provider-manager/long-cache";
export const DEFAULT_PROMPT_CACHE = { short: 300, long: 3600 } as const;

export const LONG_CACHE_METHODS = ["hook", "env"] as const;
export type LongCacheMethod = (typeof LONG_CACHE_METHODS)[number];

export function parseLongCacheMethod(value: unknown): LongCacheMethod {
  return value === "hook" ? "hook" : "env";
}

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

export const ENV_PROBE_CLEAR_COMMAND =
  "[Environment]::SetEnvironmentVariable('PI_PPM_ENV_PROBE',$null,'User')";

export function envProbeCheckCommand(token: string): string {
  return (
    `$t='${token}'; $p=$env:PI_PPM_ENV_PROBE; $u=[Environment]::GetEnvironmentVariable('PI_PPM_ENV_PROBE','User'); ` +
    "if ($p -eq $t -and $u -eq $t) { '本进程和用户变量都是本次探测值：重开终端即可继承' } " +
    "elseif ($u -eq $t) { '用户变量已写入，本进程没有：还需重启资源管理器或注销' } " +
    "elseif ($p -eq $t) { '本进程有值，但用户变量不是本次探测值' } " +
    "else { '本进程和用户变量都不是本次探测值。请完全退出终端宿主后新开窗口再运行；不要在已打开的 Windows Terminal 里新建标签' }"
  );
}
