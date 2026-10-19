import { BarChart3, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { compareNatural, fmtDate, fmtMMSS } from "../../lib/format.js";
import { buttonSecondary, card } from "../ui/styles.js";

const PAGE_SIZE = 25;

const COLUMNS = [
  { key: "exam_number", label: "Exam" },
  { key: "exam_date", label: "Date", firstDirection: "desc" },
  { key: "section", label: "Section" },
  { key: "question", label: "Q" },
  { key: "subtype", label: "Question type" },
  { key: "difficulty", label: "Difficulty" },
  { key: "total_time_seconds", label: "Time" },
  { key: "question_score", label: "Result" },
  { key: "flagged", label: "Flagged", firstDirection: "desc" },
];

const isMissing = (value) => value === null || value === undefined || value === "";

/** Compares one column; missing values always sort last. */
function compareBy(key, direction) {
  const sign = direction === "asc" ? 1 : -1;
  return (a, b) => {
    const x = a[key];
    const y = b[key];
    if (isMissing(x) || isMissing(y)) return isMissing(x) === isMissing(y) ? 0 : isMissing(x) ? 1 : -1;
    const result =
      typeof x === "string" || typeof y === "string" ? compareNatural(x, y) : Number(x) - Number(y);
    return sign * result;
  };
}

// Newest exam first, then in test order.
const TIE_BREAKERS = [
  compareBy("exam_date", "desc"),
  compareBy("exam_number", "asc"),
  compareBy("section", "asc"),
  compareBy("question", "asc"),
];

function sortRows(rows, { key, direction }) {
  const comparators = [compareBy(key, direction), ...TIE_BREAKERS];
  return [...rows].sort((a, b) => {
    for (const compare of comparators) {
      const result = compare(a, b);
      if (result) return result;
    }
    return 0;
  });
}

function SortIcon({ direction }) {
  const Icon = direction === "asc" ? ChevronUp : direction === "desc" ? ChevronDown : ChevronsUpDown;
  return (
    <Icon
      className={`h-3.5 w-3.5 ${direction ? "text-slate-900" : "text-slate-400"}`}
      aria-hidden="true"
    />
  );
}

const pill = "inline-flex rounded-full px-2 py-0.5 text-xs font-medium";

export default function DataTable({ rows }) {
  const [sort, setSort] = useState({ key: "exam_date", direction: "desc" });
  // The page resets whenever the filtered rows or the sort order change.
  const [paging, setPaging] = useState({ rows, sort, page: 0 });
  const page = paging.rows === rows && paging.sort === sort ? paging.page : 0;

  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visible = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const goTo = (next) => setPaging({ rows, sort, page: next });
  const sortBy = (column) => {
    const direction =
      sort.key === column.key
        ? sort.direction === "asc"
          ? "desc"
          : "asc"
        : (column.firstDirection ?? "asc");
    setSort({ key: column.key, direction });
  };

  return (
    <section className={`${card} overflow-hidden`} aria-labelledby="questions-heading">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
        <h3 id="questions-heading" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <BarChart3 className="h-5 w-5 text-slate-600" aria-hidden="true" />
          Questions
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Every question that matches the filters. Select a column heading to sort.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm whitespace-nowrap">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              {COLUMNS.map((column) => {
                const direction = sort.key === column.key ? sort.direction : null;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={direction ? (direction === "asc" ? "ascending" : "descending") : undefined}
                    className="px-4 py-2 text-left text-xs font-semibold tracking-wider text-slate-700 uppercase"
                  >
                    <button
                      type="button"
                      onClick={() => sortBy(column)}
                      className="-mx-2 flex items-center gap-1 rounded-md px-2 py-1 uppercase hover:bg-slate-100"
                    >
                      {column.label}
                      <SortIcon direction={direction} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((row, index) => (
              <tr
                // A report can repeat a question number, so the position keeps keys unique.
                key={`${row.exam_number}-${row.section}-${row.question}-${index}`}
                className="transition-colors hover:bg-blue-50/60"
              >
                <td className="px-4 py-2.5 font-medium text-slate-900">{row.exam_number}</td>
                <td className="px-4 py-2.5 text-slate-600">{fmtDate(row.exam_date)}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {row.section}
                  {row.experimental_section && (
                    <span
                      className={`${pill} ml-2 bg-violet-100 text-violet-800`}
                      title="Experimental section, not scored"
                    >
                      Exp.
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-600 tabular-nums">{row.question}</td>
                <td className="px-4 py-2.5 text-slate-600">{row.subtype}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {row.difficulty == null ? "-" : `Level ${row.difficulty}`}
                </td>
                <td className="px-4 py-2.5 text-slate-600 tabular-nums">{fmtMMSS(row.total_time_seconds)}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`${pill} ${row.question_score ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                  >
                    {row.question_score ? "Correct" : "Incorrect"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {row.flagged ? (
                    <span className={`${pill} bg-yellow-100 text-yellow-800`}>Flagged</span>
                  ) : (
                    <span className="text-slate-400">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-slate-600" aria-live="polite">
          {sorted.length
            ? `Showing ${(page * PAGE_SIZE + 1).toLocaleString()} to ${Math.min(sorted.length, (page + 1) * PAGE_SIZE).toLocaleString()} of ${sorted.length.toLocaleString()}`
            : "No questions"}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`${buttonSecondary} px-3 py-1.5`}
            onClick={() => goTo(page - 1)}
            disabled={page === 0}
          >
            Previous
          </button>
          <span className="px-2 text-sm font-medium text-slate-700 tabular-nums">
            Page {page + 1} of {pageCount}
          </span>
          <button
            type="button"
            className={`${buttonSecondary} px-3 py-1.5`}
            onClick={() => goTo(page + 1)}
            disabled={page + 1 >= pageCount}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
