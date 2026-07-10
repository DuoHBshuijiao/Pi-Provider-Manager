import { useState } from "react";
import type { ModelDefinition } from "@shared/schema";
import { createDefaultModel } from "@shared/schema";
import { TRANSPORT_TYPES } from "@shared/builtins";
import { Dropdown } from "./Dropdown";
import { KeyValueEditor } from "./KeyValueEditor";
import { HelpTip } from "./HelpTip";

interface Props {
  models: ModelDefinition[];
  apiTypes: string[];
  onChange: (models: ModelDefinition[]) => void;
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

export function ModelEditor({ models, apiTypes, onChange }: Props) {
  const [expanded, setExpanded] = useState<number | null>(0);

  const updateModel = (index: number, patch: Partial<ModelDefinition>) => {
    const next = models.map((m, i) => (i === index ? { ...m, ...patch } : m));
    onChange(next);
  };

  const removeModel = (index: number) => {
    if (!window.confirm("确定删除该模型？")) return;
    onChange(models.filter((_, i) => i !== index));
    setExpanded(null);
  };

  const addModel = (template?: Partial<ModelDefinition>) => {
    const model = { ...createDefaultModel(), ...template };
    onChange([...models, model]);
    setExpanded(models.length);
  };

  const mergeExtra = (index: number, raw: string) => {
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
    } catch {
      // ignore invalid JSON while typing
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
        <p className="text-sm text-muted">暂无模型。点击上方按钮添加。</p>
      )}

      {models.map((model, index) => (
        <div key={index} className="model-card">
          <div
            className="model-card-header"
            role="button"
            tabIndex={0}
            aria-expanded={expanded === index}
            onClick={() => setExpanded(expanded === index ? null : index)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setExpanded(expanded === index ? null : index);
              }
            }}
          >
            <span className="model-card-title">
              {model.id || "(未命名)"}
              {model.name && model.name !== model.id && (
                <span className="text-muted model-card-alias">{model.name}</span>
              )}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={(e) => {
                e.stopPropagation();
                removeModel(index);
              }}
            >
              删除
            </button>
          </div>

          {expanded === index && (
            <div className="model-card-body">
              <div className="form-grid">
                <div className="form-field">
                  <label>ID *</label>
                  <input
                    value={model.id}
                    onChange={(e) => updateModel(index, { id: e.target.value })}
                    placeholder="model-id"
                  />
                </div>
                <div className="form-field">
                  <label>名称</label>
                  <input
                    value={model.name ?? ""}
                    onChange={(e) =>
                      updateModel(index, { name: e.target.value || undefined })
                    }
                    placeholder="显示名称（可选）"
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
                  <label>Base URL</label>
                  <input
                    value={model.baseUrl ?? ""}
                    onChange={(e) =>
                      updateModel(index, { baseUrl: e.target.value || undefined })
                    }
                    placeholder="可选，覆盖 Provider"
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
                  <label>上下文窗口</label>
                  <input
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
                  <label>最大输出 Tokens</label>
                  <input
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
                <label className="checkbox-row">
                  <input
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
                      <label>{key}</label>
                      <input
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
                  <textarea
                    className="json-editor"
                    style={{ minHeight: 120 }}
                    value={JSON.stringify(model.thinkingLevelMap ?? {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value) as Record<
                          string,
                          string | null
                        >;
                        updateModel(index, {
                          thinkingLevelMap:
                            Object.keys(parsed).length > 0 ? parsed : undefined,
                        });
                      } catch {
                        // ignore
                      }
                    }}
                  />
                </div>
              </details>

              <details className="collapsible">
                <summary>高级字段 JSON（UI 未覆盖的键）</summary>
                <div className="collapsible-content">
                  <p className="text-sm text-muted mb-sm">
                    仅编辑未知/额外字段；不会删除上方表单已管理的键。
                  </p>
                  <textarea
                    className="json-editor"
                    style={{ minHeight: 120 }}
                    value={JSON.stringify(extraFields(model), null, 2)}
                    onChange={(e) => mergeExtra(index, e.target.value)}
                  />
                </div>
              </details>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
