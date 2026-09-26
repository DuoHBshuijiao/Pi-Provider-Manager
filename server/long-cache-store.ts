import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  PI_CACHE_RETENTION,
  PI_CACHE_RETENTION_LONG,
  SESSION_COMMANDS,
  applyPatches,
  type FieldPatch,
} from "../shared/long-cache.js";
import { readConfig, resolveAgentDir, writeConfig } from "./config-store.js";
import {
  canWriteUserEnv,
  getUserEnvironmentVariable,
  setUserEnvironmentVariable,
} from "./user-env.js";

export interface LongCacheSidecar {
  owned: boolean;
  previousUserValue: string | null;
  appliedAt: string;
  modelsPersisted: boolean;
  modelsPatches: FieldPatch[];
}

export interface LongCacheStatus {
  supported: boolean;
  processValue: string | null;
  userValue: string | null;
  owned: boolean;
  previousUserValue: string | null;
  modelsPersisted: boolean;
  checked: boolean;
  externalLong: boolean;
  sessionCommands: typeof SESSION_COMMANDS;
}

function sidecarPath(): string {
  return path.join(resolveAgentDir(), "provider-manager-long-cache.json");
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
  const owned = sidecar?.owned === true;
  return {
    supported: canWriteUserEnv(),
    processValue,
    userValue,
    owned,
    previousUserValue: sidecar?.previousUserValue ?? null,
    modelsPersisted: sidecar?.modelsPersisted === true,
    checked: owned && userValue === PI_CACHE_RETENTION_LONG,
    externalLong: !owned && userValue === PI_CACHE_RETENTION_LONG,
    sessionCommands: SESSION_COMMANDS,
  };
}

export async function enableLongCache(modelsPatches: FieldPatch[]): Promise<LongCacheStatus> {
  if (!canWriteUserEnv()) {
    throw new Error(
      "当前系统无法由本工具写入用户环境变量。请在启动 Pi 的终端执行：export PI_CACHE_RETENTION=long",
    );
  }
  const currentUser = await getUserEnvironmentVariable(PI_CACHE_RETENTION);
  const existing = await readSidecar();
  const sidecar: LongCacheSidecar = existing?.owned
    ? {
        ...existing,
        modelsPatches: existing.modelsPatches.length > 0 ? existing.modelsPatches : modelsPatches,
      }
    : {
        owned: true,
        previousUserValue: currentUser,
        appliedAt: new Date().toISOString(),
        modelsPersisted: false,
        modelsPatches,
      };
  await writeSidecar(sidecar);
  try {
    await setUserEnvironmentVariable(PI_CACHE_RETENTION, PI_CACHE_RETENTION_LONG);
  } catch (error) {
    if (!existing?.owned) await deleteSidecar();
    throw error;
  }
  return getLongCacheStatus();
}

export async function disableLongCache(): Promise<{
  status: LongCacheStatus;
  modelsPatches: FieldPatch[];
  diskPatched: boolean;
}> {
  const sidecar = await readSidecar();
  if (!sidecar?.owned) {
    throw new Error("本工具未接管长缓存，拒绝修改环境变量，以免删除你自己设置的值");
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

  await setUserEnvironmentVariable(PI_CACHE_RETENTION, sidecar.previousUserValue);
  await deleteSidecar();
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
