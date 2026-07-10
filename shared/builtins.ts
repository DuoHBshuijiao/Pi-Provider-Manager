/** Pi 内建 Provider 名称表（与 Pi 文档对齐） */
export const BUILTIN_PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "openrouter",
  "opencode",
  "opencode-go",
  "minimax",
  "minimax-cn",
  "xai",
  "groq",
  "mistral",
  "cerebras",
  "azure-openai-responses",
  "vercel-ai-gateway",
  "zai",
  "huggingface",
  "kimi-coding",
  "cloudflare-ai-gateway",
] as const;

export type BuiltinProvider = (typeof BUILTIN_PROVIDERS)[number];

export function isBuiltinProvider(name: string): boolean {
  return (BUILTIN_PROVIDERS as readonly string[]).includes(name);
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
  supportsLongCacheRetention: "长缓存保留",
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
    "当 Pi 进程设置 PI_CACHE_RETENTION=long 时，是否允许发送长缓存请求。OpenAI 兼容端对应 prompt_cache_retention: \"24h\"；Anthropic 对应 1 小时 cache-control。只表示接口能力，不等于自动启用缓存。",
  supportsEagerToolInputStreaming:
    "Anthropic 工具入参流式传输。若代理拒绝该字段，设为「不支持」。",
  sendSessionAffinityHeaders:
    "给中转站提供稳定会话标识，以提高同一后端路由与缓存命中。代理不支持或出现异常时关闭。",
  supportsCacheControlOnTools:
    "Anthropic 风格的工具缓存标记。仅 Anthropic API 或明确兼容 Anthropic cache-control 的代理开启；普通 OpenAI 接口不要开。",
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
