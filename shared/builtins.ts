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
