import { useMemo, useState } from "react";
import type { ModelsConfig } from "@shared/schema";

interface Props {
  config: ModelsConfig;
  selected: string | null;
  onSelect: (name: string) => void;
  builtinIds?: readonly string[];
}

export function ProviderList({ config, selected, onSelect, builtinIds = [] }: Props) {
  const [filter, setFilter] = useState("");
  const names = Object.keys(config.providers).sort();
  const builtinSet = useMemo(() => new Set(builtinIds), [builtinIds]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return names;
    return names.filter((name) => {
      const provider = config.providers[name]!;
      const hay = [
        name,
        provider.baseUrl ?? "",
        provider.api ?? "",
        ...(provider.models?.map((m) => m.id) ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [names, filter, config.providers]);

  if (names.length === 0) {
    return (
      <div className="empty-state" role="status">
        <p>暂无 Provider</p>
        <p className="text-sm">点上方「+ 新建」开始</p>
      </div>
    );
  }

  return (
    <div className="provider-list-wrap">
      <div className="provider-filter">
        <label className="visually-hidden" htmlFor="provider-filter">
          过滤 Provider
        </label>
        <input
          id="provider-filter"
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="过滤名称 / URL / 模型…"
          autoComplete="off"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state" role="status">
          <p>无匹配项</p>
          <p className="text-sm">试试更短的关键字</p>
        </div>
      ) : (
        <ul className="provider-list" aria-label="已配置的 Providers">
          {filtered.map((name) => {
            const provider = config.providers[name]!;
            const builtin = builtinSet.has(name);
            const modelCount = provider.models?.length ?? 0;
            const overrideCount = Object.keys(provider.modelOverrides ?? {}).length;
            const isSelected = selected === name;

            return (
              <li key={name}>
                <button
                  type="button"
                  className={`provider-item ${isSelected ? "active" : ""}`}
                  aria-current={isSelected ? "true" : undefined}
                  onClick={() => onSelect(name)}
                >
                  <div className="provider-item-name truncate" title={name}>
                    {name}
                  </div>
                  <div className="provider-item-meta">
                    <span className={`badge ${builtin ? "badge-builtin" : "badge-third"}`}>
                      {builtin ? "内建" : "第三方"}
                    </span>
                    {modelCount > 0 && <span>{modelCount} 模型</span>}
                    {overrideCount > 0 && <span>{overrideCount} 覆盖</span>}
                    {provider.baseUrl && (
                      <span className="truncate" title={provider.baseUrl}>
                        {provider.baseUrl}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
