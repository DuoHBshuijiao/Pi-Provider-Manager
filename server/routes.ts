import { Hono } from "hono";
import { API_TYPES } from "../shared/builtins.js";
import {
  validateModelsConfig,
  type ModelsConfig,
} from "../shared/schema.js";
import type { FetchRemoteModelsRequest } from "../shared/remote-models.js";
import {
  readConfig,
  resolveAuthJsonPath,
  resolveBackupDir,
  resolveModelsJsonPath,
  revealAgentFile,
  writeConfig,
  type RevealTarget,
} from "./config-store.js";
import { getEffectiveCatalog } from "./pi-catalog.js";
import { fetchRemoteModels } from "./remote-models.js";
import {
  disableLongCache,
  enableLongCache,
  getLongCacheStatus,
  markLongCacheModelsPersisted,
} from "./long-cache-store.js";
import type { FieldPatch } from "../shared/long-cache.js";

export const api = new Hono();

api.get("/meta", async (c) => {
  const catalog = await getEffectiveCatalog();
  return c.json({
    modelsJsonPath: resolveModelsJsonPath(),
    authJsonPath: resolveAuthJsonPath(),
    backupDir: resolveBackupDir(),
    apiTypes: API_TYPES,
    builtinProviders: catalog.providers.map((provider) => provider.id),
    builtinCatalog: catalog.providers,
    piVersion: catalog.piVersion,
  });
});

api.post("/reveal", async (c) => {
  try {
    const body = (await c.req.json()) as { target?: string };
    if (body.target !== "auth" && body.target !== "models") {
      return c.json({ error: "未知目标" }, 400);
    }
    const filePath = revealAgentFile(body.target as RevealTarget);
    return c.json({ ok: true, path: filePath });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "无法打开文件" },
      400,
    );
  }
});

api.get("/config", async (c) => {
  try {
    await getEffectiveCatalog();
    const result = await readConfig();
    return c.json(result);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "读取配置失败" },
      500,
    );
  }
});

api.put("/config", async (c) => {
  try {
    await getEffectiveCatalog();
    const body = (await c.req.json()) as { config?: ModelsConfig };
    if (!body.config) {
      return c.json({ error: "缺少 config 字段" }, 400);
    }

    const result = await writeConfig(body.config);
    return c.json({
      ok: true,
      path: result.path,
      backupPath: result.backupPath,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "保存配置失败" },
      400,
    );
  }
});

api.post("/remote-models", async (c) => {
  try {
    await getEffectiveCatalog();
    const body = (await c.req.json()) as FetchRemoteModelsRequest;
    const result = await fetchRemoteModels(body ?? {});
    return c.json(result);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "拉取云端模型失败" },
      400,
    );
  }
});

function parseFieldPatches(raw: unknown): FieldPatch[] {
  if (!Array.isArray(raw)) return [];
  const patches: FieldPatch[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    if (!Array.isArray(rec.path) || rec.path[0] !== "providers") continue;
    const path: Array<string | number> = [];
    let valid = true;
    for (const seg of rec.path) {
      if (typeof seg === "number" && Number.isInteger(seg) && seg >= 0) path.push(seg);
      else if (typeof seg === "string" && seg.length > 0) path.push(seg);
      else {
        valid = false;
        break;
      }
    }
    if (!valid) continue;
    patches.push({
      path,
      before: rec.before === undefined ? null : rec.before,
      after: rec.after,
    });
  }
  return patches;
}

api.get("/cache-retention", async (c) => {
  try {
    return c.json(await getLongCacheStatus());
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "读取长缓存状态失败" },
      500,
    );
  }
});

api.put("/cache-retention", async (c) => {
  try {
    const body = (await c.req.json()) as {
      action?: string;
      modelsPatches?: unknown;
    };
    if (body.action === "enable") {
      const status = await enableLongCache(parseFieldPatches(body.modelsPatches));
      return c.json({ ok: true, status });
    }
    if (body.action === "disable") {
      const result = await disableLongCache();
      return c.json({ ok: true, ...result });
    }
    if (body.action === "mark-persisted") {
      const status = await markLongCacheModelsPersisted();
      return c.json({ ok: true, status });
    }
    return c.json({ error: "未知 action" }, 400);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "更新长缓存失败" },
      400,
    );
  }
});

api.post("/validate", async (c) => {
  try {
    const body = (await c.req.json()) as { config?: unknown };
    if (!body.config) {
      return c.json({ error: "缺少 config 字段" }, 400);
    }

    const catalog = await getEffectiveCatalog();
    const result = validateModelsConfig(body.config, {
      builtinIds: catalog.providers.map((provider) => provider.id),
    });
    return c.json({
      success: result.success,
      issues: result.issues,
      data: result.data ?? null,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "校验失败" },
      400,
    );
  }
});
