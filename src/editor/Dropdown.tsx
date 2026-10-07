import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

/** A top-layer panel avoids clipping inside the Inspector and settings dialogs. */
export function DropdownPanel({
  anchor,
  onClose,
  children,
  width,
  className = "",
  role,
  id,
  label,
}: {
  anchor: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  className?: string;
  role?: string;
  id?: string;
  label?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const node = panel.current!,
      trigger = anchor.current!;
    const position = () => {
      const rect = trigger.getBoundingClientRect();
      const w = Math.min(
        width ?? Math.max(rect.width, 180),
        window.innerWidth - 20,
      );
      node.style.width = `${w}px`;
      node.style.maxHeight = `${Math.max(100, window.innerHeight - 24)}px`;
      node.style.left = `${Math.max(10, Math.min(rect.left, window.innerWidth - w - 10))}px`;
      const height = node.getBoundingClientRect().height;
      const below = window.innerHeight - rect.bottom - 10;
      const top =
        height <= below ? rect.bottom + 5 : Math.max(10, rect.top - height - 5);
      node.style.top = `${top}px`;
    };
    node.showPopover();
    position();
    const toggle = (event: Event) => {
      if ((event as ToggleEvent).newState === "closed") close.current();
    };
    const dismiss = (event: Event) => {
      if (
        !node.contains(event.target as Node) &&
        !trigger.contains(event.target as Node)
      )
        close.current();
    };
    const resize = new ResizeObserver(position);
    resize.observe(node);
    node.addEventListener("toggle", toggle);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    return () => {
      resize.disconnect();
      node.removeEventListener("toggle", toggle);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      node.hidePopover();
    };
  }, [anchor, width]);
  return createPortal(
    <div
      ref={panel}
      popover="manual"
      className={`dropdown-panel ${className}`}
      role={role}
      id={id}
      aria-label={label}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
          anchor.current?.focus();
        }
      }}
    >
      {children}
    </div>,
    anchor.current?.closest("[popover], dialog") ?? document.body,
  );
}

type Option = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};
export function Dropdown({
  label,
  value,
  options,
  onChange,
  disabled,
  editable = false,
  placeholder,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  editable?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLButtonElement | HTMLInputElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typing = useRef({ text: "", at: 0 });
  const filtered =
    editable && open
      ? options.filter((o) =>
          o.label.toLowerCase().includes(value.toLowerCase()),
        )
      : options;
  const selected = options.find((o) => o.value === value);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);
  function show() {
    setActive(
      Math.max(
        0,
        filtered.findIndex((o) => o.value === value && !o.disabled),
      ),
    );
    setOpen(true);
  }
  function choose(option: Option) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    ref.current?.focus();
  }
  const keyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    if (e.key === "Escape") {
      if (open) e.preventDefault();
      setOpen(false);
      return;
    }
    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      (!editable && ["Home", "End"].includes(e.key))
    ) {
      e.preventDefault();
      if (!open) {
        show();
        return;
      }
      const indices = filtered
        .map((o, i) => (o.disabled ? -1 : i))
        .filter((i) => i >= 0);
      const position = indices.indexOf(active);
      const next =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? indices.length - 1
            : (position + (e.key === "ArrowUp" ? -1 : 1) + indices.length) %
              indices.length;
      setActive(indices[next] ?? -1);
    } else if (e.key === "Enter" || (!editable && e.key === " ")) {
      e.preventDefault();
      if (!open) show();
      else if (filtered[active]) choose(filtered[active]);
      else setOpen(false);
    } else if (!editable && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      typing.current.text =
        (Date.now() - typing.current.at > 700 ? "" : typing.current.text) +
        e.key;
      typing.current.at = Date.now();
      const match = filtered.findIndex(
        (o) =>
          !o.disabled &&
          o.label.toLowerCase().startsWith(typing.current.text.toLowerCase()),
      );
      if (match >= 0) {
        setOpen(true);
        setActive(match);
      }
    }
  };
  const attributes = {
    role: "combobox",
    "aria-label": label,
    "aria-expanded": open,
    "aria-controls": open ? id : undefined,
    "aria-activedescendant":
      open && active >= 0 && active < filtered.length
        ? `${id}-${active}`
        : undefined,
    "aria-haspopup": "listbox" as const,
    disabled,
    onKeyDown: keyDown,
  };
  return (
    <span className="dropdown-control" data-dropdown>
      {editable ? (
        <span className="dropdown-editable">
          <input
            {...attributes}
            ref={ref as React.RefObject<HTMLInputElement>}
            value={value}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            onFocus={show}
            onClick={show}
            onChange={(e) => {
              onChange(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onBlur={() => setOpen(false)}
          />
          <ChevronDown size={15} aria-hidden="true" />
        </span>
      ) : (
        <button
          {...attributes}
          type="button"
          ref={ref as React.RefObject<HTMLButtonElement>}
          className="dropdown-trigger"
          onBlur={() => setOpen(false)}
          onClick={() => (open ? setOpen(false) : show())}
        >
          <span>{selected?.label ?? placeholder ?? value}</span>
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      )}
      {open && (
        <DropdownPanel
          anchor={ref}
          onClose={() => setOpen(false)}
          id={id}
          role="listbox"
          label={label}
        >
          {filtered.map((option, i) => (
            <button
              type="button"
              role="option"
              key={option.value}
              id={`${id}-${i}`}
              tabIndex={-1}
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              className={`dropdown-option ${i === active ? "is-active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onPointerMove={() => setActive(i)}
              onClick={() => choose(option)}
            >
              <span>
                <span>{option.label}</span>
                {option.description && <small>{option.description}</small>}
              </span>
              {option.value === value && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
          {!filtered.length && (
            <p className="dropdown-empty">
              {editable ? "Use your custom model name" : "No options available"}
            </p>
          )}
        </DropdownPanel>
      )}
    </span>
  );
}
