import { useCallback, useEffect, useState } from "react";
import type { ModelsConfig, ProviderConfig } from "@shared/schema";
import { createEmptyConfig } from "@shared/schema";
import { fetchConfig, fetchMeta, saveConfig, validateConfig, type MetaResponse } from "./api";
import { ProviderList } from "./components/ProviderList";
import { ProviderEditor } from "./components/ProviderEditor";
import { JsonView } from "./components/JsonView";
import { NewProviderModal } from "./components/NewProviderModal";

type Tab = "editor" | "json";

export default function App() {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [config, setConfig] = useState<ModelsConfig>(createEmptyConfig());
  const [savedConfig, setSavedConfig] = useState<ModelsConfig>(createEmptyConfig());
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("editor");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fileExists, setFileExists] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [validationIssues, setValidationIssues] = useState<
    Array<{ path: string; message: string }>
  >([]);

  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  const load = useCallback(async (preserveSelection = false) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const [metaRes, configRes] = await Promise.all([fetchMeta(), fetchConfig()]);
      setMeta(metaRes);
      setConfig(configRes.config);
      setSavedConfig(configRes.config);
      setFileExists(configRes.exists);

      if (!preserveSelection) {
        const providers = Object.keys(configRes.config.providers);
        setSelectedProvider((current) => current ?? providers[0] ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const handleReload = () => {
    if (isDirty && !confirm("有未保存的更改，确定重新加载并丢弃吗？")) {
      return;
    }
    void load(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
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
      setSuccess(
        result.backupPath
          ? `已保存，并备份到 ${result.backupPath}`
          : "配置已保存",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = (name: string, provider: ProviderConfig) => {
    setConfig((prev) => ({
      ...prev,
      providers: { ...prev.providers, [name]: provider },
    }));
  };

  const handleDeleteProvider = (name: string) => {
    if (!confirm(`确定删除 Provider「${name}」？此操作需保存后才会写入磁盘。`)) {
      return;
    }
    setConfig((prev) => {
      const next = { ...prev.providers };
      delete next[name];
      return { ...prev, providers: next };
    });
    if (selectedProvider === name) {
      const remaining = Object.keys(config.providers).filter((k) => k !== name);
      setSelectedProvider(remaining[0] ?? null);
    }
  };

  const handleAddProvider = (name: string, provider: ProviderConfig) => {
    setConfig((prev) => ({
      ...prev,
      providers: { ...prev.providers, [name]: provider },
    }));
    setSelectedProvider(name);
    setShowNewModal(false);
  };

  const handleJsonApply = (newConfig: ModelsConfig) => {
    setConfig(newConfig);
    setTab("editor");
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading" role="status" aria-live="polite">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-panel" />
          <p className="text-muted mt-md">正在读取 models.json…</p>
        </div>
      </div>
    );
  }

  const currentProvider = selectedProvider
    ? config.providers[selectedProvider]
    : undefined;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1 className="brand">Pi Provider Manager</h1>
          <p className="subtitle">管理本地 Pi Agent 的 models.json</p>
          {meta && (
            <p className="path-hint" title={meta.modelsJsonPath}>
              {meta.modelsJsonPath}
            </p>
          )}
        </div>
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
            onClick={() => void handleSave()}
            disabled={saving || !isDirty}
            aria-busy={saving}
          >
            {saving ? "保存中…" : "保存配置"}
          </button>
        </div>
      </header>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
          {validationIssues.length > 0 && (
            <ul className="issue-list">
              {validationIssues.map((issue) => (
                <li key={`${issue.path}-${issue.message}`}>
                  <code>{issue.path || "(root)"}</code>: {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {success && (
        <div className="alert alert-success" role="status">
          {success}
        </div>
      )}
      {!fileExists && (
        <div className="alert alert-info" role="status">
          尚未找到 models.json。添加 Provider 并保存后会自动创建。
        </div>
      )}

      <div className="layout">
        <aside className="panel panel-sidebar" aria-label="Provider 列表">
          <div className="panel-header">
            <span>Providers</span>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setShowNewModal(true)}
            >
              + 新建
            </button>
          </div>
          <ProviderList
            config={config}
            selected={selectedProvider}
            onSelect={setSelectedProvider}
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
            <>
              <div className="tabs" role="tablist" aria-label="编辑方式">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "editor"}
                  className={`tab ${tab === "editor" ? "active" : ""}`}
                  onClick={() => setTab("editor")}
                >
                  表单编辑
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "json"}
                  className={`tab ${tab === "json" ? "active" : ""}`}
                  onClick={() => setTab("json")}
                >
                  原始 JSON
                </button>
              </div>
              <div className="panel-body" role="tabpanel">
                {tab === "editor" ? (
                  <ProviderEditor
                    name={selectedProvider}
                    provider={currentProvider}
                    builtinProviders={meta?.builtinProviders ?? []}
                    apiTypes={meta?.apiTypes ?? []}
                    onChange={(p) => handleProviderChange(selectedProvider, p)}
                  />
                ) : (
                  <JsonView config={config} onApply={handleJsonApply} />
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h3>还没有 Provider</h3>
              <p>点击左侧「+ 新建」，添加第三方或扩展内建 Provider。</p>
            </div>
          )}
        </main>
      </div>

      {showNewModal && meta && (
        <NewProviderModal
          builtinProviders={meta.builtinProviders}
          apiTypes={meta.apiTypes}
          existingNames={Object.keys(config.providers)}
          onClose={() => setShowNewModal(false)}
          onCreate={handleAddProvider}
        />
      )}
    </div>
  );
}
