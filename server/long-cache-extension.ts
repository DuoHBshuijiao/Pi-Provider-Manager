import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  LONG_CACHE_BASELINE_NAME,
  LONG_CACHE_EXTENSION_MARKER,
  LONG_CACHE_EXTENSION_NAME,
  LONG_CACHE_SIDECAR_NAME,
  PI_CACHE_RETENTION,
  PI_CACHE_RETENTION_LONG,
} from "../shared/long-cache.js";
import { resolveAgentDir } from "./config-store.js";

export function resolveLongCacheExtensionPath(): string {
  return path.join(resolveAgentDir(), "extensions", LONG_CACHE_EXTENSION_NAME);
}

function extensionSource(): string {
  return `// ${LONG_CACHE_EXTENSION_MARKER}
// Installed by Pi Provider Manager. Overwritten when Hook is enabled or upgraded.
// Baseline is keyed by process.pid so /reload keeps the startup snapshot.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";

const ENV = ${JSON.stringify(PI_CACHE_RETENTION)};
const LONG = ${JSON.stringify(PI_CACHE_RETENTION_LONG)};
const SIDECAR_NAME = ${JSON.stringify(LONG_CACHE_SIDECAR_NAME)};
const BASELINE_NAME = ${JSON.stringify(LONG_CACHE_BASELINE_NAME)};

function agentDir() {
  return process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");
}

function sidecarPath() {
  return path.join(agentDir(), SIDECAR_NAME);
}

function baselinePath() {
  return path.join(agentDir(), BASELINE_NAME);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function hookOwned() {
  const raw = readJson(sidecarPath());
  return Boolean(raw && raw.owned === true && raw.method === "hook");
}

function readBaseline() {
  const raw = readJson(baselinePath());
  if (!raw || typeof raw.pid !== "number" || !Number.isInteger(raw.pid) || raw.pid <= 0) return null;
  if (raw.value !== null && typeof raw.value !== "string") return null;
  return { pid: raw.pid, value: raw.value };
}

function writeBaseline(baseline) {
  const filePath = baselinePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = filePath + "." + process.pid + "." + randomBytes(6).toString("hex") + ".tmp";
  fs.writeFileSync(tempPath, JSON.stringify(baseline) + "\\n", "utf8");
  fs.renameSync(tempPath, filePath);
}

function deleteBaseline() {
  try {
    fs.unlinkSync(baselinePath());
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
  }
}

function currentValue() {
  if (!Object.prototype.hasOwnProperty.call(process.env, ENV)) return null;
  const value = process.env[ENV];
  return typeof value === "string" ? value : null;
}

function restore(value) {
  if (value === null) delete process.env[ENV];
  else process.env[ENV] = value;
}

function apply() {
  const owned = hookOwned();
  const baseline = readBaseline();
  const samePid = Boolean(baseline && baseline.pid === process.pid);
  if (owned) {
    if (!samePid) writeBaseline({ pid: process.pid, value: currentValue() });
    process.env[ENV] = LONG;
    return;
  }
  if (samePid && baseline) {
    restore(baseline.value);
    deleteBaseline();
    return;
  }
  if (baseline) deleteBaseline();
}

export default function (pi) {
  apply();
  pi.on("session_start", () => {
    apply();
  });
  pi.on("agent_start", () => {
    apply();
  });
}
`;
}

export async function isLongCacheExtensionInstalled(): Promise<boolean> {
  try {
    const existing = await fs.readFile(resolveLongCacheExtensionPath(), "utf8");
    return existing.includes(LONG_CACHE_EXTENSION_MARKER);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function refreshLongCacheExtension(): Promise<void> {
  const filePath = resolveLongCacheExtensionPath();
  const next = extensionSource();
  try {
    const existing = await fs.readFile(filePath, "utf8");
    if (existing === next) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await installLongCacheExtension();
}

export async function installLongCacheExtension(): Promise<void> {
  const filePath = resolveLongCacheExtensionPath();
  try {
    const existing = await fs.readFile(filePath, "utf8");
    if (!existing.includes(LONG_CACHE_EXTENSION_MARKER)) {
      throw new Error(
        `已存在同名扩展 ${LONG_CACHE_EXTENSION_NAME} 且不是本工具写入，拒绝覆盖`,
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  await fs.writeFile(tempPath, extensionSource(), "utf8");
  await fs.rename(tempPath, filePath);
}
