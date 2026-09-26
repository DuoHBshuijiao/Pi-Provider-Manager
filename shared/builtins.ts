/** Pi 内建 Provider 名录（对齐 earendil-works/pi `packages/ai/src/providers`） */
export interface BuiltinModelInfo {
  id: string;
  name?: string;
}

export interface BuiltinProviderInfo {
  id: string;
  name: string;
  baseUrl?: string;
  /** 拉目录用的默认协议；仅在属于本工具已知 API 类型时填写 */
  api?: string;
  envKeys?: readonly string[];
  /** 是否存在可 GET 的公开模型目录。缺省：有 baseUrl 则为 true */
  listModels?: boolean;
  models?: readonly BuiltinModelInfo[];
}

export const BUILTIN_PROVIDER_CATALOG = [
  { id: "amazon-bedrock", name: "Amazon Bedrock", listModels: false },
  {
    id: "ant-ling",
    name: "Ant Ling",
    baseUrl: "https://api.ant-ling.com/v1",
    api: "openai-completions",
    envKeys: ["ANT_LING_API_KEY"],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    api: "anthropic-messages",
    envKeys: ["ANTHROPIC_API_KEY", "ANTHROPIC_OAUTH_TOKEN", "ANTHROPIC_AUTH_TOKEN"],
  },
  { id: "azure-openai-responses", name: "Azure OpenAI", envKeys: ["AZURE_OPENAI_API_KEY"], listModels: false },
  {
    id: "baseten",
    name: "Baseten",
    baseUrl: "https://inference.baseten.co/v1",
    api: "openai-completions",
    envKeys: ["BASETEN_API_KEY"],
  },
  {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    api: "openai-completions",
    envKeys: ["CEREBRAS_API_KEY"],
  },
  { id: "cloudflare-ai-gateway", name: "Cloudflare AI Gateway", envKeys: ["CLOUDFLARE_API_KEY"], listModels: false },
  { id: "cloudflare-workers-ai", name: "Cloudflare Workers AI", envKeys: ["CLOUDFLARE_API_KEY"], listModels: false },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    api: "openai-completions",
    envKeys: ["DEEPSEEK_API_KEY"],
  },
  {
    id: "fireworks",
    name: "Fireworks",
    baseUrl: "https://api.fireworks.ai/inference",
    api: "openai-completions",
    envKeys: ["FIREWORKS_API_KEY"],
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    baseUrl: "https://api.individual.githubcopilot.com",
    api: "openai-completions",
    envKeys: ["COPILOT_GITHUB_TOKEN"],
  },
  {
    id: "google",
    name: "Google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    api: "google-generative-ai",
    envKeys: ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"],
  },
  { id: "google-vertex", name: "Google Vertex AI", envKeys: ["GOOGLE_CLOUD_API_KEY"], listModels: false },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    api: "openai-completions",
    envKeys: ["GROQ_API_KEY"],
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    baseUrl: "https://router.huggingface.co/v1",
    api: "openai-completions",
    envKeys: ["HF_TOKEN", "HUGGINGFACE_API_KEY"],
  },
  {
    id: "kimi-coding",
    name: "Kimi For Coding",
    baseUrl: "https://api.kimi.com/coding",
    api: "anthropic-messages",
    envKeys: ["KIMI_API_KEY", "MOONSHOT_API_KEY"],
  },
  {
    id: "minimax",
    name: "MiniMax",
    baseUrl: "https://api.minimax.io/anthropic",
    api: "anthropic-messages",
    envKeys: ["MINIMAX_API_KEY"],
  },
  {
    id: "minimax-cn",
    name: "MiniMax CN",
    baseUrl: "https://api.minimaxi.com/anthropic",
    api: "anthropic-messages",
    envKeys: ["MINIMAX_CN_API_KEY", "MINIMAX_API_KEY"],
  },
  {
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai",
    envKeys: ["MISTRAL_API_KEY"],
  },
  {
    id: "moonshotai",
    name: "Moonshot AI",
    baseUrl: "https://api.moonshot.ai/v1",
    api: "openai-completions",
    envKeys: ["MOONSHOT_API_KEY"],
  },
  {
    id: "moonshotai-cn",
    name: "Moonshot AI CN",
    baseUrl: "https://api.moonshot.cn/v1",
    api: "openai-completions",
    envKeys: ["MOONSHOT_API_KEY"],
  },
  {
    id: "nvidia",
    name: "NVIDIA",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    api: "openai-completions",
    envKeys: ["NVIDIA_API_KEY"],
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    api: "openai-responses",
    envKeys: ["OPENAI_API_KEY"],
  },
  {
    id: "openai-codex",
    name: "OpenAI Codex",
    baseUrl: "https://chatgpt.com/backend-api",
    envKeys: ["OPENAI_API_KEY"],
    listModels: false,
  },
  { id: "opencode", name: "OpenCode Zen", envKeys: ["OPENCODE_API_KEY"], listModels: false },
  { id: "opencode-go", name: "OpenCode Go", envKeys: ["OPENCODE_API_KEY"], listModels: false },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    api: "openai-completions",
    envKeys: ["OPENROUTER_API_KEY"],
  },
  {
    id: "qwen-token-plan",
    name: "Qwen Token Plan",
    baseUrl: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
    api: "openai-completions",
    envKeys: ["QWEN_TOKEN_PLAN_API_KEY"],
  },
  {
    id: "qwen-token-plan-cn",
    name: "Qwen Token Plan CN",
    baseUrl: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
    api: "openai-completions",
    envKeys: ["QWEN_TOKEN_PLAN_CN_API_KEY"],
  },
  {
    id: "qwen-token-plan-individual",
    name: "Qwen Token Plan Individual",
    baseUrl: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
    api: "openai-completions",
    envKeys: ["QWEN_TOKEN_PLAN_API_KEY"],
  },
  {
    id: "together",
    name: "Together",
    baseUrl: "https://api.together.ai/v1",
    api: "openai-completions",
    envKeys: ["TOGETHER_API_KEY"],
  },
  {
    id: "vercel-ai-gateway",
    name: "Vercel AI Gateway",
    baseUrl: "https://ai-gateway.vercel.sh",
    api: "anthropic-messages",
    envKeys: ["AI_GATEWAY_API_KEY"],
  },
  {
    id: "xai",
    name: "xAI",
    baseUrl: "https://api.x.ai/v1",
    api: "openai-responses",
    envKeys: ["XAI_API_KEY"],
  },
  {
    id: "xiaomi",
    name: "Xiaomi",
    baseUrl: "https://api.xiaomimimo.com/v1",
    api: "openai-completions",
    envKeys: ["XIAOMI_API_KEY"],
  },
  {
    id: "xiaomi-token-plan-ams",
    name: "Xiaomi Token Plan AMS",
    baseUrl: "https://token-plan-ams.xiaomimimo.com/v1",
    api: "openai-completions",
    envKeys: ["XIAOMI_TOKEN_PLAN_AMS_API_KEY"],
  },
  {
    id: "xiaomi-token-plan-cn",
    name: "Xiaomi Token Plan CN",
    baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
    api: "openai-completions",
    envKeys: ["XIAOMI_TOKEN_PLAN_CN_API_KEY"],
  },
  {
    id: "xiaomi-token-plan-sgp",
    name: "Xiaomi Token Plan SGP",
    baseUrl: "https://token-plan-sgp.xiaomimimo.com/v1",
    api: "openai-completions",
    envKeys: ["XIAOMI_TOKEN_PLAN_SGP_API_KEY"],
  },
  {
    id: "zai",
    name: "Z.AI",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    api: "openai-completions",
    envKeys: ["ZAI_API_KEY", "Z_AI_API_KEY"],
  },
  {
    id: "zai-coding-cn",
    name: "Z.AI Coding CN",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    api: "openai-completions",
    envKeys: ["ZAI_CODING_CN_API_KEY", "ZAI_API_KEY"],
  },
] as const satisfies readonly BuiltinProviderInfo[];

