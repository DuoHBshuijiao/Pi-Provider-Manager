import {
  COMPAT_HELP,
  COMPAT_LABELS,
  getCompatFieldsForApi,
  type CompatBoolField,
} from "@shared/builtins";
import { Dropdown } from "./Dropdown";
import { HelpTip } from "./HelpTip";

interface Props {
  compat: Record<string, unknown> | undefined;
  onChange: (compat: Record<string, unknown>) => void;
  apiType?: string;
}

type TriState = "default" | "true" | "false";

const TRI_OPTIONS = [
  { value: "default", label: "默认（不写字段）" },
  { value: "true", label: "支持（true）" },
  { value: "false", label: "不支持（false）" },
];

function readTriState(current: Record<string, unknown>, field: string): TriState {
  if (!(field in current)) return "default";
  if (current[field] === true) return "true";
  if (current[field] === false) return "false";
  return "default";
}

export function CompatEditor({ compat, onChange, apiType }: Props) {
  const current = compat ?? {};
  const groups = getCompatFieldsForApi(apiType);

  const setTriState = (field: string, state: TriState) => {
    const next = { ...current };
    if (state === "default") {
      delete next[field];
    } else if (state === "true") {
      next[field] = true;
    } else {
      next[field] = false;
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

  const renderField = (field: CompatBoolField) => {
    const label = COMPAT_LABELS[field] ?? field;
    const help = COMPAT_HELP[field];
    return (
      <div key={field} className="form-field compat-field">
        <label htmlFor={`compat-${field}`} className="compat-label">
          <span>{label}</span>
          {help && <HelpTip text={help} label={label} />}
        </label>
        <Dropdown
          id={`compat-${field}`}
          value={readTriState(current, field)}
          options={TRI_OPTIONS}
          onChange={(next) => setTriState(field, next as TriState)}
        />
      </div>
    );
  };

  return (
    <div className="form-section">
      <h3 className="form-section-title">兼容性 (compat)</h3>
      <p className="text-sm text-muted mb-sm compat-hint">
        默认 = 不写该字段，交由 Pi 按协议决定。仅在接口报错、代理文档明确要求或排障时覆盖默认值。
      </p>

      {groups.primary.length > 0 ? (
        <div className="form-grid compat-grid">{groups.primary.map(renderField)}</div>
      ) : (
        <p className="text-sm text-muted">当前 API 类型无常用兼容项，请使用下方高级 JSON。</p>
      )}

      {groups.advanced.length > 0 && (
        <details className="collapsible">
          <summary>高级兼容项</summary>
          <div className="collapsible-content">
            <div className="form-grid compat-grid">{groups.advanced.map(renderField)}</div>
          </div>
        </details>
      )}

      <details className="collapsible">
        <summary>高级 JSON 编辑</summary>
        <div className="collapsible-content">
          <p className="text-sm text-muted mb-sm">
            可编辑全部 compat 字段（含 UI 未列出的项）。无效 JSON 不会写入。
          </p>
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
