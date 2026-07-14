import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface Props {
  text: string;
  label: string;
}

interface TipPosition {
  top: number;
  left: number;
  width: number;
}

/** 标签旁小问号：悬停用 title，点击展开说明（portal，避免被面板 overflow 裁切） */
export function HelpTip({ text, label }: Props) {
  const tipId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TipPosition | null>(null);

  const updatePosition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const pad = 8;
    const maxWidth = Math.min(280, window.innerWidth - pad * 2);
    let left = rect.left;
    if (left + maxWidth > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - pad - maxWidth);
    }

    const gap = 6;
    let top = rect.bottom + gap;
    // 先按下方放置；若下方空间不足且上方更大，则改到上方（高度稍后用实测微调）
    const spaceBelow = window.innerHeight - rect.bottom - gap - pad;
    const spaceAbove = rect.top - gap - pad;
    if (spaceBelow < 80 && spaceAbove > spaceBelow) {
      top = rect.top - gap; // 先锚在按钮上方，layout 后再用实际高度上移
    }

    setPosition({ top, left, width: maxWidth });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useLayoutEffect(() => {
    if (!open || !position || !popRef.current || !btnRef.current) return;
    const pop = popRef.current;
    const btn = btnRef.current;
    const rect = btn.getBoundingClientRect();
    const popHeight = pop.offsetHeight;
    const pad = 8;
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - gap - pad;

    if (spaceBelow < popHeight && rect.top - gap - pad >= popHeight) {
      const nextTop = rect.top - gap - popHeight;
      if (nextTop !== position.top) {
        setPosition((prev) => (prev ? { ...prev, top: nextTop } : prev));
      }
    } else if (position.top + popHeight > window.innerHeight - pad) {
      const nextTop = Math.max(pad, window.innerHeight - pad - popHeight);
      if (nextTop !== position.top) {
        setPosition((prev) => (prev ? { ...prev, top: nextTop } : prev));
      }
    }
  }, [open, position]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (popRef.current?.contains(target)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        btnRef.current?.focus();
      }
    };

    const onReposition = () => updatePosition();

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, close, updatePosition]);

  return (
    <span className="help-tip">
      <button
        ref={btnRef}
        type="button"
        className="help-tip-btn"
        title={text}
        aria-label={`${label}说明`}
        aria-expanded={open}
        aria-controls={open ? tipId : undefined}
        aria-describedby={open ? tipId : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ?
      </button>
      {open &&
        position &&
        createPortal(
          <span
            ref={popRef}
            id={tipId}
            className="help-tip-pop"
            role="note"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
            }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
