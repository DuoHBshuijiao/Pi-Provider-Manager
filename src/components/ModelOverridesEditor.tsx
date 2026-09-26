import { useId, useMemo, useState } from "react";
import type { ModelOverride } from "@shared/schema";
import { TRANSPORT_TYPES, builtinModelLabel, type BuiltinModelInfo } from "@shared/builtins";
import { Dropdown } from "./Dropdown";
import { KeyValueEditor } from "./KeyValueEditor";
import { ConfirmDialog } from "./ConfirmDialog";
import { HelpTip } from "./HelpTip";

interface Props {
  overrides: Record<string, ModelOverride>;
  onChange: (overrides: Record<string, ModelOverride>) => void;
  pathPrefix?: string;
  catalogModels?: readonly BuiltinModelInfo[];
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

function patchOverridePromptCache(
  override: ModelOverride,
  key: "short" | "long",
  raw: string,
): ModelOverride["promptCache"] {
  const next: NonNullable<ModelOverride["promptCache"]> = { ...(override.promptCache ?? {}) };
  if (raw === "") {
    delete next[key];
  } else {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return override.promptCache;
    next[key] = value;
  }
  return next.short != null || next.long != null ? next : undefined;
}

export function ModelOverridesEditor({
  overrides,
  onChange,
  pathPrefix,
  catalogModels = [],
}: Props) {
  const newIdField = useId();
  const errorId = useId();
  const [newId, setNewId] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const entries = Object.entries(overrides);
  const usePicker = catalogModels.length > 0;
  const pickerOptions = useMemo(
    () =>
      catalogModels
        .filter((model) => !overrides[model.id])
        .map((model) => ({ value: model.id, label: builtinModelLabel(model) })),
    [catalogModels, overrides],
  );

  const updateOverride = (id: string, patch: Partial<ModelOverride>) => {
    onChange({
      ...overrides,
      [id]: { ...overrides[id], ...patch },
    });
  };

  const removeOverride = (id: string) => {
    setPendingDelete(id);
  };

  const confirmRemoveOverride = () => {
    if (!pendingDelete) return;
    const id = pendingDelete;
    const next = { ...overrides };
    delete next[id];
    onChange(next);
    if (expanded === id) setExpanded(null);
    setPendingDelete(null);
  };

  const addOverride = (rawId = newId) => {
    const id = rawId.trim();
    setAddError(null);
    if (!id) {
      setAddError("请填写要覆盖的模型 ID");
      return;
    }
    if (overrides[id]) {
      setAddError(`「${id}」已有覆盖项`);
      setExpanded(id);
      return;
    }
    onChange({ ...overrides, [id]: {} });
    setNewId("");
    setExpanded(id);
  };

  return (
    <div className="form-section">
      <h3 className="form-section-title">模型覆盖 (modelOverrides)</h3>
      <p className="text-sm text-muted mb-sm">
        覆盖内建或扩展模型的属性，无需替换完整模型列表。只写需要改的字段。可从内建模型中选择，也可输入自定义
        ID。
      </p>

      <div className="input-group mb-sm">
        <label className="visually-hidden" htmlFor={newIdField}>
          要覆盖的模型 ID
        </label>
        {usePicker ? (
          <Dropdown
            id={newIdField}
            value={newId}
            placeholder="选择内建模型 ID"
            options={pickerOptions}
            searchable
            allowCustom
            aria-invalid={Boolean(addError) || undefined}
            aria-describedby={addError ? errorId : undefined}
            onChange={(next) => {
              setNewId(next);
              if (addError) setAddError(null);
              addOverride(next);
            }}
          />
        ) : (
          <input
            id={newIdField}
            value={newId}
            onChange={(e) => {
              setNewId(e.target.value);
              if (addError) setAddError(null);
            }}
            placeholder="模型 ID"
            aria-invalid={Boolean(addError) || undefined}
            aria-describedby={addError ? errorId : undefined}
            onKeyDown={(e) => e.key === "Enter" && addOverride()}
            autoComplete="off"
          />
        )}
        <button type="button" className="btn btn-sm btn-primary" onClick={() => addOverride()}>
          添加覆盖
        </button>
      </div>
      {addError && (
        <div id={errorId} className="alert alert-error mb-md" role="alert">
          {addError}
        </div>
      )}

      {entries.length === 0 && <p className="text-sm text-muted">暂无覆盖项</p>}

      {entries.map(([id, override]) => {
        const toggleId = `override-toggle-${id}`;
        const panelId = `override-panel-${id}`;
        const isOpen = expanded === id;
        return (
          <div key={id} className="model-card" data-config-path={pathPrefix ? `${pathPrefix}.${id}` : undefined}>
            <div className="model-card-header">
              <button
                type="button"
                id={toggleId}
                className="model-card-toggle"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setExpanded(isOpen ? null : id)}
              >
                <span className="model-card-title truncate">{id}</span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                aria-label={`删除覆盖 ${id}`}
                onClick={() => removeOverride(id)}
              >
                删除
              </button>
            </div>

            {isOpen && (
              <div
                className="model-card-body"
                id={panelId}
                role="region"
                aria-labelledby={toggleId}
              >
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor={`override-name-${id}`}>显示名称</label>
                    <input
                      id={`override-name-${id}`}
                      value={override.name ?? ""}
                      onChange={(e) =>
                        updateOverride(id, { name: e.target.value || undefined })
                      }
                      placeholder="未设置"
                      autoComplete="off"
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor={`override-context-${id}`}>上下文窗口</label>
                    <input
                      id={`override-context-${id}`}
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
                    <label htmlFor={`override-maxtokens-${id}`}>最大输出 Tokens</label>
                    <input
                      id={`override-maxtokens-${id}`}
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
                    <label htmlFor={`override-cache-short-${id}`}>
                      promptCache.short（秒）
                      <HelpTip
                        label="promptCache.short"
                        text="短缓存档声明寿命，仅供 cache warming，不启用 ttl。"
                      />
                    </label>
                    <input
                      id={`override-cache-short-${id}`}
                      type="number"
                      min={1}
                      value={override.promptCache?.short ?? ""}
                      placeholder="未设置"
                      onChange={(e) =>
                        updateOverride(id, {
                          promptCache: patchOverridePromptCache(override, "short", e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor={`override-cache-long-${id}`}>
                      promptCache.long（秒）
                      <HelpTip
                        label="promptCache.long"
                        text="长缓存档声明寿命，仅供 warming。要发 1 小时 ttl 请用顶栏启用长缓存。"
                      />
                    </label>
                    <input
                      id={`override-cache-long-${id}`}
                      type="number"
                      min={1}
                      value={override.promptCache?.long ?? ""}
                      placeholder="未设置"
                      onChange={(e) =>
                        updateOverride(id, {
                          promptCache: patchOverridePromptCache(override, "long", e.target.value),
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
                    <label
                      className="visually-hidden"
                      htmlFor={`override-thinking-${id}`}
                    >
                      thinkingLevelMap JSON
                    </label>
                    <textarea
                      id={`override-thinking-${id}`}
                      className="json-editor"
                      style={{ minHeight: 100 }}
                      value={JSON.stringify(override.thinkingLevelMap ?? {}, null, 2)}
                      spellCheck={false}
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
                    <label className="visually-hidden" htmlFor={`override-compat-${id}`}>
                      compat JSON
                    </label>
                    <textarea
                      id={`override-compat-${id}`}
                      className="json-editor"
                      style={{ minHeight: 120 }}
                      value={JSON.stringify(override.compat ?? {}, null, 2)}
                      spellCheck={false}
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
        );
      })}

      {pendingDelete && (
        <ConfirmDialog
          title={`删除覆盖「${pendingDelete}」？`}
          message="此操作只改内存中的配置，需保存后才会写入磁盘。"
          confirmLabel="删除"
          danger
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmRemoveOverride}
        />
      )}
    </div>
  );
}
