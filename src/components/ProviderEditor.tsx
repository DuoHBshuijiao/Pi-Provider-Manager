import { useEffect, useState } from "react";
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

function countEntries(record: Record<string, unknown> | undefined): number {
  return record ? Object.keys(record).length : 0;
}

export function ProviderEditor({
  name,
  provider,
  builtinProviders,
  apiTypes,
  onChange,
}: Props) {
  const builtin = isBuiltinProvider(name);
  const headerCount = countEntries(provider.headers);
  const compatCount = countEntries(
    provider.compat as Record<string, unknown> | undefined,
  );
  const pathPrefix = `providers.${name}`;
  const syncedExtra = JSON.stringify(extraFields(provider), null, 2);

  const [showApiKey, setShowApiKey] = useState(false);
  const [extraRaw, setExtraRaw] = useState(() =>
    JSON.stringify(extraFields(provider), null, 2),
  );
  const [extraError, setExtraError] = useState<string | null>(null);
  const [headersOpen, setHeadersOpen] = useState(() => headerCount > 0);
  const [compatOpen, setCompatOpen] = useState(() => compatCount > 0);

  useEffect(() => {
    if (extraError) return;
    setExtraRaw(syncedExtra);
  }, [syncedExtra, extraError, name]);

  const patch = (updates: Partial<ProviderConfig>) => {
    onChange({ ...provider, ...updates });
  };

  const onExtraChange = (raw: string) => {
    setExtraRaw(raw);
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      setExtraError(null);
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(provider)) {
        if (KNOWN_PROVIDER_KEYS.has(key)) cleaned[key] = value;
      }
      onChange({ ...cleaned, ...parsed } as ProviderConfig);
    } catch {
      setExtraError("JSON 无效，尚未写入（请修正后再继续）");
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
            <span className="field-label">Provider 名称</span>
            <p className="readonly-value" title={name}>
              <code>{name}</code>
              {builtin && <span className="badge badge-builtin">内建</span>}
            </p>
          </div>
          <div className="form-field full">
            <label htmlFor="provider-base-url">
              Base URL {builtin ? "(可选，用于代理)" : "*"}
            </label>
            <input
              id="provider-base-url"
              data-config-path={`${pathPrefix}.baseUrl`}
              value={provider.baseUrl ?? ""}
              onChange={(e) => patch({ baseUrl: e.target.value || undefined })}
              placeholder="https://api.example.com/v1"
              autoComplete="off"
              aria-required={!builtin || undefined}
            />
          </div>
          <div className="form-field">
            <label htmlFor="provider-api-type">API 类型 {!builtin ? "*" : ""}</label>
            <Dropdown
              id="provider-api-type"
              data-config-path={`${pathPrefix}.api`}
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
            <label htmlFor="provider-api-key">API Key</label>
            <div className="input-group">
              <input
                id="provider-api-key"
                data-config-path={`${pathPrefix}.apiKey`}
                type={showApiKey ? "text" : "password"}
                value={provider.apiKey ?? ""}
                onChange={(e) => patch({ apiKey: e.target.value || undefined })}
                placeholder="$ENV_VAR 或 sk-..."
                className="masked-input"
                autoComplete="off"
              />
              <button
                type="button"
                className="btn btn-sm"
                aria-pressed={showApiKey}
                aria-controls="provider-api-key"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? "隐藏" : "显示"}
              </button>
            </div>
          </div>
          <label className="checkbox-row" htmlFor="provider-auth-header">
            <input
              id="provider-auth-header"
              data-config-path={`${pathPrefix}.authHeader`}
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

      <details
        className="collapsible form-section-fold"
        open={headersOpen}
        onToggle={(e) => setHeadersOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary>
          自定义 Headers
          {headerCount > 0 && <span className="fold-count">{headerCount}</span>}
        </summary>
        <div className="collapsible-content">
          <KeyValueEditor
            label=""
            value={provider.headers ?? {}}
            pathPrefix={`${pathPrefix}.headers`}
            onChange={(headers) =>
              patch({
                headers: Object.keys(headers).filter((k) => k.trim()).length
                  ? Object.fromEntries(
                      Object.entries(headers).filter(([k]) => k.trim()),
                    )
                  : undefined,
              })
            }
          />
        </div>
      </details>

      <details
        className="collapsible form-section-fold"
        open={compatOpen}
        onToggle={(e) => setCompatOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary>
          兼容性 (compat)
          {compatCount > 0 && <span className="fold-count">{compatCount}</span>}
        </summary>
        <div className="collapsible-content">
          <CompatEditor
            compat={provider.compat as Record<string, unknown> | undefined}
            apiType={provider.api}
            pathPrefix={`${pathPrefix}.compat`}
            onChange={(compat) =>
              patch({ compat: Object.keys(compat).length ? compat : undefined })
            }
          />
        </div>
      </details>

      <ModelEditor
        models={provider.models ?? []}
        apiTypes={apiTypes}
        pathPrefix={`${pathPrefix}.models`}
        onChange={(models) => patch({ models: models.length ? models : undefined })}
      />

      {builtin && (
        <ModelOverridesEditor
          overrides={provider.modelOverrides ?? {}}
          pathPrefix={`${pathPrefix}.modelOverrides`}
          onChange={(modelOverrides) =>
            patch({
              modelOverrides: Object.keys(modelOverrides).length
                ? modelOverrides
                : undefined,
            })
          }
        />
      )}

      <details className="collapsible form-section-fold">
        <summary>高级字段 JSON（UI 未覆盖的 Provider 键）</summary>
        <div className="collapsible-content">
          <p className="text-sm text-muted mb-sm">
            仅编辑未知/额外字段；表单已管理的键不会被此处删除。
          </p>
          <label className="visually-hidden" htmlFor="provider-extra-json">
            Provider 高级字段 JSON
          </label>
          <textarea
            id="provider-extra-json"
            className={`json-editor ${extraError ? "is-invalid" : ""}`}
            style={{ minHeight: 120 }}
            value={extraRaw}
            spellCheck={false}
            aria-invalid={Boolean(extraError) || undefined}
            onChange={(e) => onExtraChange(e.target.value)}
          />
          {extraError && (
            <p className="field-error" role="alert">
              {extraError}
            </p>
          )}
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