export const BUILTIN_PROVIDERS = BUILTIN_PROVIDER_CATALOG.map((provider) => provider.id);

export type BuiltinProvider = (typeof BUILTIN_PROVIDER_CATALOG)[number]["id"];

const BUILTIN_PROVIDER_BY_ID = new Map<string, BuiltinProviderInfo>(
  BUILTIN_PROVIDER_CATALOG.map((provider) => [provider.id, provider]),
);

let catalogOverride: readonly BuiltinProviderInfo[] | null = null;
let overrideById: Map<string, BuiltinProviderInfo> | null = null;

export function setBuiltinCatalog(catalog: readonly BuiltinProviderInfo[] | null): void {
  catalogOverride = catalog;
  overrideById = catalog
    ? new Map(catalog.map((provider) => [provider.id, provider]))
    : null;
}

export function getBuiltinCatalog(): readonly BuiltinProviderInfo[] {
  return catalogOverride ?? BUILTIN_PROVIDER_CATALOG;
}

export function cloneSeedCatalog(): BuiltinProviderInfo[] {
  return BUILTIN_PROVIDER_CATALOG.map((entry) => {
    const provider = entry as BuiltinProviderInfo;
    return {
      id: provider.id,
      name: provider.name,
      ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}),
      ...(provider.api ? { api: provider.api } : {}),
      ...(provider.envKeys ? { envKeys: [...provider.envKeys] } : {}),
      ...(provider.listModels === undefined ? {} : { listModels: provider.listModels }),
      models: [],
    };
  });
}

