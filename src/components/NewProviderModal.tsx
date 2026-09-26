import { useEffect, useId, useRef, useState } from "react";
import type { ProviderConfig } from "@shared/schema";
import { createDefaultProvider } from "@shared/schema";
import { builtinProviderLabel, type BuiltinProviderInfo } from "@shared/builtins";
import { Dropdown } from "./Dropdown";

type Mode = "third-party" | "builtin";

interface Props {
  builtinCatalog: BuiltinProviderInfo[];
  apiTypes: string[];
  existingNames: string[];
  onClose: () => void;
  onCreate: (name: string, provider: ProviderConfig) => void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function NewProviderModal({
  builtinCatalog,
  apiTypes,
  existingNames,
  onClose,
  onCreate,
}: Props) {
  const titleId = useId();
  const errorId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [mode, setMode] = useState<Mode>("third-party");
  const [name, setName] = useState("");
  const [builtinName, setBuiltinName] = useState(builtinCatalog[0]?.id ?? "anthropic");
  const [baseUrl, setBaseUrl] = useState("");
  const [api, setApi] = useState(apiTypes[0] ?? "openai-completions");
  const [error, setError] = useState<string | null>(null);

  const finalName = mode === "builtin" ? builtinName : name.trim();

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 等首帧渲染后聚焦类型下拉
    requestAnimationFrame(() => {
      document.getElementById("provider-mode")?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // 先让打开的下拉菜单自己关掉，不连带关弹窗
        if (document.querySelector(".dropdown-menu")) return;
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
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
      const url = baseUrl.trim();
      if (!url) {
        setError("第三方 Provider 需要填写 Base URL");
        return;
      }
      try {
        const candidate = url.includes("://") ? url : `https://${url}`;
        const parsed = new URL(candidate);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          setError("Base URL 格式无效，请使用完整地址（如 https://api.example.com/v1）");
          return;
        }
        if (!parsed.hostname) {
          setError("Base URL 格式无效，请使用完整地址（如 https://api.example.com/v1）");
          return;
        }
        provider.baseUrl = candidate;
        provider.api = api as ProviderConfig["api"];
      } catch {
        setError("Base URL 格式无效，请使用完整地址（如 https://api.example.com/v1）");
        return;
      }
    } else {
      delete provider.baseUrl;
      delete provider.api;
      delete provider.apiKey;
    }

    onCreate(finalName, provider);
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={error ? errorId : undefined}
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
              onChange={(next) => {
                setMode(next as Mode);
                setError(null);
              }}
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
                  aria-required="true"
                  aria-invalid={Boolean(error && !name.trim()) || undefined}
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
                  inputMode="url"
                  aria-required="true"
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
                <p className="text-sm text-muted mt-xs">
                  Anthropic 兼容代理请选 anthropic-messages，才会发 cache_control.ttl。openai-completions
                  在长缓存开启时发的是 prompt_cache_retention: 24h。
                </p>
              </div>
            </>
          ) : (
            <div className="form-field">
              <label htmlFor="provider-builtin">内建 Provider *</label>
              <Dropdown
                id="provider-builtin"
                value={builtinName}
                options={builtinCatalog.map((provider) => ({
                  value: provider.id,
                  label: builtinProviderLabel(provider.id, builtinCatalog),
                }))}
                onChange={setBuiltinName}
                disabled={builtinCatalog.length === 0}
                searchable
              />
              <p className="text-sm text-muted mt-xs" id="builtin-hint">
                可为内建 Provider 追加 models 或设置 modelOverrides。Base URL 与 API Key 请留空，在 Pi
                里用 /login 登录该供应商。
              </p>
            </div>
          )}

          {error && (
            <div id={errorId} className="alert alert-error mt-md mb-0" role="alert">
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
