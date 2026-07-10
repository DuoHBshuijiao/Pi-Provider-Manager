import { useState } from "react";
import type { ProviderConfig } from "@shared/schema";
import { isBuiltinProvider } from "@shared/builtins";
import { KeyValueEditor } from "./KeyValueEditor";
import { CompatEditor } from "./CompatEditor";
import { ModelEditor } from "./ModelEditor";
import { ModelOverridesEditor } from "./ModelOverridesEditor";
import { Dropdown } from "./Dropdown";

interface Props {
  name: string;
  provider: ProviderConfig;
  builtinProviders: string[];
  apiTypes: string[];
  onChange: (provider: ProviderConfig) => void;
}

const KNOWN_PROVIDER_KEYS = new Set([
  "baseUrl",
  "apiKey",
  "api",
  "headers",
  "compat",
  "authHeader",
  "models",
  "modelOverrides",
]);

function extraFields(provider: ProviderConfig): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(provider)) {
    if (!KNOWN_PROVIDER_KEYS.has(key)) {
      extra[key] = value;
    }
  }
  return extra;
}

export function ProviderEditor({
  name,
  provider,
  builtinProviders,
  apiTypes,
  onChange,
}: Props) {
  const [showApiKey, setShowApiKey] = useState(false);
  const builtin = isBuiltinProvider(name);

  const patch = (updates: Partial<ProviderConfig>) => {
    onChange({ ...provider, ...updates });
  };

  const mergeExtra = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(provider)) {
        if (KNOWN_PROVIDER_KEYS.has(key)) cleaned[key] = value;
      }
      onChange({ ...cleaned, ...parsed } as ProviderConfig);
    } catch {
      // ignore
    }
  };

  return (
    <div>
      {builtin && (
        <div className="alert alert-warning mb-md" role="status">
          内建 Provider：<code>models</code> 中同 ID 会替换 Pi 内建模型；只想改内建模型属性，请使用{" "}
          <code>modelOverrides</code>。
        </div>
      )}

      <div className="form-section">
        <h3 className="form-section-title">基础配置</h3>
        <div className="form-grid">
          <div className="form-field full">
            <label>Provider 名称</label>
            <input value={name} disabled className="input-disabled" />
          </div>
          <div className="form-field full">
            <label>Base URL {builtin ? "(可选，用于代理)" : "*"}</label>
            <input
              value={provider.baseUrl ?? ""}
              onChange={(e) => patch({ baseUrl: e.target.value || undefined })}
              placeholder="https://api.example.com/v1"
            />
          </div>
          <div className="form-field">
            <label htmlFor="provider-api-type">API 类型 {!builtin ? "*" : ""}</label>
            <Dropdown
              id="provider-api-type"
              value={provider.api ?? ""}
              placeholder={builtin ? "使用内建默认" : "选择 API 类型"}
              options={[
                { value: "", label: builtin ? "使用内建默认" : "选择 API 类型" },
                ...apiTypes.map((t) => ({ value: t, label: t })),
              ]}
              onChange={(next) =>
                patch({ api: (next || undefined) as ProviderConfig["api"] })
              }
            />
          </div>
          <div className="form-field">
            <label>API Key</label>
            <div className="input-group">
              <input
                type={showApiKey ? "text" : "password"}
                value={provider.apiKey ?? ""}
                onChange={(e) => patch({ apiKey: e.target.value || undefined })}
                placeholder="$ENV_VAR 或 sk-..."
                className="masked-input"
              />
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? "隐藏" : "显示"}
              </button>
            </div>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={provider.authHeader ?? false}
              onChange={(e) =>
                patch({
                  authHeader: e.target.checked ? true : undefined,
                })
              }
            />
            <span>自动添加 Authorization: Bearer 头</span>
          </label>
        </div>
      </div>

      <KeyValueEditor
        label="自定义 Headers"
        value={provider.headers ?? {}}
        onChange={(headers) =>
          patch({
            headers: Object.keys(headers).filter((k) => k.trim()).length
              ? Object.fromEntries(Object.entries(headers).filter(([k]) => k.trim()))
              : undefined,
          })
        }
      />

      <CompatEditor
        compat={provider.compat as Record<string, unknown> | undefined}
        apiType={provider.api}
        onChange={(compat) =>
          patch({ compat: Object.keys(compat).length ? compat : undefined })
        }
      />

      <ModelEditor
        models={provider.models ?? []}
        apiTypes={apiTypes}
        onChange={(models) => patch({ models: models.length ? models : undefined })}
      />

      {builtin && (
        <ModelOverridesEditor
          overrides={provider.modelOverrides ?? {}}
          onChange={(modelOverrides) =>
            patch({
              modelOverrides: Object.keys(modelOverrides).length
                ? modelOverrides
                : undefined,
            })
          }
        />
      )}

      <details className="collapsible">
        <summary>高级字段 JSON（UI 未覆盖的 Provider 键）</summary>
        <div className="collapsible-content">
          <p className="text-sm text-muted mb-sm">
            仅编辑未知/额外字段；表单已管理的键不会被此处删除。
          </p>
          <textarea
            className="json-editor"
            style={{ minHeight: 120 }}
            value={JSON.stringify(extraFields(provider), null, 2)}
            onChange={(e) => mergeExtra(e.target.value)}
          />
        </div>
      </details>

      {!builtin && !builtinProviders.includes(name) && (
        <p className="text-sm text-muted">
          提示：第三方 Provider 需配置 baseUrl 与 api 类型。
        </p>
      )}
    </div>
  );
}
