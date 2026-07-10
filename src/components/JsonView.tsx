import { useEffect, useState } from "react";
import type { ModelsConfig } from "@shared/schema";
import { validateConfig } from "../api";

interface Props {
  config: ModelsConfig;
  onApply: (config: ModelsConfig) => void;
}

export function JsonView({ config, onApply }: Props) {
  const [raw, setRaw] = useState(() => JSON.stringify(config, null, 2));
  const [editable, setEditable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Array<{ path: string; message: string }>>([]);

  useEffect(() => {
    if (!editable) {
      setRaw(JSON.stringify(config, null, 2));
    }
  }, [config, editable]);

  const handleApply = async () => {
    setError(null);
    setIssues([]);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setError("JSON 格式无效");
      return;
    }

    const validation = await validateConfig(parsed);
    if (!validation.success || !validation.data) {
      setIssues(validation.issues);
      setError("配置校验未通过");
      return;
    }

    onApply(validation.data);
    setEditable(false);
  };

  const handleSync = () => {
    setRaw(JSON.stringify(config, null, 2));
    setError(null);
    setIssues([]);
  };

  return (
    <div>
      <div className="row-actions mb-sm">
        <button
          type="button"
          className={`btn btn-sm ${editable ? "btn-primary" : ""}`}
          onClick={() => setEditable(!editable)}
        >
          {editable ? "编辑中" : "启用编辑"}
        </button>
        <button type="button" className="btn btn-sm" onClick={handleSync}>
          从表单同步
        </button>
        {editable && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void handleApply()}>
            应用到表单
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
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

      <textarea
        className="json-editor"
        value={raw}
        readOnly={!editable}
        onChange={(e) => setRaw(e.target.value)}
      />
    </div>
  );
}
