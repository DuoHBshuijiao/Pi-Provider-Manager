import { useId } from "react";

interface Props {
  label: string;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  pathPrefix?: string;
}

export function KeyValueEditor({ label, value, onChange, pathPrefix }: Props) {
  const baseId = useId();
  const entries = Object.entries(value);

  const update = (index: number, key: string, val: string) => {
    const next = { ...value };
    const oldKey = entries[index]?.[0];
    if (oldKey && oldKey !== key) {
      delete next[oldKey];
    }
    if (key) {
      next[key] = val;
    }
    onChange(next);
  };

  const remove = (index: number) => {
    const next = { ...value };
    const key = entries[index]?.[0];
    if (key) delete next[key];
    onChange(next);
  };

  const add = () => {
    onChange({ ...value, "": "" });
  };

  return (
    <div className={label ? "form-section" : undefined}>
      {label ? <h3 className="form-section-title">{label}</h3> : null}
      {entries.length === 0 && (
        <p className="text-sm text-muted mb-sm">暂无条目。点击下方添加键值对。</p>
      )}
      {entries.map(([k, v], i) => {
        const keyId = `${baseId}-key-${i}`;
        const valId = `${baseId}-val-${i}`;
        return (
          <div key={`${baseId}-${i}`} className="kv-row">
            <div className="form-field">
              <label htmlFor={keyId}>键</label>
              <input
                id={keyId}
                data-config-path={pathPrefix ? `${pathPrefix}.${k || i}` : undefined}
                value={k}
                onChange={(e) => update(i, e.target.value, v)}
                placeholder="header-name"
                autoComplete="off"
              />
            </div>
            <div className="form-field">
              <label htmlFor={valId}>值</label>
              <input
                id={valId}
                value={v}
                onChange={(e) => update(i, k, e.target.value)}
                placeholder="$ENV_VAR 或字面量"
                className="masked-input"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              aria-label={`删除键「${k || "空"}」`}
              onClick={() => remove(i)}
            >
              删除
            </button>
          </div>
        );
      })}
      <button type="button" className="btn btn-sm" onClick={add}>
        + 添加
      </button>
    </div>
  );
}
