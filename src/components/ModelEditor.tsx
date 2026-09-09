import { useEffect, useMemo, useState } from "react";
import type { ModelDefinition } from "@shared/schema";
import { createDefaultModel } from "@shared/schema";
import { TRANSPORT_TYPES } from "@shared/builtins";
import {
  applyRemoteModelHint,
  catalogFetchBlockReason,
  formatRemoteModelLabel,
  resolveProviderBaseUrl,
  type FetchRemoteModelsRequest,
  type RemoteModelHint,
} from "@shared/remote-models";
import { fetchRemoteModels } from "../api";
import { Dropdown } from "./Dropdown";
import { KeyValueEditor } from "./KeyValueEditor";
import { HelpTip } from "./HelpTip";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  models: ModelDefinition[];
  apiTypes: string[];
  onChange: (models: ModelDefinition[]) => void;
  pathPrefix?: string;
  remote?: FetchRemoteModelsRequest;
}

type TriState = "default" | "true" | "false";

const REASONING_OPTIONS = [
  { value: "default", label: "未设置（继承）" },
  { value: "true", label: "支持（true）" },
  { value: "false", label: "不支持（false）" },
];

function readReasoning(model: ModelDefinition): TriState {
  if (model.reasoning === true) return "true";
  if (model.reasoning === false) return "false";
  return "default";
}

function patchCost(
  model: ModelDefinition,
  key: "input" | "output" | "cacheRead" | "cacheWrite",
  raw: string,
): ModelDefinition["cost"] {
  const next: NonNullable<ModelDefinition["cost"]> = { ...(model.cost ?? {}) };
  if (raw === "") {
    delete next[key];
  } else {
    next[key] = Number(raw);
  }
  const hasAny = ["input", "output", "cacheRead", "cacheWrite"].some(
    (k) => next[k as keyof typeof next] !== undefined,
  );
  return hasAny ? next : undefined;
}

const KNOWN_MODEL_KEYS = new Set([
  "id",
  "name",
  "api",
  "baseUrl",
  "reasoning",
  "thinkingLevelMap",
  "input",
  "contextWindow",
  "maxTokens",
  "cost",
  "headers",
  "transport",
  "compat",
]);

function extraFields(model: ModelDefinition): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(model)) {
    if (!KNOWN_MODEL_KEYS.has(key)) {
      extra[key] = value;
    }
  }
  return extra;
}

function scopedId(pathPrefix: string | undefined, ...parts: Array<string | number>): string {
  return ["model", pathPrefix || "root", ...parts]
    .join("-")
    .replace(/[^A-Za-z0-9_-]+/g, "-");
}

