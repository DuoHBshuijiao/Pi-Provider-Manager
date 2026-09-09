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
