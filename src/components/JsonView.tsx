import { useEffect, useId, useState } from "react";
import type { ModelsConfig } from "@shared/schema";
import { validateConfig } from "../api";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  config: ModelsConfig;
  onApply: (config: ModelsConfig) => void;
}

export function JsonView({ config, onApply }: Props) {
  const editorId = useId();
  const errorId = useId();
  const [raw, setRaw] = useState(() => JSON.stringify(config, null, 2));
  const [editable, setEditable] = useState(false);
  const [applying, setApplying] = useState(false);
  const [pendingApply, setPendingApply] = useState<ModelsConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Array<{ path: string; message: string }>>([]);

  useEffect(() => {
    if (!editable) {
      setRaw(JSON.stringify(config, null, 2));
    }
  }, [config, editable]);

  const handleApply = async () => {
    if (applying) return;
    setApplying(true);
    setError(null);
    setIssues([]);

    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        setError("JSON 格式无效，请检查括号、逗号与引号");
        return;
      }

      const validation = await validateConfig(parsed);
      if (!validation.success || !validation.data) {
        setIssues(validation.issues);
        setError("配置校验未通过，请根据下方问题修正后再应用");
        return;
      }

      setPendingApply(validation.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "校验请求失败");
    } finally {
      setApplying(false);
    }
  };

  const handleSync = () => {
    setRaw(JSON.stringify(config, null, 2));
    setError(null);
    setIssues([]);
  };

  return (
    <div>
      <div className="alert alert-info mb-md" role="status">
        这是<strong>整份</strong> <code>models.json</code>
        的逃生口编辑器，不是单个 Provider 的片段。应用后仍需点顶栏「保存配置」才会写入磁盘。
      </div>

      <div className="row-actions mb-sm">
        <button
          type="button"
          className="btn btn-sm"
          aria-pressed={editable}
          onClick={() => setEditable(!editable)}
        >
          {editable ? "退出编辑" : "启用编辑"}
        </button>
        <button type="button" className="btn btn-sm" onClick={handleSync}>
          从表单同步
        </button>
        {editable && (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => void handleApply()}
            disabled={applying}
            aria-busy={applying}
          >
            {applying ? "校验中…" : "应用到表单"}
          </button>
        )}
      </div>

      {error && (
        <div id={errorId} className="alert alert-error" role="alert">
          {error}
          {issues.length > 0 && (
            <ul className="issue-list">
              {issues.map((issue) => (
                <li key={`${issue.path}-${issue.message}`}>
                  <code>{issue.path || "(root)"}</code>: {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label className="visually-hidden" htmlFor={editorId}>
        models.json 整文件内容
      </label>
      <textarea
        id={editorId}
        className="json-editor"
        value={raw}
        readOnly={!editable}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errorId : undefined}
        spellCheck={false}
        onChange={(e) => setRaw(e.target.value)}
      />

      {pendingApply && (
        <ConfirmDialog
          title="应用到表单？"
          message="将用这份 JSON 替换当前内存中的全部配置（所有 Provider）。不会立刻写盘，仍需保存。"
          confirmLabel="应用到表单"
          danger
          onCancel={() => setPendingApply(null)}
          onConfirm={() => {
            onApply(pendingApply);
            setPendingApply(null);
            setEditable(false);
          }}
        />
      )}
    </div>
  );
}
