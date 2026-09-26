import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { ModelsConfig, ProviderConfig } from "@shared/schema";
import { createEmptyConfig, newlyFilledBuiltinBaseUrls } from "@shared/schema";
import { findCatalogProvider } from "@shared/builtins";
import { applyPatches, buildThirdPartyLongCachePatches } from "@shared/long-cache";
import {
  disableLongCache,
  enableLongCache,
  fetchConfig,
  fetchLongCacheStatus,
  fetchMeta,
  markLongCacheModelsPersisted,
  saveConfig,
  validateConfig,
  type LongCacheStatus,
  type MetaResponse,
} from "./api";
import { focusConfigPath, providerNameFromPath } from "./focus-path";
import { ProviderList } from "./components/ProviderList";
import { ProviderEditor } from "./components/ProviderEditor";
import { JsonView } from "./components/JsonView";
import { NewProviderModal } from "./components/NewProviderModal";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { LongCacheControl } from "./components/LongCacheControl";

type Workspace = "providers" | "json";

interface PendingConfirm {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

export default function App() {
  const providersTabId = useId();
  const jsonTabId = useId();
  const providersPanelId = useId();
  const jsonPanelId = useId();
  const errorRef = useRef<HTMLDivElement>(null);

  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [config, setConfig] = useState<ModelsConfig>(createEmptyConfig());
  const [savedConfig, setSavedConfig] = useState<ModelsConfig>(createEmptyConfig());
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>("providers");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [successBackup, setSuccessBackup] = useState<string | null>(null);
  const [showBackupPath, setShowBackupPath] = useState(false);
  const [fileExists, setFileExists] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const confirmRef = useRef<PendingConfirm | null>(null);
  confirmRef.current = confirm;
  const [validationIssues, setValidationIssues] = useState<
    Array<{ path: string; message: string }>
  >([]);
  const [cacheStatus, setCacheStatus] = useState<LongCacheStatus | null>(null);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [cacheError, setCacheError] = useState<string | null>(null);

  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);
  const providerNames = Object.keys(config.providers);