function catalogMap(): Map<string, BuiltinProviderInfo> {
  return overrideById ?? BUILTIN_PROVIDER_BY_ID;
}

export function getBuiltinProvider(name: string): BuiltinProviderInfo | undefined {
  return catalogMap().get(name);
}

export function isBuiltinProvider(name: string): boolean {
  return catalogMap().has(name);
}

export function findCatalogProvider(
  catalog: readonly BuiltinProviderInfo[] | undefined,
  id: string,
): BuiltinProviderInfo | undefined {
  return catalog?.find((provider) => provider.id === id);
}

export function builtinProviderLabel(id: string, catalog?: readonly BuiltinProviderInfo[]): string {
  const meta = catalog ? findCatalogProvider(catalog, id) : getBuiltinProvider(id);
  if (!meta || meta.name === id) return id;
  return `${meta.name} (${id})`;
}

export function builtinModelLabel(model: BuiltinModelInfo): string {
  if (model.name && model.name !== model.id) return `${model.name} (${model.id})`;
  return model.id;
}

export const API_TYPES = [
  "openai-completions",
  "openai-responses",
  "anthropic-messages",
  "google-generative-ai",
] as const;

export type ApiType = (typeof API_TYPES)[number];

export const TRANSPORT_TYPES = [
  "auto",
  "sse",
  "websocket",
  "websocket-cached",
] as const;

export type TransportType = (typeof TRANSPORT_TYPES)[number];

export const THINKING_LEVELS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export const COMPAT_BOOL_FIELDS = [
  "supportsStore",
  "supportsDeveloperRole",
  "supportsReasoningEffort",
  "supportsUsageInStreaming",
  "requiresToolResultName",
  "requiresAssistantAfterToolResult",
  "requiresThinkingAsText",
  "requiresReasoningContentOnAssistantMessages",
  "supportsStrictMode",
  "supportsLongCacheRetention",
  "supportsEagerToolInputStreaming",
  "sendSessionAffinityHeaders",
  "supportsCacheControlOnTools",
  "forceAdaptiveThinking",
  "allowEmptySignature",
] as const;

export type CompatBoolField = (typeof COMPAT_BOOL_FIELDS)[number];

export const COMPAT_LABELS: Record<string, string> = {
  supportsStore: "支持 store 字段",
  supportsDeveloperRole: "支持 developer 角色",
  supportsReasoningEffort: "支持 reasoning_effort",
  supportsUsageInStreaming: "流式返回 usage",
  requiresToolResultName: "工具结果需要 name",
  requiresAssistantAfterToolResult: "工具结果后需 assistant 消息",
  requiresThinkingAsText: "思考块转纯文本",
  requiresReasoningContentOnAssistantMessages: "assistant 消息需 reasoning_content",
  supportsStrictMode: "工具定义支持 strict",
  supportsLongCacheRetention: "允许发送长缓存字段",
  supportsEagerToolInputStreaming: "eager_input_streaming",
  sendSessionAffinityHeaders: "发送 x-session-affinity",
  supportsCacheControlOnTools: "工具定义 cache_control",
  forceAdaptiveThinking: "强制 adaptive thinking",
  allowEmptySignature: "允许空 thinking 签名",
};

