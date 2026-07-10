import { z } from "zod";
import { API_TYPES, isBuiltinProvider } from "./builtins.js";

const costSchema = z.object({
  input: z.number(),
  output: z.number(),
  cacheRead: z.number(),
  cacheWrite: z.number(),
});

const thinkingLevelMapSchema = z.record(
  z.string(),
  z.union([z.string(), z.null()]),
);

const compatSchema = z
  .record(z.string(), z.unknown())
  .optional();

export const modelDefinitionSchema = z.object({
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
  compat: compatSchema,
});

export const modelOverrideSchema = z.object({
  name: z.string().min(1).optional(),
  reasoning: z.boolean().optional(),
  thinkingLevelMap: thinkingLevelMapSchema.optional(),
  input: z.array(z.enum(["text", "image"])).optional(),
  cost: costSchema.partial().optional(),
  contextWindow: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  compat: compatSchema,
});

export const providerConfigSchema = z.object({
  baseUrl: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  api: z.enum(API_TYPES).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  compat: compatSchema,
  authHeader: z.boolean().optional(),
  models: z.array(modelDefinitionSchema).optional(),
  modelOverrides: z.record(z.string(), modelOverrideSchema).optional(),
});

export const modelsConfigSchema = z.object({
  providers: z.record(z.string(), providerConfigSchema),
});

export type Cost = z.infer<typeof costSchema>;
export type ModelDefinition = z.infer<typeof modelDefinitionSchema>;
export type ModelOverride = z.infer<typeof modelOverrideSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type ModelsConfig = z.infer<typeof modelsConfigSchema>;

export interface ValidationIssue {
  path: string;
  message: string;
}

export function validateModelsConfig(config: unknown): {
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
    const builtin = isBuiltinProvider(providerName);
    const hasModels = (providerConfig.models?.length ?? 0) > 0;

    if (!builtin && hasModels) {
      const providerHasApi = Boolean(providerConfig.api);
      const providerHasBaseUrl = Boolean(providerConfig.baseUrl);

      if (!providerHasApi || !providerHasBaseUrl) {
        for (const [index, model] of (providerConfig.models ?? []).entries()) {
          const modelHasApi = Boolean(model.api ?? providerConfig.api);
          const modelHasBaseUrl = Boolean(model.baseUrl ?? providerConfig.baseUrl);
          if (!modelHasApi || !modelHasBaseUrl) {
            issues.push({
              path: `providers.${providerName}.models.${index}`,
              message: `第三方 Provider "${providerName}" 的模型需要 provider 或 model 级 baseUrl 与 api`,
            });
          }
        }
      }
    }

    for (const [index, model] of (providerConfig.models ?? []).entries()) {
      if (!model.id.trim()) {
        issues.push({
          path: `providers.${providerName}.models.${index}.id`,
          message: "模型 id 不能为空",
        });
      }
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

export function createDefaultModel(): ModelDefinition {
  return {
    id: "",
    name: "",
    reasoning: false,
    input: ["text"],
    contextWindow: 128000,
    maxTokens: 16384,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
}

export function createDefaultProvider(): ProviderConfig {
  return {
    baseUrl: "",
    api: "openai-completions",
    apiKey: "",
    authHeader: false,
    models: [],
    modelOverrides: {},
    compat: {},
  };
}
