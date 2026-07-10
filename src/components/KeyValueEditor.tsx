interface Props {
  label: string;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}

export function KeyValueEditor({ label, value, onChange }: Props) {
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
    <div className="form-section">
      <h3 className="form-section-title">{label}</h3>
      {entries.map(([k, v], i) => (
        <div key={`${k}-${i}`} className="kv-row">
          <div className="form-field">
            <label>键</label>
            <input
              value={k}
              onChange={(e) => update(i, e.target.value, v)}
              placeholder="header-name"
            />
          </div>
          <div className="form-field">
            <label>值</label>
            <input
              value={v}
              onChange={(e) => update(i, k, e.target.value)}
              placeholder="$ENV_VAR 或字面量"
              className="masked-input"
            />
          </div>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(i)}>
            删除
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-sm" onClick={add}>
        + 添加
      </button>
    </div>
  );
}
