import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  createEmptyConfig,
  type ModelsConfig,
  validateModelsConfig,
} from "../shared/schema.js";

export function resolveModelsJsonPath(): string {
  const home = os.homedir();
  return path.join(home, ".pi", "agent", "models.json");
}

export function resolveBackupDir(): string {
  const home = os.homedir();
  return path.join(home, ".pi", "agent", "backups");
}

function formatBackupName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `models-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export interface ConfigReadResult {
  path: string;
  exists: boolean;
  config: ModelsConfig;
  raw: string;
}

export async function readConfig(): Promise<ConfigReadResult> {
  const filePath = resolveModelsJsonPath();

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const validation = validateModelsConfig(parsed);

    if (!validation.success || !validation.data) {
      throw new Error(
        validation.issues.map((i) => `${i.path}: ${i.message}`).join("; ") ||
          "配置格式无效",
      );
    }

    return {
      path: filePath,
      exists: true,
      config: validation.data,
      raw,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        path: filePath,
        exists: false,
        config: createEmptyConfig(),
        raw: JSON.stringify(createEmptyConfig(), null, 2),
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
  const tempPath = `${filePath}.tmp`;

  await fs.writeFile(tempPath, content, "utf-8");
  await fs.rename(tempPath, filePath);

  return { path: filePath, backupPath };
}
