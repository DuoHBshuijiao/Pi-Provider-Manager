import { useState } from "react";
import type { ModelDefinition } from "@shared/schema";
import { createDefaultModel } from "@shared/schema";
import { Dropdown } from "./Dropdown";

interface Props {
  models: ModelDefinition[];
  apiTypes: string[];
  onChange: (models: ModelDefinition[]) => void;
}

export function ModelEditor({ models, apiTypes, onChange }: Props) {
  const [expanded, setExpanded] = useState<number | null>(0);

  const updateModel = (index: number, patch: Partial<ModelDefinition>) => {
    const next = models.map((m, i) => (i === index ? { ...m, ...patch } : m));
    onChange(next);
  };

  const removeModel = (index: number) => {
    onChange(models.filter((_, i) => i !== index));
    setExpanded(null);
  };

  const addModel = (template?: Partial<ModelDefinition>) => {
    const model = { ...createDefaultModel(), ...template };
    onChange([...models, model]);
    setExpanded(models.length);
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
        <p className="text-sm text-muted">
          暂无模型。点击上方按钮添加。
        </p>
      )}

      {models.map((model, index) => (
        <div key={index} className="model-card">
          <div
            className="model-card-header"
            onClick={() => setExpanded(expanded === index ? null : index)}
          >
            <span className="model-card-title">
              {model.id || "(未命名)"}
              {model.name && model.name !== model.id && (
                <span className="text-muted model-card-alias">
                  {model.name}
                </span>
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
                    onChange={(e) => updateModel(index, { name: e.target.value })}
                    placeholder="显示名称"
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
                  <label>上下文窗口</label>
                  <input
                    type="number"
                    value={model.contextWindow ?? ""}
                    onChange={(e) =>
                      updateModel(index, {
                        contextWindow: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
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
                  />
                </div>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={model.reasoning ?? false}
                    onChange={(e) => updateModel(index, { reasoning: e.target.checked })}
                  />
                  <span>支持推理 (reasoning)</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={model.input?.includes("image") ?? false}
                    onChange={(e) =>
                      updateModel(index, {
                        input: e.target.checked ? ["text", "image"] : ["text"],
                      })
                    }
                  />
                  <span>支持图片输入</span>
                </label>
              </div>

              <div className="form-section mt-md mb-0">
                <h3 className="form-section-title">费用 (每百万 tokens)</h3>
                <div className="form-grid">
                  {(["input", "output", "cacheRead", "cacheWrite"] as const).map((key) => (
                    <div key={key} className="form-field">
                      <label>{key}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={model.cost?.[key] ?? 0}
                        onChange={(e) =>
                          updateModel(index, {
                            cost: {
                              input: model.cost?.input ?? 0,
                              output: model.cost?.output ?? 0,
                              cacheRead: model.cost?.cacheRead ?? 0,
                              cacheWrite: model.cost?.cacheWrite ?? 0,
                              [key]: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
