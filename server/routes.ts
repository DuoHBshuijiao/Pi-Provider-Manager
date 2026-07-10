import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  API_TYPES,
  BUILTIN_PROVIDERS,
} from "../shared/builtins.js";
import {
  validateModelsConfig,
  type ModelsConfig,
} from "../shared/schema.js";
import { readConfig, resolveBackupDir, resolveModelsJsonPath, writeConfig } from "./config-store.js";

export const api = new Hono();

api.use(
  "/*",
  cors({
    origin: "*",
  }),
);

api.get("/meta", (c) => {
  return c.json({
    modelsJsonPath: resolveModelsJsonPath(),
    backupDir: resolveBackupDir(),
    apiTypes: API_TYPES,
    builtinProviders: BUILTIN_PROVIDERS,
  });
});

api.get("/config", async (c) => {
  try {
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

api.post("/validate", async (c) => {
  try {
    const body = (await c.req.json()) as { config?: unknown };
    if (!body.config) {
      return c.json({ error: "缺少 config 字段" }, 400);
    }

    const result = validateModelsConfig(body.config);
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

