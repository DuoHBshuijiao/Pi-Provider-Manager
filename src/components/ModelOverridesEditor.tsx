import { useState } from "react";
import type { ModelOverride } from "@shared/schema";

interface Props {
  overrides: Record<string, ModelOverride>;
  onChange: (overrides: Record<string, ModelOverride>) => void;
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
        覆盖内建或扩展模型的属性，无需替换完整模型列表。
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

      {entries.length === 0 && (
        <p className="text-sm text-muted">暂无覆盖项</p>
      )}

      {entries.map(([id, override]) => (
        <div key={id} className="model-card">
          <div
            className="model-card-header"
            onClick={() => setExpanded(expanded === id ? null : id)}
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
                  />
                </div>
                <div className="form-field">
                  <label>上下文窗口</label>
                  <input
                    type="number"
                    value={override.contextWindow ?? ""}
                    onChange={(e) =>
                      updateOverride(id, {
                        contextWindow: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
                <div className="form-field">
                  <label>最大输出 Tokens</label>
                  <input
                    type="number"
                    value={override.maxTokens ?? ""}
                    onChange={(e) =>
                      updateOverride(id, {
                        maxTokens: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={override.reasoning ?? false}
                    onChange={(e) =>
                      updateOverride(id, { reasoning: e.target.checked || undefined })
                    }
                  />
                  <span>支持推理</span>
                </label>
              </div>

              <details className="collapsible">
                <summary>compat JSON</summary>
                <div className="collapsible-content">
                  <textarea
                    className="json-editor"
                    style={{ minHeight: 120 }}
                    value={JSON.stringify(override.compat ?? {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value) as Record<string, unknown>;
                        updateOverride(id, { compat: parsed });
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
