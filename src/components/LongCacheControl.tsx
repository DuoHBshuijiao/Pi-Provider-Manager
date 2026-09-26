import { useId, useState } from "react";
import type { LongCacheStatus } from "../api";
import { HelpTip } from "./HelpTip";
import { ConsentDialog } from "./ConsentDialog";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  status: LongCacheStatus | null;
  busy: boolean;
  error: string | null;
  canPatchCurrent: boolean;
  currentProviderName: string | null;
  onEnable: (patchModels: boolean) => Promise<void>;
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
  const [consentOpen, setConsentOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [patchModels, setPatchModels] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const checked = Boolean(status?.checked);
  const supported = status?.supported === true;

  const handleToggle = (next: boolean) => {
    if (busy) return;
    if (next) {
      if (!supported) return;
      setPatchModels(canPatchCurrent);
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

  return (
    <div className="long-cache-control">
      <label className="checkbox-row long-cache-toggle" htmlFor={toggleId}>
        <input
          id={toggleId}
          type="checkbox"
          checked={checked}
          disabled={busy || (!supported && !checked)}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        <span>启用长缓存</span>
        <HelpTip
          label="启用长缓存"
          text="打开后会写入用户环境变量 PI_CACHE_RETENTION=long。只改 models.json 不会让 TUI/RPC 发出 1 小时缓存。已运行的 Pi 不会立刻生效。"
        />
      </label>
      {status?.externalLong && (
        <p className="long-cache-hint">
          本机已有 <code>PI_CACHE_RETENTION=long</code>，非本工具写入。打开本开关会由 PPM
          接管；关闭时将退回到打开前的值。
        </p>
      )}
      {!supported && (
        <p className="long-cache-hint">
          当前系统无法由本工具改用户环境变量。请在启动 Pi 的终端执行{" "}
          <code>{status?.sessionCommands.bash ?? "PI_CACHE_RETENTION=long pi"}</code>
        </p>
      )}
      {checked && status && (
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
          willDo={[
            "把用户级环境变量 PI_CACHE_RETENTION 设为 long（Windows 用户范围）",
            "记下开启前的值（含未设置），关闭开关时按快照还原",
            ...(canPatchCurrent && patchModels && currentProviderName
              ? [
                  `为第三方「${currentProviderName}」写入允许发送长缓存字段；Anthropic 协议再写工具 cache_control；模型缺 promptCache.long 时补 3600（进入未保存草稿，需点保存）`,
                ]
              : []),
          ]}
          risks={[
            "不会让当前已运行的 Pi 立刻改请求。必须让新进程继承该变量：完全退出 Cursor/终端/RPC 宿主再开，或在当前会话手动设置环境变量",
            "在允许之前就打开的 IDE 终端里，只重启 pi 通常仍是 5 分钟短缓存",
            "长缓存可能提高 cache write 费用；未命中时仍按原价",
            "若代理拒绝 ttl: \"1h\"，请求会失败，需把 compat「允许发送长缓存字段」设为不支持",
            "这是用户级环境变量，会影响之后能继承该变量的所有 Pi 进程",
          ]}
          optionalPatchLabel={
            canPatchCurrent
              ? `同时写入当前第三方「${currentProviderName}」的能力字段与 promptCache`
              : undefined
          }
          optionalPatchHint="只改内存中的 models.json 草稿，不等于打开长缓存。默认能力已是允许发送。"
          optionalPatchChecked={canPatchCurrent ? patchModels : undefined}
          onOptionalPatchChange={canPatchCurrent ? setPatchModels : undefined}
          error={error}
          busy={busy}
          onCancel={() => setConsentOpen(false)}
          onAllow={() => {
            void (async () => {
              try {
                await onEnable(canPatchCurrent && patchModels);
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
          message="将按开启前的快照恢复用户环境变量；若当时未设置则会删除该变量。本次写入的 models.json 片段也会退回。已打开的 Pi 需重启后才回到短缓存。"
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
