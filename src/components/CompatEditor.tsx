import { COMPAT_BOOL_FIELDS, COMPAT_LABELS } from "@shared/builtins";

interface Props {
  compat: Record<string, unknown> | undefined;
  onChange: (compat: Record<string, unknown>) => void;
}

export function CompatEditor({ compat, onChange }: Props) {
  const current = compat ?? {};

  const toggle = (field: string, checked: boolean) => {
    const next = { ...current };
    if (checked) {
      next[field] = true;
    } else {
      delete next[field];
    }
    onChange(next);
  };

  const handleJsonChange = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      onChange(parsed);
    } catch {
      // ignore invalid JSON while typing
    }
  };

  return (
    <div className="form-section">
      <h3 className="form-section-title">兼容性 (compat)</h3>
      <div className="form-grid">
        {COMPAT_BOOL_FIELDS.map((field) => (
          <label key={field} className="checkbox-row">
            <input
              type="checkbox"
              checked={current[field] === true}
              onChange={(e) => toggle(field, e.target.checked)}
            />
            <span>{COMPAT_LABELS[field] ?? field}</span>
          </label>
        ))}
      </div>

      <details className="collapsible">
        <summary>高级 JSON 编辑</summary>
        <div className="collapsible-content">
          <textarea
            className="json-editor"
            style={{ minHeight: 160 }}
            value={JSON.stringify(current, null, 2)}
            onChange={(e) => handleJsonChange(e.target.value)}
          />
        </div>
      </details>
    </div>
  );
}
