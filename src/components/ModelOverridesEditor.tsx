import { useState } from "react";
import type { ModelOverride } from "@shared/schema";
import { TRANSPORT_TYPES } from "@shared/builtins";
import { Dropdown } from "./Dropdown";
import { KeyValueEditor } from "./KeyValueEditor";

interface Props {
  overrides: Record<string, ModelOverride>;
  onChange: (overrides: Record<string, ModelOverride>) => void;
}

type TriState = "default" | "true" | "false";

const REASONING_OPTIONS = [
  { value: "default", label: "未设置（继承）" },
  { value: "true", label: "支持（true）" },
  { value: "false", label: "不支持（false）" },
];

function readReasoning(override: ModelOverride): TriState {
  if (override.reasoning === true) return "true";
  if (override.reasoning === false) return "false";
  return "default";
}

export function ModelOverridesEditor({ overrides, onChange }: Props) {
  const [newId, setNewId] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const entries = Object.entries(overrides);

  const updateOverride = (id: string, patch: Partial<ModelOverride>) => {
    onChange({
      ...overrides,
      [id]: { ...overrides[id], ...patch },
    });
  };

  const removeOverride = (id: string) => {
    if (!window.confirm(`确定删除覆盖「${id}」？`)) return;
    const next = { ...overrides };
    delete next[id];
    onChange(next);
    if (expanded === id) setExpanded(null);
  };

  const addOverride = () => {
    const id = newId.trim();
    if (!id || overrides[id]) return;
    onChange({ ...overrides, [id]: {} });
    setNewId("");
    setExpanded(id);
  };

  return (
    <div className="form-section">
      <h3 className="form-section-title">模型覆盖 (modelOverrides)</h3>
      <p className="text-sm text-muted mb-sm">
        覆盖内建或扩展模型的属性，无需替换完整模型列表。只写需要改的字段。
      </p>

      <div className="input-group mb-md">
        <input
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          placeholder="内建模型 ID，如 gpt-5.6-sol"
          onKeyDown={(e) => e.key === "Enter" && addOverride()}
        />
        <button type="button" className="btn btn-sm btn-primary" onClick={addOverride}>
          添加覆盖
        </button>
      </div>

      {entries.length === 0 && <p className="text-sm text-muted">暂无覆盖项</p>}

      {entries.map(([id, override]) => (
        <div key={id} className="model-card">
          <div
            className="model-card-header"
            role="button"
            tabIndex={0}
            aria-expanded={expanded === id}
            onClick={() => setExpanded(expanded === id ? null : id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setExpanded(expanded === id ? null : id);
              }
            }}
          >
            <span className="model-card-title">{id}</span>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={(e) => {
                e.stopPropagation();
                removeOverride(id);
              }}
            >
              删除
            </button>
          </div>

          {expanded === id && (
            <div className="model-card-body">
              <div className="form-grid">
                <div className="form-field">
                  <label>显示名称</label>
                  <input
                    value={override.name ?? ""}
                    onChange={(e) =>
                      updateOverride(id, { name: e.target.value || undefined })
                    }
                    placeholder="未设置"
                  />
                </div>
                <div className="form-field">
                  <label>上下文窗口</label>
                  <input
                    type="number"
                    value={override.contextWindow ?? ""}
                    onChange={(e) =>
                      updateOverride(id, {
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
                    value={override.maxTokens ?? ""}
                    onChange={(e) =>
                      updateOverride(id, {
                        maxTokens: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="未设置"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`override-transport-${id}`}>Transport</label>
                  <Dropdown
                    id={`override-transport-${id}`}
                    value={override.transport ?? ""}
                    placeholder="未设置"
                    options={[
                      { value: "", label: "未设置" },
                      ...TRANSPORT_TYPES.map((t) => ({ value: t, label: t })),
                    ]}
                    onChange={(next) =>
                      updateOverride(id, {
                        transport: (next || undefined) as ModelOverride["transport"],
                      })
                    }
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`override-reasoning-${id}`}>推理</label>
                  <Dropdown
                    id={`override-reasoning-${id}`}
                    value={readReasoning(override)}
                    options={REASONING_OPTIONS}
                    onChange={(next) => {
                      if (next === "default") {
                        updateOverride(id, { reasoning: undefined });
                      } else {
                        updateOverride(id, { reasoning: next === "true" });
                      }
                    }}
                  />
                </div>
              </div>

              <KeyValueEditor
                label="Headers（可选）"
                value={override.headers ?? {}}
                onChange={(headers) =>
                  updateOverride(id, {
                    headers: Object.keys(headers).filter((k) => k.trim()).length
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
                  <textarea
                    className="json-editor"
                    style={{ minHeight: 100 }}
                    value={JSON.stringify(override.thinkingLevelMap ?? {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value) as Record<
                          string,
                          string | null
                        >;
                        updateOverride(id, {
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
                <summary>compat JSON</summary>
                <div className="collapsible-content">
                  <textarea
                    className="json-editor"
                    style={{ minHeight: 120 }}
                    value={JSON.stringify(override.compat ?? {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value) as Record<
                          string,
                          unknown
                        >;
                        updateOverride(id, {
                          compat: Object.keys(parsed).length ? parsed : undefined,
                        });
                      } catch {
                        // ignore
                      }
                    }}
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
