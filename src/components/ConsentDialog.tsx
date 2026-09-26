import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  title: string;
  willDo: string[];
  risks: string[];
  optionalPatchLabel?: string;
  optionalPatchHint?: string;
  optionalPatchChecked?: boolean;
  onOptionalPatchChange?: (checked: boolean) => void;
  error?: string | null;
  busy?: boolean;
  onAllow: () => void;
  onCancel: () => void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** 侵入性操作前阅读风险并点允许；默认焦点在「我已阅读」，不在允许按钮。 */
export function ConsentDialog({
  title,
  willDo,
  risks,
  optionalPatchLabel,
  optionalPatchHint,
  optionalPatchChecked,
  onOptionalPatchChange,
  error,
  busy,
  onAllow,
  onCancel,
}: Props) {
  const titleId = useId();
  const ackId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const ackRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [acked, setAcked] = useState(false);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ackRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy) onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) return;
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
  }, [busy, onCancel]);

  return createPortal(
    <div className="modal-overlay" onClick={() => !busy && onCancel()} role="presentation">
      <div
        ref={dialogRef}
        className="modal modal-consent"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" id={titleId}>
          {title}
        </div>
        <div className="modal-body">
          <p className="consent-lead">点「允许」后，Pi Provider Manager 会做这些事：</p>
          <ul className="consent-list">
            {willDo.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="consent-lead">风险与限制：</p>
          <ul className="consent-list consent-list-risk">
            {risks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {optionalPatchLabel && onOptionalPatchChange && (
            <label className="checkbox-row consent-optional">
              <input
                type="checkbox"
                checked={Boolean(optionalPatchChecked)}
                disabled={busy}
                onChange={(e) => onOptionalPatchChange(e.target.checked)}
              />
              <span>
                {optionalPatchLabel}
                {optionalPatchHint && (
                  <span className="text-sm text-muted d-block">{optionalPatchHint}</span>
                )}
              </span>
            </label>
          )}
          <label className="checkbox-row" htmlFor={ackId}>
            <input
              ref={ackRef}
              id={ackId}
              type="checkbox"
              checked={acked}
              disabled={busy}
              onChange={(e) => setAcked(e.target.checked)}
            />
            <span>我已阅读上述风险</span>
          </label>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!acked || busy}
            onClick={onAllow}
          >
            {busy ? "写入中…" : "允许"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