export function ModelEditor({ models, apiTypes, onChange, pathPrefix, remote }: Props) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [catalog, setCatalog] = useState<RemoteModelHint[]>([]);
  const [catalogUrl, setCatalogUrl] = useState<string | null>(null);
  const [catalogDialect, setCatalogDialect] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const remoteFingerprint = [
    remote?.providerName,
    remote?.baseUrl,
    remote?.api,
    remote?.apiKey,
    remote?.authHeader,
    JSON.stringify(remote?.headers ?? {}),
  ].join("\0");

  useEffect(() => {
    setCatalog([]);
    setCatalogUrl(null);
    setCatalogDialect(null);
    setCatalogError(null);
  }, [remoteFingerprint]);

  const resolvedCatalogRoot = resolveProviderBaseUrl(remote?.providerName, remote?.baseUrl);
  const catalogBlockReason = catalogFetchBlockReason(remote?.providerName, remote?.baseUrl);
  const catalogOptions = useMemo(
    () =>
      catalog.map((hint) => ({
        value: hint.id,
        label: formatRemoteModelLabel(hint),
      })),
    [catalog],
  );

  const updateModel = (index: number, patch: Partial<ModelDefinition>) => {
    const next = models.map((m, i) => (i === index ? { ...m, ...patch } : m));
    onChange(next);
  };

  const removeModel = (index: number) => {
    setPendingDelete(index);
  };

  const confirmRemoveModel = () => {
    if (pendingDelete === null) return;
    const index = pendingDelete;
    onChange(models.filter((_, i) => i !== index));
    setExpanded(null);
    setPendingDelete(null);
  };

  const addModel = (template?: Partial<ModelDefinition>) => {
    const model = { ...createDefaultModel(), ...template };
    onChange([...models, model]);
    setExpanded(models.length);
  };

  const applyHintToIndex = (index: number, hint: RemoteModelHint) => {
    onChange(
      models.map((model, i) => (i === index ? applyRemoteModelHint(model, hint) : model)),
    );
    setExpanded(index);
  };

  const addOrApplyHint = (hint: RemoteModelHint) => {
    const existing = models.findIndex((model) => model.id === hint.id);
    if (existing >= 0) {
      applyHintToIndex(existing, hint);
      return;
    }
    const blank = models.findIndex((model) => !model.id.trim());
    if (blank >= 0) {
      applyHintToIndex(blank, hint);
      return;
    }
    onChange([...models, applyRemoteModelHint(createDefaultModel(), hint)]);
    setExpanded(models.length);
  };

  const loadCatalog = async () => {
    if (!remote || catalogLoading || catalogBlockReason) return;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const result = await fetchRemoteModels(remote);
      setCatalog(result.models);
      setCatalogUrl(result.url);
      setCatalogDialect(result.dialect);
      if (result.models.length === 0) {
        setCatalogError("目录可访问，但没有识别到可用的对话模型");
      }
    } catch (err) {
      setCatalog([]);
      setCatalogUrl(null);
      setCatalogDialect(null);
      setCatalogError(err instanceof Error ? err.message : "拉取云端模型失败");
    } finally {
      setCatalogLoading(false);
    }
  };

  const mergeExtra = (index: number, raw: string) => {
    const errKey = `extra-${index}`;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const model = models[index]!;
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(model)) {
        if (KNOWN_MODEL_KEYS.has(key)) cleaned[key] = value;
      }
      onChange(
        models.map((m, i) =>
          i === index ? ({ ...cleaned, ...parsed } as ModelDefinition) : m,
        ),
      );
      setJsonErrors((prev) => {
        const next = { ...prev };
        delete next[errKey];
        return next;
      });
    } catch {
      setJsonErrors((prev) => ({
        ...prev,
        [errKey]: "JSON 无效，尚未写入",
      }));
    }
  };

  return (
    <div className="form-section">
      <div className="row mb-sm">
        <h3 className="form-section-title mb-0">模型列表</h3>
        <div className="row-actions">
          <button
            type="button"
            className="btn btn-sm"
            disabled={catalogLoading || Boolean(catalogBlockReason)}
            title={
              catalogBlockReason
                ? catalogBlockReason
                : `GET ${resolvedCatalogRoot}/models（凭证优先用 Pi /login 的 auth.json）`
            }
            onClick={() => void loadCatalog()}
          >
            {catalogLoading ? "拉取中…" : "从云端拉取"}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            title="预填常见 Ollama 本地模型字段，可再按实际模型名修改"
            onClick={() =>
              addModel({
                id: "llama3.1:8b",
                name: "Llama 3.1 8B",
                contextWindow: 128000,
              })
            }
          >
            + Ollama 模板
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => addModel()}>
            + 添加模型
          </button>
        </div>
      </div>

      {(catalogError || catalogUrl) && (
        <div
          className={`alert ${catalogError ? "alert-error" : "alert-info"} mb-sm`}
          role={catalogError ? "alert" : "status"}
        >
          {catalogError ? (
            catalogError
          ) : (
            <>
              已获取 {catalog.length} 个模型
              {catalogDialect ? `（${catalogDialect}）` : ""}
              {catalogUrl ? (
                <>
                  ，来源 <code>{catalogUrl}</code>
                </>
              ) : null}
            </>
          )}
        </div>
      )}

      {catalog.length > 0 && (
        <div className="form-field full mb-sm">
          <label htmlFor={scopedId(pathPrefix, "remote-catalog")}>从云端目录选择</label>
          <Dropdown
            id={scopedId(pathPrefix, "remote-catalog")}
            searchable
            value=""
            placeholder="搜索并填入 ID / 名称 / 模态"
            options={catalogOptions}
            onChange={(id) => {
              const hint = catalog.find((item) => item.id === id);
              if (hint) addOrApplyHint(hint);
            }}
          />
          <p className="text-sm text-muted mt-xs mb-0">
            选择后自动填入 id、显示名，并尽量写入多模态、思考、上下文窗口与价格。已存在的 ID 会更新当前条目。
          </p>
        </div>
      )}

      {models.length === 0 && (
        <p className="text-sm text-muted">
          暂无模型。点击上方按钮添加。Ollama 模板会预填本地常见字段，仍需按实际模型 ID 修改。
        </p>
      )}

      {models.map((model, index) => {
        const panelId = `model-panel-${index}`;
        const toggleId = `model-toggle-${index}`;
        const isOpen = expanded === index;
        const modelPath = pathPrefix ? `${pathPrefix}.${index}` : undefined;
        return (
        <div
          key={model.id ? `${model.id}-${index}` : `model-${index}`}
          className="model-card"
          data-config-path={modelPath}
        >
          <div className="model-card-header">
            <button
              type="button"
              id={toggleId}
              className="model-card-toggle"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setExpanded(isOpen ? null : index)}
            >
              <span className="model-card-title truncate">
                {model.id || "(未命名)"}
                {model.name && model.name !== model.id && (
                  <span className="text-muted model-card-alias">{model.name}</span>
                )}
              </span>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              aria-label={`删除模型 ${model.id || index + 1}`}
              onClick={() => removeModel(index)}
            >
              删除
            </button>
          </div>

          {isOpen && (
            <div className="model-card-body" id={panelId} role="region" aria-labelledby={toggleId}>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor={`model-id-${index}`}>ID *</label>
                  <input
                    id={`model-id-${index}`}
                    data-config-path={modelPath ? `${modelPath}.id` : undefined}
                    value={model.id}
                    onChange={(e) => updateModel(index, { id: e.target.value })}
                    placeholder="model-id"
                    aria-required="true"
                    autoComplete="off"
                  />
                </div>
                {catalog.length > 0 && (
                  <div className="form-field">
                    <label htmlFor={`model-catalog-${index}`}>从目录填入</label>
                    <Dropdown
                      id={`model-catalog-${index}`}
                      searchable
                      value={catalog.some((item) => item.id === model.id) ? model.id : ""}
                      placeholder="选择云端模型"
                      options={catalogOptions}
                      onChange={(id) => {
                        const hint = catalog.find((item) => item.id === id);
                        if (hint) applyHintToIndex(index, hint);
                      }}
                    />
                  </div>
                )}
                <div className="form-field">
                  <label htmlFor={`model-name-${index}`}>名称</label>
                  <input
                    id={`model-name-${index}`}
                    value={model.name ?? ""}
                    onChange={(e) =>
                      updateModel(index, { name: e.target.value || undefined })
                    }
                    placeholder="显示名称（可选）"
                    autoComplete="off"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`model-api-${index}`}>API 类型</label>
                  <Dropdown
                    id={`model-api-${index}`}
                    value={model.api ?? ""}
                    placeholder="继承 Provider"
                    options={[
                      { value: "", label: "继承 Provider" },
                      ...apiTypes.map((t) => ({ value: t, label: t })),
                    ]}
                    onChange={(next) =>
                      updateModel(index, { api: next || undefined })
                    }
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={scopedId(pathPrefix, "baseurl", index)}>Base URL</label>
                  <input
                    id={scopedId(pathPrefix, "baseurl", index)}
                    name={scopedId(pathPrefix, "baseurl", index)}
                    value={model.baseUrl ?? ""}
                    onChange={(e) =>
                      updateModel(index, { baseUrl: e.target.value || undefined })
                    }
                    placeholder="可选，覆盖 Provider"
                    autoComplete="url"
                    inputMode="url"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`model-transport-${index}`}>
                    Transport
                    <HelpTip
                      label="Transport"
                      text="请求传输方式。auto 由 Pi 决定；仅在文档要求或排障时覆盖。"
                    />
                  </label>
                  <Dropdown
                    id={`model-transport-${index}`}
                    value={model.transport ?? ""}
                    placeholder="未设置（继承）"
                    options={[
                      { value: "", label: "未设置（继承）" },
                      ...TRANSPORT_TYPES.map((t) => ({ value: t, label: t })),
                    ]}
                    onChange={(next) =>
                      updateModel(index, {
                        transport: (next || undefined) as ModelDefinition["transport"],
                      })
                    }
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`model-context-${index}`}>上下文窗口</label>
                  <input
                    id={`model-context-${index}`}
                    type="number"
                    value={model.contextWindow ?? ""}
                    onChange={(e) =>
                      updateModel(index, {
                        contextWindow: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="未设置"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`model-maxtokens-${index}`}>最大输出 Tokens</label>
                  <input
                    id={`model-maxtokens-${index}`}
                    type="number"
                    value={model.maxTokens ?? ""}
                    onChange={(e) =>
                      updateModel(index, {
                        maxTokens: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="未设置"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`model-reasoning-${index}`}>推理 (reasoning)</label>
                  <Dropdown
                    id={`model-reasoning-${index}`}
                    value={readReasoning(model)}
                    options={REASONING_OPTIONS}
                    onChange={(next) => {
                      if (next === "default") {
                        updateModel(index, { reasoning: undefined });
                      } else {
                        updateModel(index, { reasoning: next === "true" });
                      }
                    }}
                  />
                </div>
                <label className="checkbox-row" htmlFor={`model-image-${index}`}>
                  <input
                    id={`model-image-${index}`}
                    type="checkbox"
                    checked={model.input?.includes("image") ?? false}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateModel(index, { input: ["text", "image"] });
                      } else if (model.input === undefined) {
                        // 保持未设置
                      } else {
                        updateModel(index, { input: undefined });
                      }
                    }}
                  />
                  <span>支持图片输入（勾选才写入 input）</span>
                </label>
              </div>

              <div className="form-section mt-md mb-0">
                <h3 className="form-section-title">费用 (每百万 tokens，可选)</h3>
                <p className="text-sm text-muted mb-sm">留空表示不写入该字段，避免覆盖 Pi 默认价格。</p>
                <div className="form-grid">
                  {(["input", "output", "cacheRead", "cacheWrite"] as const).map((key) => (
                    <div key={key} className="form-field">
                      <label htmlFor={`model-cost-${key}-${index}`}>{key}</label>
                      <input
                        id={`model-cost-${key}-${index}`}
                        type="number"
                        step="0.01"
                        value={model.cost?.[key] ?? ""}
                        placeholder="未设置"
                        onChange={(e) =>
                          updateModel(index, {
                            cost: patchCost(model, key, e.target.value),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <KeyValueEditor
                label="模型 Headers（可选）"
                value={model.headers ?? {}}
                onChange={(headers) =>
                  updateModel(index, {
                    headers: Object.keys(headers).filter(Boolean).length
                      ? Object.fromEntries(
                          Object.entries(headers).filter(([k]) => k.trim()),
                        )
                      : undefined,
                  })
                }
              />

              <details className="collapsible">
                <summary>thinkingLevelMap JSON</summary>
                <div className="collapsible-content">
                  <p className="text-sm text-muted mb-sm">
                    将 Pi 思考等级映射到供应商取值；值可用 null。留空对象表示删除该字段。
                  </p>
                  <label className="visually-hidden" htmlFor={`model-thinking-${index}`}>
                    thinkingLevelMap JSON
                  </label>
                  <textarea
                    id={`model-thinking-${index}`}
                    className={`json-editor ${jsonErrors[`thinking-${index}`] ? "is-invalid" : ""}`}
                    style={{ minHeight: 120 }}
                    value={JSON.stringify(model.thinkingLevelMap ?? {}, null, 2)}
                    spellCheck={false}
                    aria-invalid={Boolean(jsonErrors[`thinking-${index}`]) || undefined}
                    onChange={(e) => {
                      const raw = e.target.value;
                      try {
                        const parsed = JSON.parse(raw) as Record<
                          string,
                          string | null
                        >;
                        updateModel(index, {
                          thinkingLevelMap:
                            Object.keys(parsed).length > 0 ? parsed : undefined,
                        });
                        setJsonErrors((prev) => {
                          const next = { ...prev };
                          delete next[`thinking-${index}`];
                          return next;
                        });
                      } catch {
                        setJsonErrors((prev) => ({
                          ...prev,
                          [`thinking-${index}`]: "JSON 无效，尚未写入",
                        }));
                      }
                    }}
                  />
                  {jsonErrors[`thinking-${index}`] && (
                    <p className="field-error" role="alert">
                      {jsonErrors[`thinking-${index}`]}
                    </p>
                  )}
                </div>
              </details>

              <details className="collapsible">
                <summary>高级字段 JSON（UI 未覆盖的键）</summary>
                <div className="collapsible-content">
                  <p className="text-sm text-muted mb-sm">
                    仅编辑未知/额外字段；不会删除上方表单已管理的键。
                  </p>
                  <label className="visually-hidden" htmlFor={`model-extra-${index}`}>
                    模型高级字段 JSON
                  </label>
                  <textarea
                    id={`model-extra-${index}`}
                    className={`json-editor ${jsonErrors[`extra-${index}`] ? "is-invalid" : ""}`}
                    style={{ minHeight: 120 }}
                    value={JSON.stringify(extraFields(model), null, 2)}
                    spellCheck={false}
                    aria-invalid={Boolean(jsonErrors[`extra-${index}`]) || undefined}
                    onChange={(e) => mergeExtra(index, e.target.value)}
                  />
                  {jsonErrors[`extra-${index}`] && (
                    <p className="field-error" role="alert">
                      {jsonErrors[`extra-${index}`]}
                    </p>
                  )}
                </div>
              </details>
            </div>
          )}
        </div>
        );
      })}

      {pendingDelete !== null && (
        <ConfirmDialog
          title="删除模型？"
          message="此操作只改内存中的配置，需保存后才会写入磁盘。"
          confirmLabel="删除"
          danger
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmRemoveModel}
        />
      )}
    </div>
  );
}
