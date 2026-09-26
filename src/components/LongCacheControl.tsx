import { useId, useState } from "react";
import type { EnvProbeResult, LongCacheStatus } from "../api";
import { clearEnvProbe, writeEnvProbe } from "../api";
import { HelpTip } from "./HelpTip";
import { ConsentDialog } from "./ConsentDialog";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  status: LongCacheStatus | null;
  busy: boolean;
  error: string | null;
  canPatchCurrent: boolean;
  currentProviderName: string | null;
  onEnable: (patchModels: boolean, method: "hook" | "env") => Promise<void>;
  onDisable: () => Promise<void>;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function LongCacheControl({
  status,
  busy,
  error,
  canPatchCurrent,
  currentProviderName,
  onEnable,
  onDisable,
}: Props) {
  const toggleId = useId();
  const methodGroupId = useId();
  const [consentOpen, setConsentOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [patchModels, setPatchModels] = useState(true);
  const [method, setMethod] = useState<"hook" | "env">("hook");
  const [probe, setProbe] = useState<EnvProbeResult | null>(null);
  const [probeBusy, setProbeBusy] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const checked = Boolean(status?.checked);
  const envSupported = status?.envSupported === true;
  const selectedMethod = method === "env" && !envSupported ? "hook" : method;

  const handleToggle = (next: boolean) => {
    if (busy) return;
    if (next) {
      setPatchModels(canPatchCurrent);
      setMethod("hook");
      setProbe(null);
      setProbeError(null);
      setConsentOpen(true);
      return;
    }
    setDisableOpen(true);
  };

  const copy = async (label: string, text: string) => {
    const ok = await copyText(text);
    setCopied(ok ? label : null);
    window.setTimeout(() => setCopied((current) => (current === label ? null : current)), 2000);
  };

  const closeConsent = () => {
    if (busy || probeBusy) return;
    setConsentOpen(false);
    if (probe) {
      void clearEnvProbe().catch(() => undefined);
      setProbe(null);
    }
    setProbeError(null);
  };

  const selectMethod = (next: "hook" | "env") => {
    if (busy || probeBusy) return;
    if (next === "env" && !envSupported) return;
    if (next === "hook" && probe) {
      void clearEnvProbe().catch(() => undefined);
      setProbe(null);
      setProbeError(null);
    }
    setMethod(next);
  };

  const handleProbe = async () => {
    if (probeBusy || !envSupported) return;
    setProbeBusy(true);
    setProbeError(null);
    try {
      const result = await writeEnvProbe();
      setProbe({
        token: result.token,
        checkCommand: result.checkCommand,
        clearCommand: result.clearCommand,
      });
    } catch (err) {
      setProbeError(err instanceof Error ? err.message : "写入探测变量失败");
    } finally {
      setProbeBusy(false);
    }
  };

  const patchNote =
    canPatchCurrent && patchModels && currentProviderName
      ? `为第三方「${currentProviderName}」写入允许发送长缓存字段；Anthropic 协议再写工具 cache_control；模型缺 promptCache.long 时补 3600（进入未保存草稿，需点保存）`
      : null;

  const willDo =
    selectedMethod === "hook"
      ? [
          "安装或更新 ~/.pi/agent/extensions/provider-manager-long-cache.js",
          "记下 Hook 接管状态；关闭后扩展在下一轮恢复进程启动时的缓存档",
          ...(patchNote ? [patchNote] : []),
        ]
      : [
          "把用户级环境变量 PI_CACHE_RETENTION 设为 long（Windows 用户范围）",
          "记下开启前的值（含未设置），关闭开关时按快照还原",
          ...(patchNote ? [patchNote] : []),
        ];

  const risks =
    selectedMethod === "hook"
      ? [
          "扩展文件出现之前已经启动的 Pi 要重启一次才会加载",
          "加载之后，开关在下一轮请求生效；--no-extensions 或 PI_CODING_AGENT_DIR 不是 ~/.pi/agent 时无效",
          "google-generative-ai 不读 PI_CACHE_RETENTION",
          "长缓存可能提高 cache write 费用；未命中时仍按原价",
          "若代理拒绝 ttl: \"1h\"，请求会失败，需把 compat「允许发送长缓存字段」设为不支持",
        ]
      : [
          "写入不通知资源管理器。只关终端再开 RPC，父进程仍可能是旧环境，Pi 继续发短缓存",
          "已经在跑的 Pi 不会立刻改请求",
          "这是用户级环境变量，会影响之后能继承该变量的所有 Pi 进程",
          "google-generative-ai 不读 PI_CACHE_RETENTION",
          "长缓存可能提高 cache write 费用；未命中时仍按原价",
          "若代理拒绝 ttl: \"1h\"，请求会失败，需把 compat「允许发送长缓存字段」设为不支持",
        ];

  const disableMessage =
    status?.method === "hook"
      ? "将删除本工具的 Hook 接管记录。已加载扩展的 Pi 在下一轮恢复进程启动时的缓存档。本次写入的 models.json 片段也会退回。不改用户环境变量。"
      : "将按开启前的快照恢复用户环境变量；若当时未设置则会删除该变量。本次写入的 models.json 片段也会退回。已打开的 Pi 需重启后才回到短缓存。";

  const methodCards = (
    <div className="consent-method-block">
      <p className="consent-lead" id={methodGroupId}>
        选择启用方式
      </p>
      <div className="consent-method-grid" role="radiogroup" aria-labelledby={methodGroupId}>
        <div
          className={`consent-method-card${selectedMethod === "hook" ? " is-selected" : ""}`}
          onClick={() => selectMethod("hook")}
        >
          <label className="consent-method-head">
            <input
              type="radio"
              name="long-cache-method"
              value="hook"
              checked={selectedMethod === "hook"}
              disabled={busy || probeBusy}
              onChange={() => selectMethod("hook")}
            />
            <span className="consent-method-title">Pi 扩展（推荐）</span>
          </label>
          <p>
            原理：在 ~/.pi/agent/extensions 安装扩展。每一轮 agent_start 读取 sidecar，只在
            Hook 接管时把本进程 PI_CACHE_RETENTION 设为 long。不改注册表，也不依赖父终端继承。
          </p>
          <p>
            限制：扩展出现之前已经启动的 Pi 要重启一次。之后开关在下一轮生效。--no-extensions
            或 agent 目录不一致时不会加载。google-generative-ai 不读该变量。
          </p>
        </div>
        <div
          className={`consent-method-card${selectedMethod === "env" ? " is-selected" : ""}${
            envSupported ? "" : " is-disabled"
          }`}
          onClick={() => selectMethod("env")}
        >
          <label className="consent-method-head">
            <input
              type="radio"
              name="long-cache-method"
              value="env"
              checked={selectedMethod === "env"}
              disabled={busy || probeBusy || !envSupported}
              onChange={() => selectMethod("env")}
            />
            <span className="consent-method-title">用户环境变量</span>
          </label>
          <p>
            原理：把 Windows 用户级 PI_CACHE_RETENTION 写成 long。新进程若继承到该变量，Pi
            在未显式传入 cacheRetention 时发长缓存。
          </p>
          <p>
            限制：写入不通知资源管理器。不重启资源管理器时，关掉终端再开
            RPC，父进程仍可能是旧环境。已经在跑的 Pi 不会变。会影响之后能继承该变量的所有
            Pi。google-generative-ai 不读该变量。
          </p>
          {envSupported ? (
            <div className="consent-probe">
              <p>在新开的终端窗口运行检查命令，确认本机是否只需重开终端就能继承。</p>
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy || probeBusy}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleProbe();
                }}
              >
                {probeBusy ? "写入中…" : probe ? "重新写入探测" : "写入探测"}
              </button>
              {probeError && (
                <p className="field-error" role="alert">
                  {probeError}
                </p>
              )}
              {probe && (
                <>
                  <p>
                    完全退出平时用来启动 Pi 的终端宿主，新开一个窗口再运行。不要在已经开着的
                    Windows Terminal 里新建标签。
                  </p>
                  <div className="consent-probe-row">
                    <code>{probe.checkCommand}</code>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        void copy("check", probe.checkCommand);
                      }}
                    >
                      {copied === "check" ? "已复制" : "复制检查"}
                    </button>
                  </div>
                  <div className="consent-probe-row">
                    <code>{probe.clearCommand}</code>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        void copy("clear", probe.clearCommand);
                      }}
                    >
                      {copied === "clear" ? "已复制" : "复制清除"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p>当前系统无法写入用户环境变量，请用 Pi 扩展。</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="long-cache-control">
      <label className="checkbox-row long-cache-toggle" htmlFor={toggleId}>
        <input
          id={toggleId}
          type="checkbox"
          checked={checked}
          disabled={busy}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        <span>启用长缓存</span>
        <HelpTip
          label="启用长缓存"
          text="打开后选择 Pi 扩展或用户环境变量。只改 models.json 不会让 TUI/RPC 发出长缓存。扩展在下一轮请求生效；环境变量要等新进程继承到 PI_CACHE_RETENTION=long。"
        />
      </label>
      {status?.externalLong && (
        <p className="long-cache-hint">
          本机已有 <code>PI_CACHE_RETENTION=long</code>，非本工具用环境变量方式写入。选环境变量会接管该值；选
          Hook 不会改它。
        </p>
      )}
      {!envSupported && !checked && (
        <p className="long-cache-hint">
          当前系统无法写用户环境变量，请用同意框里的 Pi 扩展。
        </p>
      )}
      {status?.owned && status.method === "hook" && !status.extensionInstalled && (
        <p className="long-cache-hint">
          接管记录还在，但扩展文件丢失。再次勾选会重装扩展。
        </p>
      )}
      {checked && status?.method === "hook" && status.hookSnapshot && (
        <p className="long-cache-hint">
          已用 Pi 扩展接管。已加载该扩展的 Pi 在下一轮请求发长缓存；启动时还没有该文件的 Pi
          需重启一次。/reload 不会覆盖已记下的启动快照。
        </p>
      )}
      {checked && status?.method === "hook" && !status.hookSnapshot && (
        <p className="long-cache-hint">
          已用 Pi 扩展接管，但还没有本进程的启动快照。请完整重启一次 Pi，之后 /reload
          不会冲掉这份快照。
        </p>
      )}
      {!checked && status?.hookSnapshot?.live && (
        <p className="long-cache-hint">
          已关闭接管。已加载扩展的 Pi 在下一轮会按启动快照还原。
        </p>
      )}
      {checked && status?.method === "env" && status.sessionCommands && (
        <div className="long-cache-commands" role="status">
          <p className="long-cache-hint mb-xs">
            本工具无法改正在运行的 Pi。请完全退出 Cursor/终端后再开，或在当前会话执行：
          </p>
          <div className="long-cache-command-row">
            <code>{status.sessionCommands.powershell}</code>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void copy("tui", status.sessionCommands.powershell)}
            >
              {copied === "tui" ? "已复制" : "复制 TUI"}
            </button>
          </div>
          <div className="long-cache-command-row">
            <code>{status.sessionCommands.powershellRpc}</code>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void copy("rpc", status.sessionCommands.powershellRpc)}
            >
              {copied === "rpc" ? "已复制" : "复制 RPC"}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {consentOpen && (
        <ConsentDialog
          title="允许写入长缓存？"
          willDo={willDo}
          middle={methodCards}
          risks={risks}
          optionalPatchLabel={
            canPatchCurrent
              ? `同时写入当前第三方「${currentProviderName}」的能力字段与 promptCache`
              : undefined
          }
          optionalPatchHint="只改内存中的 models.json 草稿，不等于打开长缓存。默认能力已是允许发送。"
          optionalPatchChecked={canPatchCurrent ? patchModels : undefined}
          onOptionalPatchChange={canPatchCurrent ? setPatchModels : undefined}
          allowDisabled={selectedMethod === "env" && !envSupported}
          error={error}
          busy={busy || probeBusy}
          onCancel={closeConsent}
          onAllow={() => {
            void (async () => {
              try {
                if (probe) {
                  await clearEnvProbe().catch(() => undefined);
                  setProbe(null);
                }
                await onEnable(canPatchCurrent && patchModels, selectedMethod);
                setConsentOpen(false);
              } catch {
                // 错误由父级展示，对话框保持打开
              }
            })();
          }}
        />
      )}

      {disableOpen && (
        <ConfirmDialog
          title="关闭长缓存并还原？"
          message={disableMessage}
          confirmLabel="还原并关闭"
          danger
          busy={busy}
          onCancel={() => !busy && setDisableOpen(false)}
          onConfirm={() => {
            void (async () => {
              try {
                await onDisable();
                setDisableOpen(false);
              } catch {
                setDisableOpen(false);
              }
            })();
          }}
        />
      )}
    </div>
  );
}
