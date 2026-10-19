import { Database, FlaskConical, Lock, Upload } from "lucide-react";
import { buttonPrimary, buttonSecondary, card } from "./ui/styles.js";

const STEPS = [
  {
    title: "Download your score reports",
    text: "In LawHub, open the score report for a completed practice test and save it as a PDF.",
  },
  {
    title: "Upload the PDFs",
    text: "Add one or more reports. The server running on this computer reads every question from them.",
  },
  {
    title: "Find your weak spots",
    text: "Compare accuracy and timing by question type, difficulty, section and exam, and track your progress.",
  },
];

export default function EmptyState({ onUpload, onLoadSample }) {
  return (
    <section className={`${card} px-6 py-12 text-center sm:px-12 sm:py-16`}>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <Database className="h-8 w-8 text-slate-400" aria-hidden="true" />
      </div>
      <h2 className="mt-6 text-2xl font-bold text-slate-900">Track your LSAT practice tests</h2>
      <p className="mx-auto mt-2 max-w-xl text-slate-600">
        LSAT Tracker turns LawHub score reports into a dashboard of your accuracy, timing and flagged
        questions, so you know exactly what to practice next.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <button type="button" className={`${buttonPrimary} px-5 py-2.5`} onClick={onUpload}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          Upload score reports
        </button>
        <button type="button" className={`${buttonSecondary} px-5 py-2.5`} onClick={onLoadSample}>
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
          Explore with sample data
        </button>
      </div>
      <ol className="mx-auto mt-12 grid max-w-4xl gap-4 text-left sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {index + 1}
            </span>
            <h3 className="mt-3 font-semibold text-slate-900">{step.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{step.text}</p>
          </li>
        ))}
      </ol>
      <p className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-500">
        <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
        Reports are parsed on this computer and saved only in this browser. No account needed.
      </p>
    </section>
  );
}