/** 每项说明：默认 / 支持 / 不支持 时给用户的排障指引 */
export const COMPAT_HELP: Record<string, string> = {
  supportsStore:
    "Pi 是否向接口发送 store 相关字段。代理报未知字段时设为「不支持」。",
  supportsDeveloperRole:
    "推理模型默认可能用 developer 放系统提示。旧 OpenAI 兼容端只接受 system 时设为「不支持」。",
  supportsReasoningEffort:
    "Pi 是否向 OpenAI 兼容端发送 reasoning_effort。GPT-5.x 等推理模型通常开启；接口报未知字段时设为「不支持」。",
  supportsUsageInStreaming:
    "流式响应中是否包含 usage。代理不返回或解析失败时可设为「不支持」。",
  requiresToolResultName:
    "工具结果消息是否必须带 name。部分严格代理需要开启。",
  requiresAssistantAfterToolResult:
    "工具结果后是否必须跟一条 assistant 消息。对话格式报错时再改。",
  requiresThinkingAsText:
    "是否将思考块转为纯文本发送。代理不接受思考结构化字段时开启。",
  requiresReasoningContentOnAssistantMessages:
    "assistant 消息是否需要 reasoning_content。OpenAI 推理链路相关；不需要时保持默认。",
  supportsStrictMode:
    "工具定义是否支持 strict。代理拒绝该字段时设为「不支持」。",
  supportsLongCacheRetention:
    "仅表示接口是否接受长缓存字段，不是总开关。TUI/RPC 要发长缓存必须由顶栏「启用长缓存」选择 Pi 扩展或写入 PI_CACHE_RETENTION=long。Anthropic 对应 cache_control.ttl: \"1h\"；OpenAI 对应 prompt_cache_retention: \"24h\"。设为「支持」不会自己打开长缓存；代理拒绝该字段时设为「不支持」。",
  supportsEagerToolInputStreaming:
    "Anthropic 工具入参流式传输。若代理拒绝该字段，设为「不支持」。",
  sendSessionAffinityHeaders:
    "给中转站提供稳定会话标识，以提高同一后端路由与缓存命中。会写入请求头，但不是长缓存开关。代理不支持或出现异常时关闭。",
  supportsCacheControlOnTools:
    "是否在最后一个 tool 上挂 Anthropic 风格 cache_control。短缓存（约 5 分钟）也会打这个断点，并不等于打开 1 小时长缓存。仅 Anthropic API 或明确兼容 cache-control 的代理开启；普通 OpenAI 接口不要开。",
  forceAdaptiveThinking:
    "强制使用 adaptive thinking。仅在文档或排障明确要求时覆盖。",
  allowEmptySignature:
    "是否允许空的 thinking 签名。代理对此敏感时再改。",
};

export interface CompatFieldGroups {
  primary: readonly CompatBoolField[];
  advanced: readonly CompatBoolField[];
}

const OPENAI_COMPAT: CompatFieldGroups = {
  primary: [
    "supportsStore",
    "supportsDeveloperRole",
    "supportsReasoningEffort",
    "supportsUsageInStreaming",
    "requiresToolResultName",
    "requiresAssistantAfterToolResult",
    "requiresThinkingAsText",
    "requiresReasoningContentOnAssistantMessages",
    "supportsStrictMode",
    "supportsLongCacheRetention",
    "sendSessionAffinityHeaders",
  ],
  advanced: [
    "supportsEagerToolInputStreaming",
    "supportsCacheControlOnTools",
    "forceAdaptiveThinking",
    "allowEmptySignature",
  ],
};

const ANTHROPIC_COMPAT: CompatFieldGroups = {
  primary: [
    "supportsEagerToolInputStreaming",
    "supportsLongCacheRetention",
    "supportsCacheControlOnTools",
    "forceAdaptiveThinking",
    "allowEmptySignature",
    "sendSessionAffinityHeaders",
  ],
  advanced: [],
};

const GOOGLE_COMPAT: CompatFieldGroups = {
  primary: ["supportsUsageInStreaming"],
  advanced: [],
};

/** 未指定 api 时展示全部主项，高级项收入折叠区 */
const FALLBACK_COMPAT: CompatFieldGroups = {
  primary: COMPAT_BOOL_FIELDS.filter(
    (f) =>
      !(
        [
          "supportsEagerToolInputStreaming",
          "supportsCacheControlOnTools",
          "forceAdaptiveThinking",
          "allowEmptySignature",
        ] as readonly string[]
      ).includes(f),
  ),
  advanced: [
    "supportsEagerToolInputStreaming",
    "supportsCacheControlOnTools",
    "forceAdaptiveThinking",
    "allowEmptySignature",
  ],
};

export function getCompatFieldsForApi(apiType: string | undefined): CompatFieldGroups {
  switch (apiType) {
    case "openai-completions":
    case "openai-responses":
      return OPENAI_COMPAT;
    case "anthropic-messages":
      return ANTHROPIC_COMPAT;
    case "google-generative-ai":
      return GOOGLE_COMPAT;
    default:
      return FALLBACK_COMPAT;
  }
}
