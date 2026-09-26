import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  ENV_PROBE_CLEAR_COMMAND,
  envProbeCheckCommand,
  LONG_CACHE_BASELINE_NAME,
  LONG_CACHE_SIDECAR_NAME,
  PI_CACHE_RETENTION,
  PI_CACHE_RETENTION_LONG,
  PI_PPM_ENV_PROBE,
  SESSION_COMMANDS,
  applyPatches,
  parseLongCacheMethod,
  type FieldPatch,
  type LongCacheMethod,
} from "../shared/long-cache.js";
import { readConfig, resolveAgentDir, writeConfig } from "./config-store.js";
import {
  installLongCacheExtension,
  isLongCacheExtensionInstalled,
  refreshLongCacheExtension,
} from "./long-cache-extension.js";
import {
  canWriteUserEnv,
  getUserEnvironmentVariable,
  setUserEnvironmentVariable,
} from "./user-env.js";

export interface LongCacheSidecar {
  owned: boolean;
  method: LongCacheMethod;
  previousUserValue: string | null;
  appliedAt: string;
  modelsPersisted: boolean;
  modelsPatches: FieldPatch[];
}

export interface HookSnapshot {
  pid: number;
  value: string | null;
  live: boolean;
}

export interface LongCacheStatus {
  envSupported: boolean;
  processValue: string | null;
  userValue: string | null;
  owned: boolean;
  method: LongCacheMethod | null;
  previousUserValue: string | null;
  modelsPersisted: boolean;
  checked: boolean;
  externalLong: boolean;
  extensionInstalled: boolean;
  hookSnapshot: HookSnapshot | null;
  sessionCommands: typeof SESSION_COMMANDS;
}

export interface EnvProbeResult {
  token: string;
  checkCommand: string;
  clearCommand: string;
}

function sidecarPath(): string {
  return path.join(resolveAgentDir(), LONG_CACHE_SIDECAR_NAME);
}

function baselinePath(): string {
  return path.join(resolveAgentDir(), LONG_CACHE_BASELINE_NAME);
}

function isPidLive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function parseBaseline(raw: unknown): { pid: number; value: string | null } | null {
  const rec = asRecord(raw);
  if (!rec || typeof rec.pid !== "number" || !Number.isInteger(rec.pid) || rec.pid <= 0) return null;
  if (rec.value !== null && typeof rec.value !== "string") return null;
  return { pid: rec.pid, value: rec.value === null ? null : rec.value };
}

