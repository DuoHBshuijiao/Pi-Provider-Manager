import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export interface DropdownOption {
  value: string;
  label: string;
}

interface Props {
  id?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
}

export function Dropdown({
  id,
  value,
  options,
  onChange,
  placeholder = "请选择",
  disabled = false,
  "aria-label": ariaLabel,
}: Props) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder;
  const isPlaceholder = !selected;

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const viewportPad = 8;
    const preferredMax = 240;
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPad;
    const spaceAbove = rect.top - gap - viewportPad;
    const openUp = spaceBelow < 140 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(preferredMax, openUp ? spaceAbove : spaceBelow);

    setPosition({
      top: openUp ? rect.top - gap : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(120, maxHeight),
      openUp,
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    const index = Math.max(
      0,
      options.findIndex((o) => o.value === value),
    );
    setHighlight(index);
    setOpen(true);
  }, [disabled, options, value]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
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

  useEffect(() => {
    if (!open || highlight < 0) return;
    const item = menuRef.current?.querySelector<HTMLElement>(
      `[data-index="${highlight}"]`,
    );
    item?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  const selectValue = (next: string) => {
    onChange(next);
    close();
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
    }

    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((i) => (i + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setHighlight(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setHighlight(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[highlight];
      if (option) selectValue(option.value);
    }
  };

  const menu =
    open && position
      ? createPortal(
          <ul
            ref={menuRef}
            id={listboxId}
            className={`dropdown-menu ${position.openUp ? "dropdown-menu-up" : ""}`}
            role="listbox"
            style={{
              top: position.openUp ? "auto" : position.top,
              bottom: position.openUp
                ? window.innerHeight - position.top
                : "auto",
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === highlight;
              return (
                <li
                  key={`${option.value}-${index}`}
                  id={`${listboxId}-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  className={[
                    "dropdown-option",
                    isSelected ? "is-selected" : "",
                    isActive ? "is-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectValue(option.value);
                  }}
                >
                  <span className="dropdown-option-label">{option.label}</span>
                  {isSelected && <span className="dropdown-check" aria-hidden="true">✓</span>}
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className={`dropdown ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`dropdown-trigger ${isPlaceholder ? "is-placeholder" : ""}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="dropdown-value truncate">{displayLabel}</span>
        <span className="dropdown-chevron" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 4.5L6 8L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {menu}
    </div>
  );
}
