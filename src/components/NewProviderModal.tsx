import { useEffect, useId, useState } from "react";
import type { ProviderConfig } from "@shared/schema";
import { createDefaultProvider } from "@shared/schema";
import { Dropdown } from "./Dropdown";

type Mode = "third-party" | "builtin";

interface Props {
  builtinProviders: string[];
  apiTypes: string[];
  existingNames: string[];
  onClose: () => void;
  onCreate: (name: string, provider: ProviderConfig) => void;
}

export function NewProviderModal({
  builtinProviders,
  apiTypes,
  existingNames,
  onClose,
  onCreate,
}: Props) {
  const titleId = useId();
  const [mode, setMode] = useState<Mode>("third-party");
  const [name, setName] = useState("");
  const [builtinName, setBuiltinName] = useState(builtinProviders[0] ?? "anthropic");
  const [baseUrl, setBaseUrl] = useState("");
  const [api, setApi] = useState(apiTypes[0] ?? "openai-completions");
  const [error, setError] = useState<string | null>(null);

  const finalName = mode === "builtin" ? builtinName : name.trim();

  useEffect(() => {
    document.getElementById("provider-mode")?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // 先让打开的下拉菜单自己关掉，不连带关弹窗
      if (document.querySelector(".dropdown-menu")) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleCreate = () => {
    setError(null);

    if (!finalName) {
      setError("请填写 Provider 名称");
      return;
    }

    if (existingNames.includes(finalName)) {
      setError(`「${finalName}」已存在，请换一个名称`);
      return;
    }

    const provider = createDefaultProvider();

    if (mode === "third-party") {
      if (!baseUrl.trim()) {
        setError("第三方 Provider 需要填写 Base URL");
        return;
      }
      provider.baseUrl = baseUrl.trim();
      provider.api = api as ProviderConfig["api"];
    } else {
      delete provider.baseUrl;
      delete provider.api;
      delete provider.apiKey;
    }

    onCreate(finalName, provider);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" id={titleId}>
          新建 Provider
        </div>
        <div className="modal-body">
          <div className="form-field mb-md">
            <label htmlFor="provider-mode">类型</label>
            <Dropdown
              id="provider-mode"
              value={mode}
              options={[
                { value: "third-party", label: "第三方 Provider" },
                { value: "builtin", label: "扩展内建 Provider" },
              ]}
              onChange={(next) => setMode(next as Mode)}
            />
          </div>

          {mode === "third-party" ? (
            <>
              <div className="form-field mb-sm">
                <label htmlFor="provider-name">名称 *</label>
                <input
                  id="provider-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如 zenmux、ark"
                  autoComplete="off"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <div className="form-field mb-sm">
                <label htmlFor="provider-baseurl">Base URL *</label>
                <input
                  id="provider-baseurl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  autoComplete="off"
                />
              </div>
              <div className="form-field">
                <label htmlFor="provider-api">API 类型 *</label>
                <Dropdown
                  id="provider-api"
                  value={api}
                  options={apiTypes.map((t) => ({ value: t, label: t }))}
                  onChange={setApi}
                />
              </div>
            </>
          ) : (
            <div className="form-field">
              <label htmlFor="provider-builtin">内建 Provider *</label>
              <Dropdown
                id="provider-builtin"
                value={builtinName}
                options={builtinProviders.map((p) => ({ value: p, label: p }))}
                onChange={setBuiltinName}
              />
              <p className="text-sm text-muted mt-xs">
                可为内建 Provider 追加 models 或设置 modelOverrides，无需重新定义全部模型。
              </p>
            </div>
          )}

          {error && (
            <div className="alert alert-error mt-md mb-0" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={handleCreate}>
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
