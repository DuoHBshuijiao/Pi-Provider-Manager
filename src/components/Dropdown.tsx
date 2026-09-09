import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
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
  searchable?: boolean;
  allowCustom?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "data-config-path"?: string;
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
  searchable = false,
  allowCustom = false,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "data-config-path": dataConfigPath,
}: Props) {
  const listboxId = useId();
  const searchId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? (value ? value : placeholder);
  const isPlaceholder = !selected && !value;

  const filtered = useMemo(() => {
    const q = query.trim();
    let list = options;
    if (searchable && q) {
      const lower = q.toLowerCase();
      list = options.filter(
        (o) =>
          o.label.toLowerCase().includes(lower) || o.value.toLowerCase().includes(lower),
      );
    }
    if (allowCustom && q && !options.some((o) => o.value === q)) {
      list = [...list, { value: q, label: `使用「${q}」` }];
    }
    return list;
  }, [options, query, searchable, allowCustom]);

  const activeOptionId =
    open && highlight >= 0 ? `${listboxId}-opt-${highlight}` : undefined;

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const viewportPad = 8;
    const preferredMax = searchable ? 280 : 240;
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPad;
    const spaceAbove = rect.top - gap - viewportPad;
    const openUp = spaceBelow < 140 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(preferredMax, openUp ? spaceAbove : spaceBelow);

    setPosition({
      top: openUp ? rect.top - gap : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(140, maxHeight),
      openUp,
    });
  }, [searchable]);

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
    setQuery("");
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    if (options.length === 0 && !allowCustom) return;
    const index = Math.max(
      0,
      options.findIndex((o) => o.value === value),
    );
    setQuery("");
    setHighlight(index < 0 ? 0 : index);
    setOpen(true);
  }, [disabled, options, value, allowCustom]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, updatePosition, searchable]);

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

  useEffect(() => {
    if (!open) return;
    setHighlight((i) => {
      if (filtered.length === 0) return -1;
      if (i < 0) return 0;
      return Math.min(i, filtered.length - 1);
    });
  }, [filtered, open]);

  const selectValue = (next: string) => {
    onChange(next);
    close();
    triggerRef.current?.focus();
  };

  const moveHighlight = (delta: number) => {
    if (filtered.length === 0) return;
    setHighlight((i) => {
      const base = i < 0 ? 0 : i;
      return (base + delta + filtered.length) % filtered.length;
    });
  };

  const onListKeyDown = (event: ReactKeyboardEvent) => {
    if (filtered.length === 0 && event.key !== "Escape") return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setHighlight(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setHighlight(filtered.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[highlight];
      if (option) selectValue(option.value);
    }
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
    onListKeyDown(event);
  };

  const menu =
    open && position
      ? createPortal(
          <div
            ref={menuRef}
            className={`dropdown-menu ${position.openUp ? "dropdown-menu-up" : ""}`}
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
            {searchable && (
              <div className="dropdown-search">
                <label className="visually-hidden" htmlFor={searchId}>
                  过滤选项
                </label>
                <input
                  ref={searchRef}
                  id={searchId}
                  type="search"
                  className="dropdown-search-input"
                  value={query}
                  placeholder={allowCustom ? "搜索或输入自定义 ID…" : "输入以过滤…"}
                  autoComplete="off"
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onListKeyDown}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
            )}
            <ul
              id={listboxId}
              className="dropdown-menu-list"
              role="listbox"
              aria-label={ariaLabel ?? placeholder}
            >
              {filtered.length === 0 ? (
                <li className="dropdown-option is-empty" role="presentation">
                  {allowCustom ? "输入自定义 ID 后回车" : "无匹配项"}
                </li>
              ) : (
                filtered.map((option, index) => {
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
                      {isSelected && (
                        <span className="dropdown-check" aria-hidden="true">
                          ✓
                        </span>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
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
        data-config-path={dataConfigPath}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
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
