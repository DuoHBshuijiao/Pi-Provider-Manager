import { useState } from "react";
import type { ModelDefinition } from "@shared/schema";
import { createDefaultModel } from "@shared/schema";
import { TRANSPORT_TYPES } from "@shared/builtins";
import { Dropdown } from "./Dropdown";
import { KeyValueEditor } from "./KeyValueEditor";
import { HelpTip } from "./HelpTip";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  models: ModelDefinition[];
  apiTypes: string[];
  onChange: (models: ModelDefinition[]) => void;
  pathPrefix?: string;
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

export function ModelEditor({ models, apiTypes, onChange, pathPrefix }: Props) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

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
                  <label htmlFor={`model-baseurl-${index}`}>Base URL</label>
                  <input
                    id={`model-baseurl-${index}`}
                    value={model.baseUrl ?? ""}
                    onChange={(e) =>
                      updateModel(index, { baseUrl: e.target.value || undefined })
                    }
                    placeholder="可选，覆盖 Provider"
                    autoComplete="off"
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
