import { useEffect, useState } from "react";
import type { ProviderConfig } from "@shared/schema";
import {
  findCatalogProvider,
  type BuiltinProviderInfo,
} from "@shared/builtins";
import { revealLocalFile } from "../api";
import { KeyValueEditor } from "./KeyValueEditor";
import { CompatEditor } from "./CompatEditor";
import { ModelEditor } from "./ModelEditor";
import { ModelOverridesEditor } from "./ModelOverridesEditor";
import { Dropdown } from "./Dropdown";

interface Props {
  name: string;
  provider: ProviderConfig;
  builtinCatalog: BuiltinProviderInfo[];
  apiTypes: string[];
  authJsonPath?: string;
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

function fieldId(providerName: string, field: string): string {
  return `provider-${field}-${providerName.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
}

export function ProviderEditor({
  name,
  provider,
  builtinCatalog,
  apiTypes,
  authJsonPath,
  onChange,
}: Props) {
  const builtinMeta = findCatalogProvider(builtinCatalog, name);
  const builtin = Boolean(builtinMeta);
  const headerCount = countEntries(provider.headers);
  const compatCount = countEntries(
    provider.compat as Record<string, unknown> | undefined,
  );
  const pathPrefix = `providers.${name}`;
  const baseUrlId = fieldId(name, "base-url");
  const apiTypeId = fieldId(name, "api-type");
  const apiKeyId = fieldId(name, "api-key");
  const authHeaderId = fieldId(name, "auth-header");
  const extraJsonId = fieldId(name, "extra-json");
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

  const openAuthJson = async () => {
    if (authJsonPath) {
      try {
        await navigator.clipboard.writeText(authJsonPath);
      } catch {
        // ignore clipboard failures
      }
    }
    try {
      await revealLocalFile("auth");
    } catch {
      // explorer 可能仍会打开；剪贴板已尽量写入
    }
  };

  return (
    <div>
      {builtin && (
        <div className="alert alert-warning mb-md" role="status">
          <p className="mb-xs">
            登录配置：
            {authJsonPath ? (
              <button
                type="button"
                className="path-link"
                title="复制路径并在资源管理器中打开"
                onClick={() => void openAuthJson()}
              >
                {authJsonPath}
              </button>
            ) : (
              <code>~/.pi/agent/auth.json</code>
            )}
          </p>
          <p className="mb-0">填写 Base URL 或 API Key 会覆盖 Pi 内建设置。</p>
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
            <label htmlFor={baseUrlId}>
              Base URL {builtin ? "(可选，用于代理)" : "*"}
            </label>
            <input
              id={baseUrlId}
              name={baseUrlId}
              data-config-path={`${pathPrefix}.baseUrl`}
              value={provider.baseUrl ?? ""}
              onChange={(e) => patch({ baseUrl: e.target.value || undefined })}
              placeholder={
                builtin
                  ? builtinMeta?.baseUrl
                    ? `留空则继承 ${builtinMeta.baseUrl}`
                    : "留空则继承 Pi 内建地址"
                  : "https://api.example.com/v1"
              }
              autoComplete="url"
              inputMode="url"
              aria-required={!builtin || undefined}
            />
            {builtin && (
              <p className="text-sm text-muted mt-xs">
                {builtinMeta?.baseUrl
                  ? `留空则继承 ${builtinMeta.baseUrl}${builtinMeta.api ? `（${builtinMeta.api}）` : ""}。只有走代理时才需要填写。`
                  : "留空则继承 Pi 内建的官方地址。只有走代理时才需要填写。"}
              </p>
            )}
          </div>
          <div className="form-field">
            <label htmlFor={apiTypeId}>API 类型 {!builtin ? "*" : ""}</label>
            <Dropdown
              id={apiTypeId}
              data-config-path={`${pathPrefix}.api`}
              value={provider.api ?? ""}
              placeholder={
                builtin
                  ? builtinMeta?.api
                    ? `使用内建默认（${builtinMeta.api}）`
                    : "使用内建默认"
                  : "选择 API 类型"
              }
              options={[
                {
                  value: "",
                  label: builtin
                    ? builtinMeta?.api
                      ? `使用内建默认（${builtinMeta.api}）`
                      : "使用内建默认"
                    : "选择 API 类型",
                },
                ...apiTypes.map((t) => ({ value: t, label: t })),
              ]}
              onChange={(next) =>
                patch({ api: (next || undefined) as ProviderConfig["api"] })
              }
            />
          </div>
          <div className="form-field">
            <label htmlFor={apiKeyId}>API Key</label>
            <div className="input-group">
              <input
                id={apiKeyId}
                name={apiKeyId}
                data-config-path={`${pathPrefix}.apiKey`}
                type={showApiKey ? "text" : "password"}
                value={provider.apiKey ?? ""}
                onChange={(e) => patch({ apiKey: e.target.value || undefined })}
                placeholder={
                  builtin
                    ? "留空则使用 Pi /login（auth.json）或环境变量"
                    : "$ENV_VAR 或 sk-..."
                }
                className="masked-input"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="btn btn-sm"
                aria-pressed={showApiKey}
                aria-controls={apiKeyId}
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? "隐藏" : "显示"}
              </button>
            </div>
            {builtin && (
              <p className="text-sm text-muted mt-xs">
                留空即可。密钥来自 Pi 的 <code>/login</code>，不是 models.json。
              </p>
            )}
          </div>
          <label className="checkbox-row" htmlFor={authHeaderId}>
            <input
              id={authHeaderId}
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
        remote={{
          providerName: name,
          baseUrl: provider.baseUrl,
          api: provider.api,
          apiKey: provider.apiKey,
          headers: provider.headers,
          authHeader: provider.authHeader,
        }}
        onChange={(models) => patch({ models: models.length ? models : undefined })}
      />

      {builtin && (
        <ModelOverridesEditor
          overrides={provider.modelOverrides ?? {}}
          pathPrefix={`${pathPrefix}.modelOverrides`}
          catalogModels={builtinMeta?.models ?? []}
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
          <label className="visually-hidden" htmlFor={extraJsonId}>
            Provider 高级字段 JSON
          </label>
          <textarea
            id={extraJsonId}
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

      {!builtin && (
        <p className="text-sm text-muted">
          提示：第三方 Provider 需配置 baseUrl 与 api 类型。
        </p>
      )}
    </div>
  );
}