  const load = useCallback(async (preserveSelection = false) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setSuccessBackup(null);
    setLoadFailed(false);
    setValidationIssues([]);
    try {
      const [metaResult, configResult, cacheResult] = await Promise.allSettled([
        fetchMeta(),
        fetchConfig(),
        fetchLongCacheStatus(),
      ]);

      if (metaResult.status === "fulfilled") {
        setMeta(metaResult.value);
      }

      if (cacheResult.status === "fulfilled") {
        setCacheStatus(cacheResult.value);
        setCacheError(null);
      } else {
        setCacheStatus(null);
        const reason = cacheResult.reason;
        setCacheError(reason instanceof Error ? reason.message : "无法读取长缓存状态");
      }

      if (configResult.status === "fulfilled") {
        const configRes = configResult.value;
        setConfig(configRes.config);
        setSavedConfig(configRes.config);
        setFileExists(configRes.exists);
        const issues = configRes.issues ?? [];
        setValidationIssues(issues);
        if (issues.length > 0) {
          setError("当前配置未通过校验，可在界面中修正后再保存");
        }

        if (!preserveSelection) {
          const providers = Object.keys(configRes.config.providers);
          setSelectedProvider((current) => current ?? providers[0] ?? null);
        }
      } else {
        setLoadFailed(true);
        const reason = configResult.reason;
        setError(reason instanceof Error ? reason.message : "加载失败");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => {
      setSuccess(null);
      setSuccessBackup(null);
      setShowBackupPath(false);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!error) return;
    errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const persistConfig = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    setSuccessBackup(null);
    setValidationIssues([]);

    try {
      const validation = await validateConfig(config);
      if (!validation.success) {
        setValidationIssues(validation.issues);
        setError("配置校验未通过，请修正后再保存");
        return;
      }

      const result = await saveConfig(config);
      setSavedConfig(config);
      setFileExists(true);
      setSuccess("配置已保存");
      setSuccessBackup(result.backupPath);
      setShowBackupPath(false);
      if (cacheStatus?.owned) {
        try {
          const marked = await markLongCacheModelsPersisted();
          setCacheStatus(marked.status);
        } catch {
          // 环境变量已生效；models 快照标记失败不阻断保存
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [saving, config, cacheStatus?.owned]);

  const handleEnableLongCache = async (patchModels: boolean) => {
    setCacheBusy(true);
    setCacheError(null);
    try {
      const thirdParty =
        Boolean(selectedProvider) &&
        !findCatalogProvider(meta?.builtinCatalog, selectedProvider ?? "");
      const patches =
        patchModels && thirdParty && selectedProvider
          ? buildThirdPartyLongCachePatches(config, selectedProvider)
          : [];
      const result = await enableLongCache(patches);
      setCacheStatus(result.status);
      if (patches.length > 0) {
        setConfig((prev) => applyPatches(prev, patches, "forward"));
      }
      setSuccess("已写入用户环境变量 PI_CACHE_RETENTION=long。新开能继承该变量的 Pi 才会发长缓存。");
    } catch (err) {
      const message = err instanceof Error ? err.message : "启用长缓存失败";
      setCacheError(message);
      throw err;
    } finally {
      setCacheBusy(false);
    }
  };

  const handleDisableLongCache = async () => {
    setCacheBusy(true);
    setCacheError(null);
    try {
      const result = await disableLongCache();
      setCacheStatus(result.status);
      if (result.modelsPatches.length > 0) {
        setConfig((prev) => applyPatches(prev, result.modelsPatches, "reverse"));
        if (result.diskPatched) {
          setSavedConfig((prev) => applyPatches(prev, result.modelsPatches, "reverse"));
        }
      }
      setSuccess("已按快照还原长缓存设置");
    } catch (err) {
      const message = err instanceof Error ? err.message : "关闭长缓存失败";
      setCacheError(message);
      throw err;
    } finally {
      setCacheBusy(false);
    }
  };

  const handleSave = useCallback(() => {
    if (saving || !isDirty || confirmRef.current) return;
    const overrides = newlyFilledBuiltinBaseUrls(
      savedConfig,
      config,
      meta?.builtinProviders,
    );
    if (overrides.length > 0) {
      setConfirm({
        title: "覆盖内建地址？",
        message: `为 ${overrides.map((n) => `「${n}」`).join("、")} 填写 Base URL 会覆盖 Pi 内建的官方根地址。本供应商下所有模型（含内建列表和追加模型）都将走这个地址。确定保存？`,
        confirmLabel: "覆盖并保存",
        danger: true,
        onConfirm: () => {
          setConfirm(null);
          void persistConfig();
        },
      });
      return;
    }
    void persistConfig();
  }, [saving, isDirty, savedConfig, config, persistConfig, meta?.builtinProviders]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") {
        return;
      }
      event.preventDefault();
      void handleSave();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  const handleReload = () => {
    if (!isDirty) {
      void load(true);
      return;
    }
    setConfirm({
      title: "丢弃未保存更改？",
      message: "重新加载会丢失当前内存中的修改，磁盘上的文件不会被改写。",
      confirmLabel: "丢弃并重新加载",
      danger: true,
      onConfirm: () => {
        setConfirm(null);
        void load(true);
      },
    });
  };

  const handleProviderChange = (name: string, provider: ProviderConfig) => {
    setConfig((prev) => ({
      ...prev,
      providers: { ...prev.providers, [name]: provider },
    }));
  };

  const performDeleteProvider = (name: string) => {
    setConfig((prev) => {
      const next = { ...prev.providers };
      delete next[name];
      return { ...prev, providers: next };
    });
    if (selectedProvider === name) {
      const remaining = providerNames.filter((k) => k !== name);
      setSelectedProvider(remaining[0] ?? null);
    }
  };

  const handleDeleteProvider = (name: string) => {
    setConfirm({
      title: `删除 Provider「${name}」？`,
      message: "此操作只改内存中的配置，需点「保存配置」后才会写入磁盘。",
      confirmLabel: "删除",
      danger: true,
      onConfirm: () => {
        setConfirm(null);
        performDeleteProvider(name);
      },
    });
  };

  const handleAddProvider = (name: string, provider: ProviderConfig) => {
    setConfig((prev) => ({
      ...prev,
      providers: { ...prev.providers, [name]: provider },
    }));
    setSelectedProvider(name);
    setWorkspace("providers");
    setShowNewModal(false);
  };

  const handleJsonApply = (newConfig: ModelsConfig) => {
    setConfig(newConfig);
    setWorkspace("providers");
    const providers = Object.keys(newConfig.providers);
    if (selectedProvider && newConfig.providers[selectedProvider]) return;
    setSelectedProvider(providers[0] ?? null);
  };

  const jumpToIssue = (path: string) => {
    setWorkspace("providers");
    const providerName = providerNameFromPath(path);
    if (providerName && config.providers[providerName]) {
      setSelectedProvider(providerName);
    }
    window.setTimeout(() => {
      focusConfigPath(path);
    }, 80);
  };

  const onWorkspaceKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next: Workspace = workspace === "providers" ? "json" : "providers";
    setWorkspace(next);
    const targetId = next === "providers" ? providersTabId : jsonTabId;
    requestAnimationFrame(() => {
      document.getElementById(targetId)?.focus();
    });
  };

  if (loading) {
    return (
      <div className="app">
        <a href="#main-content" className="skip-link">
          跳到主要内容
        </a>
        <div className="loading" role="status" aria-live="polite">
          <div className="skeleton skeleton-title" aria-hidden="true" />
          <div className="skeleton skeleton-line" aria-hidden="true" />
          <div className="skeleton skeleton-panel" aria-hidden="true" />
          <p className="text-muted mt-md">正在读取 models.json…</p>
        </div>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="app">
        <a href="#main-content" className="skip-link">
          跳到主要内容
        </a>
        <header className="app-header">
          <div>
            <h1 className="brand">Pi Provider Manager</h1>
            <p className="subtitle">管理本地 Pi Agent 的 models.json</p>
            {meta && (
              <p className="path-hint" title={meta.modelsJsonPath}>
                <span className="visually-hidden">配置文件路径：</span>
                {meta.modelsJsonPath}
              </p>
            )}
          </div>
        </header>
        <div
          ref={errorRef}
          id="main-content"
          className="alert alert-error"
          role="alert"
          tabIndex={-1}
        >
          <p className="mb-sm">{error ?? "加载失败"}</p>
          <p className="text-sm mb-sm">
            JSON 语法错误或读盘失败时无法进入编辑界面。请先修正磁盘上的文件后再重试。
          </p>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void load()}>
            重试
          </button>
        </div>
      </div>
    );
  }

  const currentProvider = selectedProvider
    ? config.providers[selectedProvider]
    : undefined;

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">
        跳到主要内容
      </a>

      <header className="app-header">
        <div>
          <h1 className="brand">Pi Provider Manager</h1>
          <p className="subtitle">管理本地 Pi Agent 的 models.json</p>
          {meta && (
            <p className="path-hint" title={meta.modelsJsonPath}>
              <span className="visually-hidden">配置文件路径：</span>
              {meta.modelsJsonPath}
            </p>
          )}
        </div>
        <div className="header-actions">
          <LongCacheControl
            status={cacheStatus}
            busy={cacheBusy}
            error={cacheError}
            canPatchCurrent={Boolean(
              selectedProvider &&
                currentProvider &&
                !findCatalogProvider(meta?.builtinCatalog, selectedProvider),
            )}
            currentProviderName={
              selectedProvider && !findCatalogProvider(meta?.builtinCatalog, selectedProvider)
                ? selectedProvider
                : null
            }
            onEnable={handleEnableLongCache}
            onDisable={handleDisableLongCache}
          />
          <div className="toolbar">
          {isDirty && (
            <span className="badge badge-dirty" title="更改尚未写入磁盘">
              未保存
            </span>
          )}
          <button type="button" className="btn" onClick={handleReload}>
            重新加载
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleSave()}
            disabled={saving || !isDirty}
            aria-busy={saving}
            title="Ctrl+S / ⌘S"
          >
            {saving ? "保存中…" : "保存配置"}
          </button>
        </div>
        </div>
      </header>

      <div id="main-content" tabIndex={-1}>
        {error && (
          <div
            ref={errorRef}
            className="alert alert-error"
            role="alert"
            tabIndex={-1}
          >
            <div className="alert-body">
              <div>
                {error}
                {validationIssues.length > 0 && (
                  <ul className="issue-list">
                    {validationIssues.map((issue) => (
                      <li key={`${issue.path}-${issue.message}`}>
                        <button
                          type="button"
                          className="issue-link"
                          onClick={() => jumpToIssue(issue.path)}
                        >
                          <code>{issue.path || "(root)"}</code>
                        </button>
                        : {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                className="btn btn-sm alert-dismiss"
                aria-label="关闭错误提示"
                onClick={() => {
                  setError(null);
                  setValidationIssues([]);
                }}
              >
                关闭
              </button>
            </div>
          </div>
        )}
        {success && (
          <div className="alert alert-success" role="status" aria-live="polite">
            {success}
            {successBackup && (
              <>
                {" "}
                <button
                  type="button"
                  className="link-btn"
                  aria-expanded={showBackupPath}
                  onClick={() => setShowBackupPath((v) => !v)}
                >
                  {showBackupPath ? "隐藏备份路径" : "查看备份路径"}
                </button>
                {showBackupPath && (
                  <p className="path-hint mt-xs mb-0">{successBackup}</p>
                )}
              </>
            )}
          </div>
        )}
        {!fileExists && (
          <div className="alert alert-info" role="status">
            尚未找到 models.json。添加 Provider 并保存后会自动创建。
          </div>
        )}

        <div
          className="tabs app-tabs"
          role="tablist"
          aria-label="工作区"
          onKeyDown={onWorkspaceKeyDown}
        >
          <button
            type="button"
            id={providersTabId}
            role="tab"
            aria-selected={workspace === "providers"}
            aria-controls={providersPanelId}
            tabIndex={workspace === "providers" ? 0 : -1}
            className={`tab ${workspace === "providers" ? "active" : ""}`}
            onClick={() => setWorkspace("providers")}
          >
            Providers
          </button>
          <button
            type="button"
            id={jsonTabId}
            role="tab"
            aria-selected={workspace === "json"}
            aria-controls={jsonPanelId}
            tabIndex={workspace === "json" ? 0 : -1}
            className={`tab ${workspace === "json" ? "active" : ""}`}
            onClick={() => setWorkspace("json")}
          >
            整文件 JSON
          </button>
        </div>

        <div
          id={providersPanelId}
          role="tabpanel"
          aria-labelledby={providersTabId}
          hidden={workspace !== "providers"}
        >
          {workspace === "providers" && (
            <div className="layout">
              <aside className="panel panel-sidebar" aria-label="Provider 列表">
                <div className="panel-header">
                  <span>Providers</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => setShowNewModal(true)}
                    disabled={!meta}
                    title={!meta ? "元数据未加载，无法新建" : undefined}
                  >
                    + 新建
                  </button>
                </div>
                <ProviderList
                  config={config}
                  selected={selectedProvider}
                  onSelect={setSelectedProvider}
                  builtinIds={meta?.builtinProviders}
                />
              </aside>

              <main className="panel" aria-label="Provider 详情">
                <div className="panel-header">
                  <span className="truncate" title={selectedProvider ?? undefined}>
                    {selectedProvider ?? "选择 Provider"}
                  </span>
                  {selectedProvider && (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteProvider(selectedProvider)}
                    >
                      删除
                    </button>
                  )}
                </div>

                {selectedProvider && currentProvider ? (
                  <div className="panel-body">
                    <ProviderEditor
                      key={selectedProvider}
                      name={selectedProvider}
                      provider={currentProvider}
                      builtinCatalog={meta?.builtinCatalog ?? []}
                      apiTypes={meta?.apiTypes ?? []}
                      authJsonPath={meta?.authJsonPath}
                      onChange={(p) => handleProviderChange(selectedProvider, p)}
                    />
                  </div>
                ) : (
                  <div className="empty-state">
                    <h2 className="empty-state-title">还没有 Provider</h2>
                    <p>点击左侧「+ 新建」，添加第三方或扩展内建 Provider。</p>
                  </div>
                )}
              </main>
            </div>
          )}
        </div>

        <div
          id={jsonPanelId}
          role="tabpanel"
          aria-labelledby={jsonTabId}
          hidden={workspace !== "json"}
        >
          {workspace === "json" && (
            <div className="panel">
              <div className="panel-header">整份 models.json</div>
              <div className="panel-body">
                <JsonView config={config} onApply={handleJsonApply} />
              </div>
            </div>
          )}
        </div>
      </div>

      {showNewModal && meta && (
        <NewProviderModal
          builtinCatalog={meta.builtinCatalog}
          apiTypes={meta.apiTypes}
          existingNames={Object.keys(config.providers)}
          onClose={() => setShowNewModal(false)}
          onCreate={handleAddProvider}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onCancel={() => setConfirm(null)}
          onConfirm={confirm.onConfirm}
        />
      )}
    </div>
  );
}
