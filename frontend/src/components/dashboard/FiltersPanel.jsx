import {
  BarChart3,
  Calendar,
  ChevronDown,
  Download,
  FileText,
  Filter,
  Flag,
  FlaskConical,
  Layers3,
  Target,
} from "lucide-react";
import { useId, useState } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import {
  EMPTY_FILTERS,
  FLAG_OPTIONS,
  SECTION_STATUS_OPTIONS,
  countActiveFilters,
} from "../../lib/analytics.js";
import { buttonSecondary, card, input, label as labelStyle } from "../ui/styles.js";
import MultiSelect from "./MultiSelect.jsx";

function DateField({ label, value, onChange, min, max }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelStyle}>
        <Calendar className="h-4 w-4 text-slate-500" aria-hidden="true" />
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className={input}
      />
    </div>
  );
}

export default function FiltersPanel({ filters, options, onChange, shown, total, onExport }) {
  const largeScreen = useMediaQuery("(min-width: 1024px)");
  // Follows the screen size until the user opens or closes the panel themselves.
  const [expanded, setExpanded] = useState(null);
  const open = expanded ?? largeScreen;
  const active = countActiveFilters(filters);
  const bodyId = useId();
  const set = (key) => (value) => onChange({ ...filters, [key]: value });

  return (
    <section className={`${card} p-4 sm:p-6`} aria-label="Filters">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setExpanded(!open)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="-m-1 flex min-w-0 items-center gap-3 rounded-xl p-1 text-left focus-visible:outline-2 focus-visible:outline-slate-900"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100">
            <Filter className="h-5 w-5 text-green-600" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              Filters
              {active > 0 && (
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
                  {active} active
                </span>
              )}
              <ChevronDown
                className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </span>
            <span className="block text-sm text-slate-500" aria-live="polite">
              Showing {shown.toLocaleString()} of {total.toLocaleString()} questions
            </span>
          </span>
        </button>
        <div className="ml-auto flex gap-2">
          {active > 0 && (
            <button type="button" className={buttonSecondary} onClick={() => onChange(EMPTY_FILTERS)}>
              Clear filters
            </button>
          )}
          <button
            type="button"
            className={buttonSecondary}
            onClick={onExport}
            disabled={shown === 0}
            title="Download the questions that match the current filters"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </div>

      {open && (
        <div id={bodyId} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MultiSelect
            label="Exams"
            icon={FileText}
            options={options.exams}
            selected={filters.exams}
            onChange={set("exams")}
            formatOption={(exam) => `Exam ${exam}`}
          />
          <MultiSelect
            label="Sections"
            icon={Layers3}
            options={options.sections}
            selected={filters.sections}
            onChange={set("sections")}
            formatOption={(section) => `Section ${section}`}
          />
          <MultiSelect
            label="Section type"
            icon={BarChart3}
            options={options.sectionTypes}
            selected={filters.sectionTypes}
            onChange={set("sectionTypes")}
          />
          <MultiSelect
            label="Question type"
            icon={Target}
            options={options.subtypes}
            selected={filters.subtypes}
            onChange={set("subtypes")}
          />
          <MultiSelect
            label="Flagged"
            icon={Flag}
            options={FLAG_OPTIONS}
            selected={filters.flags}
            onChange={set("flags")}
          />
          <MultiSelect
            label="Section status"
            icon={FlaskConical}
            options={SECTION_STATUS_OPTIONS}
            selected={filters.status}
            onChange={set("status")}
          />
          <DateField
            label="From"
            value={filters.dateFrom}
            max={filters.dateTo || undefined}
            onChange={set("dateFrom")}
          />
          <DateField
            label="To"
            value={filters.dateTo}
            min={filters.dateFrom || undefined}
            onChange={set("dateTo")}
          />
        </div>
      )}
    </section>
  );
}
