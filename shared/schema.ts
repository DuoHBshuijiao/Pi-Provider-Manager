import { z } from "zod";
import { API_TYPES, TRANSPORT_TYPES, isBuiltinProvider } from "./builtins.js";

const costSchema = z
  .object({
    input: z.number().optional(),
    output: z.number().optional(),
    cacheRead: z.number().optional(),
    cacheWrite: z.number().optional(),
  })
  .passthrough();

const thinkingLevelMapSchema = z.record(
  z.string(),
  z.union([z.string(), z.null()]),
);

const compatSchema = z.record(z.string(), z.unknown()).optional();

export const modelDefinitionSchema = z
  .object({
    id: z.string().min(1, "模型 id 不能为空"),
    name: z.string().min(1).optional(),
    api: z.string().min(1).optional(),
    baseUrl: z.string().min(1).optional(),
    reasoning: z.boolean().optional(),
    thinkingLevelMap: thinkingLevelMapSchema.optional(),
    input: z.array(z.enum(["text", "image"])).optional(),
    contextWindow: z.number().int().positive().optional(),
    maxTokens: z.number().int().positive().optional(),
    cost: costSchema.optional(),
    headers: z.record(z.string(), z.string()).optional(),
    transport: z.enum(TRANSPORT_TYPES).optional(),
    compat: compatSchema,
  })
  .passthrough();

export const modelOverrideSchema = z
  .object({
    name: z.string().min(1).optional(),
    reasoning: z.boolean().optional(),
    thinkingLevelMap: thinkingLevelMapSchema.optional(),
    input: z.array(z.enum(["text", "image"])).optional(),
    cost: costSchema.partial().optional(),
    contextWindow: z.number().int().positive().optional(),
    maxTokens: z.number().int().positive().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    transport: z.enum(TRANSPORT_TYPES).optional(),
    compat: compatSchema,
  })
  .passthrough();

export const providerConfigSchema = z
  .object({
    baseUrl: z.string().min(1).optional(),
    apiKey: z.string().min(1).optional(),
    api: z.enum(API_TYPES).or(z.string().min(1)).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    compat: compatSchema,
    authHeader: z.boolean().optional(),
    models: z.array(modelDefinitionSchema).optional(),
    modelOverrides: z.record(z.string(), modelOverrideSchema).optional(),
  })
  .passthrough();

export const modelsConfigSchema = z
  .object({
    providers: z.record(z.string(), providerConfigSchema),
  })
  .passthrough();

export type Cost = z.infer<typeof costSchema>;
export type ModelDefinition = z.infer<typeof modelDefinitionSchema>;
export type ModelOverride = z.infer<typeof modelOverrideSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type ModelsConfig = z.infer<typeof modelsConfigSchema>;

export interface ValidationIssue {
  path: string;
  message: string;
}

const BASE_URL_ISSUE = "Base URL 必须是 http:// 或 https:// 开头的完整地址";

/** 已填写的 baseUrl 必须带 http(s)；留空合法（内建 overlay 靠 Pi 查表）。 */
export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function pushBaseUrlIssue(
  issues: ValidationIssue[],
  path: string,
  value: string | undefined,
) {
  if (value == null || !String(value).trim()) return;
  if (!isHttpUrl(value)) {
    issues.push({ path, message: BASE_URL_ISSUE });
  }
}

function isBuiltinName(name: string, builtinIds?: Iterable<string>): boolean {
  if (!builtinIds) return isBuiltinProvider(name);
  const ids = builtinIds instanceof Set ? builtinIds : new Set(builtinIds);
  return ids.has(name);
}

/** 内建 overlay 的 baseUrl 从空变为已填时，会覆盖 Pi 官方根地址。 */
export function newlyFilledBuiltinBaseUrls(
  saved: ModelsConfig,
  next: ModelsConfig,
  builtinIds?: Iterable<string>,
): string[] {
  const names: string[] = [];
  for (const [name, provider] of Object.entries(next.providers)) {
    if (!isBuiltinName(name, builtinIds)) continue;
    const wasEmpty = !String(saved.providers[name]?.baseUrl ?? "").trim();
    const nowFilled = Boolean(String(provider.baseUrl ?? "").trim());
    if (wasEmpty && nowFilled) names.push(name);
  }
  return names;
}

export function validateModelsConfig(
  config: unknown,
  options?: { builtinIds?: Iterable<string> },
): {
  success: boolean;
  data?: ModelsConfig;
  issues: ValidationIssue[];
} {
  const result = modelsConfigSchema.safeParse(config);
  if (!result.success) {
    return {
      success: false,
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  const issues: ValidationIssue[] = [];
  const data = result.data;

  for (const [providerName, providerConfig] of Object.entries(data.providers)) {
    const builtin = isBuiltinName(providerName, options?.builtinIds);
    const hasModels = (providerConfig.models?.length ?? 0) > 0;
    const at = `providers.${providerName}`;

    pushBaseUrlIssue(issues, `${at}.baseUrl`, providerConfig.baseUrl);

    if (!builtin && hasModels) {
      const providerHasApi = Boolean(providerConfig.api);
      const providerHasBaseUrl = Boolean(providerConfig.baseUrl);

      if (!providerHasApi || !providerHasBaseUrl) {
        for (const [index, model] of (providerConfig.models ?? []).entries()) {
          const modelHasApi = Boolean(model.api ?? providerConfig.api);
          const modelHasBaseUrl = Boolean(model.baseUrl ?? providerConfig.baseUrl);
          if (!modelHasApi || !modelHasBaseUrl) {
            issues.push({
              path: `${at}.models.${index}`,
              message: `第三方 Provider "${providerName}" 的模型需要 provider 或 model 级 baseUrl 与 api`,
            });
          }
        }
      }
    }

    for (const [index, model] of (providerConfig.models ?? []).entries()) {
      const mAt = `${at}.models.${index}`;
      if (!model.id.trim()) {
        issues.push({
          path: `${mAt}.id`,
          message: "模型 id 不能为空",
        });
      }
      pushBaseUrlIssue(issues, `${mAt}.baseUrl`, model.baseUrl);
    }
  }

  if (issues.length > 0) {
    return { success: false, data, issues };
  }

  return { success: true, data, issues: [] };
}

export function createEmptyConfig(): ModelsConfig {
  return { providers: {} };
}

/** 新建模型的最小模板；编辑已有模型时不要用此函数回填默认值 */
export function createDefaultModel(): ModelDefinition {
  return {
    id: "",
  };
}

export function createDefaultProvider(): ProviderConfig {
  return {
    api: "openai-completions",
  };
}
