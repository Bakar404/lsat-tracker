import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import { summarizeExam } from "../lib/analytics.js";
import { fmtDate, fmtPercent, plural } from "../lib/format.js";
import { card } from "./ui/styles.js";

const SOURCE_LABELS = { upload: "Uploaded", sample: "Sample", import: "Imported" };

function SampleBadge() {
  return (
    <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      Sample
    </span>
  );
}

function DeleteButton({ exam, onDelete }) {
  return (
    <button
      type="button"
      onClick={() => onDelete(exam)}
      aria-label={`Delete exam ${exam.exam_number}`}
      title="Delete exam"
      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-600"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

const experimentalLabel = (sections) =>
  sections.length ? sections.map((section) => `Section ${section}`).join(", ") : "-";

export default function ExamsView({ exams, onDelete }) {
  const entries = useMemo(
    () => [...exams].reverse().map((exam) => ({ exam, stats: summarizeExam(exam) })),
    [exams],
  );

  return (
    <section className={`${card} overflow-hidden`} aria-labelledby="exams-heading">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <h2 id="exams-heading" className="text-lg font-semibold text-slate-900">
          Saved exams
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {plural(exams.length, "exam")}, newest first. They are stored only in this browser, so use
          Export backup in the Data menu to keep a copy.
        </p>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wider text-slate-600 uppercase">
            <tr>
              <th scope="col" className="px-6 py-3">Exam</th>
              <th scope="col" className="px-4 py-3">Date</th>
              <th scope="col" className="px-4 py-3">Scaled</th>
              <th scope="col" className="px-4 py-3">Questions</th>
              <th scope="col" className="px-4 py-3">Accuracy</th>
              <th scope="col" className="px-4 py-3">Flagged</th>
              <th scope="col" className="px-4 py-3">Experimental</th>
              <th scope="col" className="px-4 py-3">Source</th>
              <th scope="col" className="px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map(({ exam, stats }) => (
              <tr key={exam.exam_number} className="transition-colors hover:bg-slate-50">
                <th scope="row" className="px-6 py-3.5 text-left font-semibold whitespace-nowrap text-slate-900">
                  {exam.exam_number}
                  {exam.source === "sample" && <SampleBadge />}
                </th>
                <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">{fmtDate(exam.exam_date)}</td>
                <td className="px-4 py-3.5 text-slate-900 tabular-nums">{exam.scaled_score ?? "-"}</td>
                <td className="px-4 py-3.5 text-slate-600 tabular-nums">{stats.questions}</td>
                <td className="px-4 py-3.5 whitespace-nowrap tabular-nums">
                  <span className="font-medium text-slate-900">{fmtPercent(stats.accuracy)}</span>
                  <span className="ml-1.5 text-slate-500">
                    ({stats.correct}/{stats.attempted})
                  </span>
                </td>
                <td className="px-4 py-3.5 text-slate-600 tabular-nums">{stats.flagged}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                  {experimentalLabel(stats.experimentalSections)}
                </td>
                <td className="max-w-56 px-4 py-3.5 text-slate-600">
                  {SOURCE_LABELS[exam.source] ?? "Imported"}
                  {exam.file_name && (
                    <span className="block truncate text-xs text-slate-400" title={exam.file_name}>
                      {exam.file_name}
                    </span>
                  )}
                </td>
                <td className="px-6 py-2 text-right">
                  <DeleteButton exam={exam} onDelete={onDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-slate-100 md:hidden">
        {entries.map(({ exam, stats }) => (
          <li key={exam.exam_number} className="flex items-start justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">
                Exam {exam.exam_number}
                {exam.source === "sample" && <SampleBadge />}
              </p>
              <p className="text-sm text-slate-500">
                {fmtDate(exam.exam_date)}
                {exam.scaled_score != null && `, scaled ${exam.scaled_score}`}
              </p>
              <dl className="mt-2 grid grid-cols-3 gap-x-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Accuracy</dt>
                  <dd className="font-medium text-slate-900">{fmtPercent(stats.accuracy)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Questions</dt>
                  <dd className="font-medium text-slate-900">{stats.questions}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Flagged</dt>
                  <dd className="font-medium text-slate-900">{stats.flagged}</dd>
                </div>
              </dl>
            </div>
            <DeleteButton exam={exam} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    </section>
  );
}
