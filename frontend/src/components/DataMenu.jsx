import {
  ChevronDown,
  Database,
  Download,
  FileSpreadsheet,
  FileUp,
  FlaskConical,
  Trash2,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { buttonSecondary } from "./ui/styles.js";

const item =
  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export default function DataMenu({ hasExams, onLoadSample, onImport, onExportJson, onExportCsv, onClearAll }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();

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

  const choose = (action) => () => {
    setOpen(false);
    action();
  };

  const actions = [
    { label: "Load sample data", icon: FlaskConical, onClick: onLoadSample },
    { label: "Import backup (JSON)", icon: FileUp, onClick: onImport },
    { label: "Export backup (JSON)", icon: Download, onClick: onExportJson, disabled: !hasExams },
    { label: "Export all questions (CSV)", icon: FileSpreadsheet, onClick: onExportCsv, disabled: !hasExams },
  ];

  return (
    <div ref={rootRef} className="sm:relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Data options"
        className={`${buttonSecondary} px-3 sm:px-4`}
      >
        <Database className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Data</span>
        <ChevronDown
          className={`hidden h-4 w-4 transition-transform sm:block ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute top-full right-4 left-4 z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1.5 shadow-xl sm:right-0 sm:left-auto sm:w-72"
        >
          <ul>
            {actions.map(({ label, icon: Icon, onClick, disabled }) => (
              <li key={label}>
                <button
                  type="button"
                  className={`${item} text-slate-700 hover:bg-slate-50`}
                  onClick={choose(onClick)}
                  disabled={disabled}
                >
                  <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  {label}
                </button>
              </li>
            ))}
            <li className="mt-1.5 border-t border-slate-100 pt-1.5">
              <button
                type="button"
                className={`${item} text-red-700 hover:bg-red-50`}
                onClick={choose(onClearAll)}
                disabled={!hasExams}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete all data
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
