import { Layers3, Upload } from "lucide-react";
import DataMenu from "./DataMenu.jsx";
import { buttonPrimary } from "./ui/styles.js";

export default function Header({ onUpload, ...menuProps }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/80 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900">
            <Layers3 className="h-6 w-6 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 sm:text-xl">LSAT Tracker</h1>
            <p className="hidden text-sm text-slate-500 sm:block">
              Private analytics for LawHub score reports
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DataMenu {...menuProps} />
          <button type="button" className={buttonPrimary} onClick={onUpload}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span className="sm:hidden">Upload</span>
            <span className="hidden sm:inline">Upload reports</span>
          </button>
        </div>
      </div>
    </header>
  );
}
