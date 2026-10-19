import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { label as labelStyle } from "../ui/styles.js";

/** A labelled dropdown of checkboxes. An empty selection means "no filter". */
export default function MultiSelect({ label, icon: Icon, options, selected, onChange, formatOption = String }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const labelId = useId();
  const summaryId = useId();
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = (option) => {
    const next = new Set(selected);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    onChange(options.filter((o) => next.has(o)));
  };

  let summary = "All";
  if (selected.length === 1) summary = formatOption(selected[0]);
  else if (selected.length > 1) summary = `${selected.length} selected`;

  return (
    <div ref={rootRef} className="relative">
      <span id={labelId} className={labelStyle}>
        <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
        {label}
      </span>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        disabled={options.length === 0}
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={`${labelId} ${summaryId}`}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition-colors hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none disabled:opacity-50 ${selected.length ? "border-slate-900 text-slate-900" : "border-slate-300 text-slate-700"}`}
      >
        <span id={summaryId} className="truncate">
          {summary}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-labelledby={labelId}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full border-b border-slate-100 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear selection
            </button>
          )}
          {options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggle(option)}
                className="h-4 w-4 shrink-0 rounded border-slate-300 accent-slate-900"
              />
              <span className="min-w-0 flex-1 truncate">{formatOption(option)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
