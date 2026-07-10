import type { ModelsConfig } from "@shared/schema";
import { isBuiltinProvider } from "@shared/builtins";

interface Props {
  config: ModelsConfig;
  selected: string | null;
  onSelect: (name: string) => void;
}

export function ProviderList({ config, selected, onSelect }: Props) {
  const names = Object.keys(config.providers).sort();

  if (names.length === 0) {
    return (
      <div className="empty-state">
        <p>暂无 Provider</p>
        <p className="text-sm">点上方「+ 新建」开始</p>
      </div>
    );
  }

  return (
    <ul className="provider-list" role="listbox" aria-label="已配置的 Providers">
      {names.map((name) => {
        const provider = config.providers[name]!;
        const builtin = isBuiltinProvider(name);
        const modelCount = provider.models?.length ?? 0;
        const overrideCount = Object.keys(provider.modelOverrides ?? {}).length;
        const isSelected = selected === name;

        return (
          <li key={name} role="none">
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`provider-item ${isSelected ? "active" : ""}`}
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
  );
}