async function readHookSnapshot(): Promise<HookSnapshot | null> {
  try {
    const raw = JSON.parse(await fs.readFile(baselinePath(), "utf8")) as unknown;
    const parsed = parseBaseline(raw);
    if (!parsed || !isPidLive(parsed.pid)) return null;
    return { pid: parsed.pid, value: parsed.value, live: true };
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parsePathSeg(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}

function parsePatches(raw: unknown): FieldPatch[] {
  if (!Array.isArray(raw)) return [];
  const patches: FieldPatch[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    if (!rec || !Array.isArray(rec.path)) continue;
    const pathSegs: Array<string | number> = [];
    let valid = true;
    for (const seg of rec.path) {
      const parsed = parsePathSeg(seg);
      if (parsed === null) {
        valid = false;
        break;
      }
      pathSegs.push(parsed);
    }
    if (!valid || pathSegs[0] !== "providers") continue;
    patches.push({
      path: pathSegs,
      before: rec.before === undefined ? null : rec.before,
      after: rec.after,
    });
  }
  return patches;
}

function parseSidecar(raw: unknown): LongCacheSidecar | null {
  const rec = asRecord(raw);
  if (!rec || rec.owned !== true) return null;
  return {
    owned: true,
    method: parseLongCacheMethod(rec.method),
    previousUserValue: typeof rec.previousUserValue === "string" ? rec.previousUserValue : null,
    appliedAt: typeof rec.appliedAt === "string" ? rec.appliedAt : "",
    modelsPersisted: rec.modelsPersisted === true,
    modelsPatches: parsePatches(rec.modelsPatches),
  };
}

export async function readSidecar(): Promise<LongCacheSidecar | null> {
  try {
    const raw = JSON.parse(await fs.readFile(sidecarPath(), "utf8")) as unknown;
    return parseSidecar(raw);
  } catch {
    return null;
  }
}

async function writeSidecar(sidecar: LongCacheSidecar): Promise<void> {
  const filePath = sidecarPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(sidecar, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

async function deleteSidecar(): Promise<void> {
  try {
    await fs.unlink(sidecarPath());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function getLongCacheStatus(): Promise<LongCacheStatus> {
  const sidecar = await readSidecar();
  const userValue = canWriteUserEnv() ? await getUserEnvironmentVariable(PI_CACHE_RETENTION) : null;
  const processValue = process.env[PI_CACHE_RETENTION] || null;
  const extensionInstalled = await isLongCacheExtensionInstalled();
  const hookSnapshot = await readHookSnapshot();
  const owned = sidecar?.owned === true;
  const method = owned ? sidecar.method : null;
  const envOwned = owned && method === "env";
  const hookOwned = owned && method === "hook" && extensionInstalled;
  return {
    envSupported: canWriteUserEnv(),
    processValue,
    userValue,
    owned,
    method,
    previousUserValue: sidecar?.previousUserValue ?? null,
    modelsPersisted: sidecar?.modelsPersisted === true,
    checked: method === "hook" ? hookOwned : envOwned && userValue === PI_CACHE_RETENTION_LONG,
    externalLong: userValue === PI_CACHE_RETENTION_LONG && !envOwned,
    extensionInstalled,
    hookSnapshot,
    sessionCommands: SESSION_COMMANDS,
  };
}

export async function upgradeHookExtension(): Promise<void> {
  const sidecar = await readSidecar();
  if (!sidecar?.owned || sidecar.method !== "hook") return;
  await refreshLongCacheExtension();
}

function mergeSidecar(
  existing: LongCacheSidecar | null,
  method: LongCacheMethod,
  previousUserValue: string | null,
  modelsPatches: FieldPatch[],
): LongCacheSidecar {
  if (existing?.owned) {
    return {
      ...existing,
      method,
      modelsPatches: existing.modelsPatches.length > 0 ? existing.modelsPatches : modelsPatches,
    };
  }
  return {
    owned: true,
    method,
    previousUserValue,
    appliedAt: new Date().toISOString(),
    modelsPersisted: false,
    modelsPatches,
  };
}

export async function enableLongCache(
  modelsPatches: FieldPatch[],
  method: LongCacheMethod,
): Promise<LongCacheStatus> {
  await clearEnvProbe();
  const existing = await readSidecar();
  if (existing?.owned && existing.method !== method) {
    throw new Error("已用另一种方式启用长缓存，请先关闭再切换");
  }

  if (method === "env") {
    if (!canWriteUserEnv()) {
      throw new Error(
        "当前系统无法由本工具写入用户环境变量。请改用 Pi 扩展（Hook），或在启动 Pi 的终端执行：export PI_CACHE_RETENTION=long",
      );
    }
    const currentUser = await getUserEnvironmentVariable(PI_CACHE_RETENTION);
    const sidecar = mergeSidecar(existing, "env", currentUser, modelsPatches);
    await writeSidecar(sidecar);
    try {
      await setUserEnvironmentVariable(PI_CACHE_RETENTION, PI_CACHE_RETENTION_LONG);
    } catch (error) {
      if (!existing?.owned) await deleteSidecar();
      throw error;
    }
    return getLongCacheStatus();
  }

  await installLongCacheExtension();
  const sidecar = mergeSidecar(existing, "hook", null, modelsPatches);
  await writeSidecar(sidecar);
  return getLongCacheStatus();
}

export async function disableLongCache(): Promise<{
  status: LongCacheStatus;
  modelsPatches: FieldPatch[];
  diskPatched: boolean;
}> {
  const sidecar = await readSidecar();
  if (!sidecar?.owned) {
    throw new Error("本工具未接管长缓存，拒绝修改，以免删除你自己设置的值");
  }

  let diskPatched = false;
  if (sidecar.modelsPersisted && sidecar.modelsPatches.length > 0) {
    const disk = await readConfig();
    if (disk.exists) {
      const reversed = applyPatches(disk.config, sidecar.modelsPatches, "reverse");
      await writeConfig(reversed);
      diskPatched = true;
    }
  }

  if (sidecar.method === "env") {
    await setUserEnvironmentVariable(PI_CACHE_RETENTION, sidecar.previousUserValue);
  }
  await deleteSidecar();
  await clearEnvProbe();
  return {
    status: await getLongCacheStatus(),
    modelsPatches: sidecar.modelsPatches,
    diskPatched,
  };
}

export async function markLongCacheModelsPersisted(): Promise<LongCacheStatus> {
  const sidecar = await readSidecar();
  if (!sidecar?.owned) return getLongCacheStatus();
  if (!sidecar.modelsPersisted) {
    await writeSidecar({ ...sidecar, modelsPersisted: true });
  }
  return getLongCacheStatus();
}

export async function writeEnvProbe(): Promise<EnvProbeResult> {
  if (!canWriteUserEnv()) {
    throw new Error("当前系统无法写入用户环境变量，探测仅适用于 Windows");
  }
  const token = randomBytes(8).toString("hex");
  await setUserEnvironmentVariable(PI_PPM_ENV_PROBE, token);
  return {
    token,
    checkCommand: envProbeCheckCommand(token),
    clearCommand: ENV_PROBE_CLEAR_COMMAND,
  };
}

export async function clearEnvProbe(): Promise<void> {
  if (!canWriteUserEnv()) return;
  try {
    await setUserEnvironmentVariable(PI_PPM_ENV_PROBE, null);
  } catch {
    // 探测变量可能本来就不存在
  }
}
