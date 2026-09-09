import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  API_TYPES,
  cloneSeedCatalog,
  setBuiltinCatalog,
  type BuiltinModelInfo,
  type BuiltinProviderInfo,
} from "../shared/builtins.js";
import { resolveAgentDir } from "./config-store.js";

const execFileAsync = promisify(execFile);
const VERSION_TTL_MS = 5_000;
const COMMAND_TIMEOUT_MS = 8_000;
const SKIPPED_PROVIDER_IDS = new Set(["radius"]);

export interface EffectiveCatalog {
  piVersion: string | null;
  providers: BuiltinProviderInfo[];
}

interface CatalogCacheFile {
  piVersion: string | null;
  updatedAt: string;
  source?: string;
  providers: BuiltinProviderInfo[];
}

let memory: EffectiveCatalog | null = null;
let versionCache: { value: string | null; at: number } | null = null;
let inflight: Promise<EffectiveCatalog> | null = null;

function resolveCatalogCachePath(): string {
  return path.join(resolveAgentDir(), "provider-manager-catalog.json");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runCapture(command: string, args: string[]): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: COMMAND_TIMEOUT_MS,
      windowsHide: true,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      env: process.env,
    });
    return `${stdout}\n${stderr}`;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    return `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
  }
}

function parseVersion(text: string): string | null {
  const match = text.match(/\b(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/);
  return match?.[1] ?? null;
}

async function detectPiVersion(): Promise<string | null> {
  const now = Date.now();
  if (versionCache && now - versionCache.at < VERSION_TTL_MS) {
    return versionCache.value;
  }

  const isWin = process.platform === "win32";
  const bins = isWin ? ["pi.cmd", "pi"] : ["pi"];
  for (const bin of bins) {
    for (const flag of ["--version", "-v"] as const) {
      const parsed = parseVersion(await runCapture(bin, [flag]));
      if (parsed) {
        versionCache = { value: parsed, at: now };
        return parsed;
      }
    }
  }

  if (isWin) {
    const parsed = parseVersion(await runCapture(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "pi --version"]));
    if (parsed) {
      versionCache = { value: parsed, at: now };
      return parsed;
    }
  }

  versionCache = { value: null, at: now };
  return null;
}

async function isPiAiPackage(dir: string): Promise<boolean> {
  try {
    const raw = await fs.readFile(path.join(dir, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { name?: string };
    return pkg.name === "@earendil-works/pi-ai";
  } catch {
    return false;
  }
}

async function resolvePiAiRoot(): Promise<string | null> {
  const candidates: string[] = [];
  const isWin = process.platform === "win32";
  const npmBin = isWin ? "npm.cmd" : "npm";

  const npmRoot = (await runCapture(npmBin, ["root", "-g"])).trim().split(/\r?\n/)[0]?.trim();
  if (npmRoot) {
    candidates.push(
      path.join(npmRoot, "@earendil-works", "pi-ai"),
      path.join(npmRoot, "@earendil-works", "pi-coding-agent", "node_modules", "@earendil-works", "pi-ai"),
    );
  }

  const locator = isWin ? "where.exe" : "which";
  const located = await runCapture(locator, ["pi"]);
  for (const line of located.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    let dir = path.dirname(line);
    for (let i = 0; i < 8; i += 1) {
      candidates.push(
        path.join(dir, "node_modules", "@earendil-works", "pi-ai"),
        path.join(dir, "@earendil-works", "pi-ai"),
      );
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  for (const candidate of candidates) {
    if (await isPiAiPackage(candidate)) return candidate;
  }
  return null;
}

function flattenModelData(raw: unknown): { models: BuiltinModelInfo[]; api?: string } {
  const rec = asRecord(raw);
  if (!rec) return { models: [] };

  const knownApis = API_TYPES as readonly string[];
  const apiKey = Object.keys(rec).find((key) => knownApis.includes(key)) ?? Object.keys(rec)[0];
  const models: BuiltinModelInfo[] = [];
  const seen = new Set<string>();

  for (const group of Object.values(rec)) {
    const groupRec = asRecord(group);
    if (!groupRec) continue;
    for (const [id, def] of Object.entries(groupRec)) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const record = asRecord(def);
      const name = typeof record?.name === "string" ? record.name : undefined;
      models.push(name ? { id, name } : { id });
    }
  }

  return {
    models,
    api: apiKey && knownApis.includes(apiKey) ? apiKey : undefined,
  };
}

function parseProviderSource(source: string): { id?: string; name?: string; baseUrl?: string } {
  const block = source.match(/createProvider\(\s*\{([\s\S]{0,4000})\}/);
  const blob = block?.[1] ?? source;
  return {
    id: blob.match(/\bid\s*:\s*["']([^"']+)["']/)?.[1],
    name: blob.match(/\bname\s*:\s*["']([^"']+)["']/)?.[1],
    baseUrl: blob.match(/\bbaseUrl\s*:\s*["']([^"']+)["']/)?.[1],
  };
}

function parseEnvKeyMap(source: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const envMap = source.match(/const envMap[\s\S]*?=\s*\{([\s\S]*?)\}\s*;/);
  const blob = envMap?.[1] ?? "";
  const pair = /["']([a-z0-9-]+)["']\s*:\s*["']([A-Z0-9_]+)["']/g;
  for (const match of blob.matchAll(pair)) {
    const id = match[1];
    const env = match[2];
    if (!id || !env) continue;
    const current = map.get(id) ?? [];
    if (!current.includes(env)) current.push(env);
    map.set(id, current);
  }
  if (source.includes("github-copilot")) {
    map.set("github-copilot", ["COPILOT_GITHUB_TOKEN"]);
  }
  if (source.includes("ANTHROPIC_API_KEY")) {
    map.set("anthropic", ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_OAUTH_TOKEN", "ANTHROPIC_API_KEY"]);
  }
  return map;
}

function mergeWithSeed(
  parsed: BuiltinProviderInfo[],
  envKeys: Map<string, string[]>,
): BuiltinProviderInfo[] {
  const seedById = new Map(cloneSeedCatalog().map((provider) => [provider.id, provider]));
  const seen = new Set<string>();
  const out: BuiltinProviderInfo[] = [];

  for (const provider of parsed) {
    if (SKIPPED_PROVIDER_IDS.has(provider.id)) continue;
    seen.add(provider.id);
    const seed = seedById.get(provider.id);
    const keys = seed?.envKeys ?? envKeys.get(provider.id);
    const listModels = seed?.listModels ?? (provider.baseUrl ? undefined : false);
    out.push({
      id: provider.id,
      name: provider.name || seed?.name || provider.id,
      baseUrl: provider.baseUrl ?? seed?.baseUrl,
      api: provider.api ?? seed?.api,
      ...(keys && keys.length > 0 ? { envKeys: [...keys] } : {}),
      ...(listModels === undefined ? {} : { listModels }),
      models: provider.models ?? [],
    });
  }

  for (const seed of seedById.values()) {
    if (seen.has(seed.id)) continue;
    out.push(seed);
  }

  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

async function parseLocalPiAi(root: string): Promise<BuiltinProviderInfo[]> {
  const dataDirCandidates = [
    path.join(root, "dist", "providers", "data"),
    path.join(root, "src", "providers", "data"),
  ];
  const providersDirCandidates = [
    path.join(root, "dist", "providers"),
    path.join(root, "src", "providers"),
  ];
  const envKeyCandidates = [
    path.join(root, "dist", "env-api-keys.js"),
    path.join(root, "src", "env-api-keys.ts"),
  ];

  const modelsByProvider = new Map<string, { models: BuiltinModelInfo[]; api?: string }>();
  for (const dataDir of dataDirCandidates) {
    if (!(await pathExists(dataDir))) continue;
    const files = await fs.readdir(dataDir);
    for (const file of files) {
      if (!file.endsWith(".json") || file.startsWith(".")) continue;
      const id = file.slice(0, -".json".length);
      if (!id || SKIPPED_PROVIDER_IDS.has(id)) continue;
      try {
        const raw = JSON.parse(await fs.readFile(path.join(dataDir, file), "utf8")) as unknown;
        modelsByProvider.set(id, flattenModelData(raw));
      } catch {
        // skip unreadable catalog files
      }
    }
    if (modelsByProvider.size > 0) break;
  }

  let envKeys = new Map<string, string[]>();
  for (const envPath of envKeyCandidates) {
    if (!(await pathExists(envPath))) continue;
    try {
      envKeys = parseEnvKeyMap(await fs.readFile(envPath, "utf8"));
      if (envKeys.size > 0) break;
    } catch {
      // ignore
    }
  }

  const parsed: BuiltinProviderInfo[] = [];
  const seen = new Set<string>();
  for (const providersDir of providersDirCandidates) {
    if (!(await pathExists(providersDir))) continue;
    const entries = await fs.readdir(providersDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const file = entry.name;
      if (!/\.(js|ts)$/i.test(file)) continue;
      if (/^(all|index)\.(js|ts)$/i.test(file)) continue;
      if (/\.models\.(js|ts)$/i.test(file)) continue;
      if (/image/i.test(file)) continue;
      const source = await fs.readFile(path.join(providersDir, file), "utf8");
      const meta = parseProviderSource(source);
      const id = meta.id;
      if (!id || SKIPPED_PROVIDER_IDS.has(id) || /image/i.test(id) || seen.has(id)) continue;
      seen.add(id);
      const fromData = modelsByProvider.get(id);
      parsed.push({
        id,
        name: meta.name ?? id,
        ...(meta.baseUrl ? { baseUrl: meta.baseUrl } : {}),
        ...(fromData?.api ? { api: fromData.api } : {}),
        models: fromData?.models ?? [],
      });
    }
    if (parsed.length > 0) break;
  }

  for (const [id, fromData] of modelsByProvider) {
    if (SKIPPED_PROVIDER_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    parsed.push({
      id,
      name: id,
      ...(fromData.api ? { api: fromData.api } : {}),
      models: fromData.models,
    });
  }

  if (parsed.length === 0) return [];
  return mergeWithSeed(parsed, envKeys);
}

function parseCache(raw: unknown): CatalogCacheFile | null {
  const rec = asRecord(raw);
  if (!rec || !Array.isArray(rec.providers)) return null;
  const providers: BuiltinProviderInfo[] = [];
  for (const item of rec.providers) {
    const provider = asRecord(item);
    if (!provider || typeof provider.id !== "string" || !provider.id.trim()) continue;
    const models: BuiltinModelInfo[] = [];
    if (Array.isArray(provider.models)) {
      for (const model of provider.models) {
        const record = asRecord(model);
        if (!record || typeof record.id !== "string" || !record.id) continue;
        models.push(typeof record.name === "string" ? { id: record.id, name: record.name } : { id: record.id });
      }
    }
    const envKeys = Array.isArray(provider.envKeys)
      ? provider.envKeys.filter((key): key is string => typeof key === "string")
      : undefined;
    providers.push({
      id: provider.id,
      name: typeof provider.name === "string" && provider.name ? provider.name : provider.id,
      ...(typeof provider.baseUrl === "string" ? { baseUrl: provider.baseUrl } : {}),
      ...(typeof provider.api === "string" ? { api: provider.api } : {}),
      ...(envKeys && envKeys.length > 0 ? { envKeys } : {}),
      ...(typeof provider.listModels === "boolean" ? { listModels: provider.listModels } : {}),
      models,
    });
  }
  if (providers.length === 0) return null;
  return {
    piVersion: typeof rec.piVersion === "string" ? rec.piVersion : null,
    updatedAt: typeof rec.updatedAt === "string" ? rec.updatedAt : "",
    source: typeof rec.source === "string" ? rec.source : undefined,
    providers,
  };
}

async function readCache(): Promise<CatalogCacheFile | null> {
  try {
    const raw = JSON.parse(await fs.readFile(resolveCatalogCachePath(), "utf8")) as unknown;
    return parseCache(raw);
  } catch {
    return null;
  }
}

async function writeCache(cache: CatalogCacheFile): Promise<void> {
  const filePath = resolveCatalogCachePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

function applyCatalog(providers: BuiltinProviderInfo[]): void {
  setBuiltinCatalog(providers);
}

async function loadCatalog(): Promise<EffectiveCatalog> {
  const version = await detectPiVersion();

  if (memory && memory.piVersion === version && version !== null) {
    applyCatalog(memory.providers);
    return memory;
  }

  const disk = await readCache();

  if (version === null) {
    const providers = disk?.providers?.length ? disk.providers : cloneSeedCatalog();
    applyCatalog(providers);
    memory = { piVersion: disk?.piVersion ?? null, providers };
    return memory;
  }

  if (disk && disk.piVersion === version && disk.providers.length > 0) {
    applyCatalog(disk.providers);
    memory = { piVersion: version, providers: disk.providers };
    return memory;
  }

  const root = await resolvePiAiRoot();
  let providers: BuiltinProviderInfo[] | undefined;
  if (root) {
    try {
      providers = await parseLocalPiAi(root);
    } catch (error) {
      console.warn("[pi-catalog] failed to parse local pi-ai:", error);
    }
  }

  if (!providers?.length) {
    const fallback = disk?.providers?.length ? disk.providers : cloneSeedCatalog();
    applyCatalog(fallback);
    memory = { piVersion: version, providers: fallback };
    return memory;
  }

  applyCatalog(providers);
  try {
    await writeCache({
      piVersion: version,
      updatedAt: new Date().toISOString(),
      source: root ?? undefined,
      providers,
    });
  } catch (error) {
    console.warn("[pi-catalog] failed to write catalog cache:", error);
  }
  memory = { piVersion: version, providers };
  return memory;
}

export async function getEffectiveCatalog(): Promise<EffectiveCatalog> {
  if (inflight) return inflight;
  inflight = loadCatalog().finally(() => {
    inflight = null;
  });
  return inflight;
}
