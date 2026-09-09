import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomBytes } from "node:crypto";
import {
  createEmptyConfig,
  type ModelsConfig,
  type ValidationIssue,
  validateModelsConfig,
} from "../shared/schema.js";

export function resolveAgentDir(): string {
  return path.join(os.homedir(), ".pi", "agent");
}

export function resolveModelsJsonPath(): string {
  return path.join(resolveAgentDir(), "models.json");
}

export function resolveAuthJsonPath(): string {
  return path.join(resolveAgentDir(), "auth.json");
}

export function resolveBackupDir(): string {
  return path.join(resolveAgentDir(), "backups");
}

export type RevealTarget = "auth" | "models";

export function resolveRevealPath(target: RevealTarget): string {
  return target === "auth" ? resolveAuthJsonPath() : resolveModelsJsonPath();
}

/** Open a known agent file in the OS file manager. Rejects paths outside ~/.pi/agent. */
export function revealAgentFile(target: RevealTarget): string {
  const filePath = path.resolve(resolveRevealPath(target));
  const agentDir = path.resolve(resolveAgentDir());
  const relative = path.relative(agentDir, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("拒绝打开该路径");
  }

  if (process.platform === "win32") {
    spawn("explorer", [`/select,${filePath}`], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", ["-R", filePath], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [path.dirname(filePath)], { detached: true, stdio: "ignore" }).unref();
  }
  return filePath;
}

function formatBackupName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  const suffix = randomBytes(3).toString("hex");
  return `models-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${ms}-${suffix}.json`;
}

function uniqueTempPath(filePath: string): string {
  const suffix = randomBytes(6).toString("hex");
  return `${filePath}.${process.pid}.${suffix}.tmp`;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export interface ConfigReadResult {
  path: string;
  exists: boolean;
  config: ModelsConfig;
  raw: string;
  issues: ValidationIssue[];
}

/** JSON 可解析但 schema 未通过时，尽量还原成可编辑的配置，避免启动整页锁死。 */
function coerceModelsConfig(parsed: unknown): ModelsConfig | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const providers = record.providers;
  if (providers === undefined) {
    return { ...record, providers: {} } as ModelsConfig;
  }
  if (typeof providers !== "object" || providers === null || Array.isArray(providers)) {
    return null;
  }
  return parsed as ModelsConfig;
}

export async function readConfig(): Promise<ConfigReadResult> {
  const filePath = resolveModelsJsonPath();

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new Error("models.json 不是合法 JSON，请检查括号、逗号与引号");
    }

    const validation = validateModelsConfig(parsed);
    const config = validation.data ?? coerceModelsConfig(parsed);

    if (!config) {
      throw new Error(
        validation.issues.map((i) => `${i.path}: ${i.message}`).join("; ") ||
          "配置格式无效",
      );
    }

    return {
      path: filePath,
      exists: true,
      config,
      raw,
      issues: validation.success ? [] : validation.issues,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        path: filePath,
        exists: false,
        config: createEmptyConfig(),
        raw: JSON.stringify(createEmptyConfig(), null, 2),
        issues: [],
      };
    }
    throw error;
  }
}

export async function backupConfig(filePath: string): Promise<string | null> {
  try {
    await fs.access(filePath);
  } catch {
    return null;
  }

  const backupDir = resolveBackupDir();
  await ensureDir(backupDir);
  const backupPath = path.join(backupDir, formatBackupName());
  await fs.copyFile(filePath, backupPath);
  return backupPath;
}

export async function writeConfig(config: ModelsConfig): Promise<{
  path: string;
  backupPath: string | null;
}> {
  const validation = validateModelsConfig(config);
  if (!validation.success || !validation.data) {
    throw new Error(
      validation.issues.map((i) => `${i.path}: ${i.message}`).join("; "),
    );
  }

  const filePath = resolveModelsJsonPath();
  await ensureDir(path.dirname(filePath));

  const backupPath = await backupConfig(filePath);
  const content = `${JSON.stringify(validation.data, null, 2)}\n`;
  const tempPath = uniqueTempPath(filePath);

  try {
    await fs.writeFile(tempPath, content, "utf-8");
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => undefined);
    throw error;
  }

  return { path: filePath, backupPath };
}
