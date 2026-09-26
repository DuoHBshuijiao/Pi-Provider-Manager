import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
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
// Installed by Pi Provider Manager. Overwritten on the next Hook enable.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ENV = ${JSON.stringify(PI_CACHE_RETENTION)};
const LONG = ${JSON.stringify(PI_CACHE_RETENTION_LONG)};
const SIDECAR_NAME = ${JSON.stringify(LONG_CACHE_SIDECAR_NAME)};
const original = process.env[ENV];
const hadOriginal = Object.prototype.hasOwnProperty.call(process.env, ENV);

function sidecarPath() {
  const agentDir = process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");
  return path.join(agentDir, SIDECAR_NAME);
}

function hookOwned() {
  try {
    const raw = JSON.parse(fs.readFileSync(sidecarPath(), "utf8"));
    return raw && raw.owned === true && raw.method === "hook";
  } catch {
    return false;
  }
}

function apply() {
  if (hookOwned()) {
    process.env[ENV] = LONG;
    return;
  }
  if (hadOriginal) process.env[ENV] = original;
  else delete process.env[ENV];
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
