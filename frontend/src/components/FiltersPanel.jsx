import React from "react";

export default function FiltersPanel({
  rows,
  examFilter,
  setExamFilter,
  sectionFilter,
  setSectionFilter,
  flagFilter,
  setFlagFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  onExport,
}) {
  const exams = Array.from(new Set(rows.map((r) => String(r.exam_number))));
  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <h2 className="font-semibold mb-3">Filters</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-slate-600">Exam</label>
          <select
            value={examFilter}
            onChange={(e) => setExamFilter(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl border"
          >
            <option value="all">All</option>
            {exams.map((ex) => (
              <option key={ex} value={ex}>
                {ex}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-600">Section type</label>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl border"
          >
            <option value="all">All</option>
            <option>Logical Reasoning</option>
            <option>Reading Comprehension</option>
            <option>Unknown</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-600">Flagged</label>
          <select
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl border"
          >
            <option value="all">All</option>
            <option value="flagged">Only flagged</option>
            <option value="unflagged">Only un-flagged</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm text-slate-600">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border"
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border"
            />
          </div>
        </div>
        <button
          onClick={onExport}
          className="col-span-full inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-slate-50"
        >
          Export filtered CSV
        </button>
      </div>
    </section>
  );
}
