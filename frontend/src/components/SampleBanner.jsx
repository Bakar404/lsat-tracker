import { FlaskConical } from "lucide-react";
import { plural } from "../lib/format.js";

export default function SampleBanner({ count, onRemove }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="flex items-start gap-2.5">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold">Sample data.</strong> {plural(count, "exam")} marked
          &ldquo;Sample&rdquo; {count === 1 ? "is" : "are"} synthetic, generated so you can explore the
          dashboard. Remove {count === 1 ? "it" : "them"} before relying on your statistics.
        </span>
      </p>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-xl border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
      >
        Remove sample data
      </button>
    </div>
  );
}
