import React, { useMemo, useState } from "react";
import {
  Layers3,
  Database,
  CheckCircle2,
  XCircle,
  Clock,
  Flag,
  FileDown,
} from "lucide-react";
import AuthPanel from "./components/AuthPanel";
import UploadPanel from "./components/UploadPanel";
import FiltersPanel from "./components/FiltersPanel";
import KpiCard from "./components/cards/KpiCard";

import SectionAccuracyChart from "./charts/SectionAccuracyChart";
import TrendChart from "./charts/TrendChart";
import SubtypeBar from "./charts/SubtypeBar";
import FlaggedPie from "./charts/FlaggedPie";
import AvgTimeBar from "./charts/AvgTimeBar";

import {
  useData,
  fmtMMSS,
  inferSectionType,
  LOGICAL_REASONING_SUBTYPES,
  READING_COMP_SUBTYPES,
} from "./hooks/useData";

export default function App() {
  const [user, setUser] = useState(null);
  const {
    loading,
    joined,
    kpis,
    trendByExam,
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
    uploadPdfAndUpsert,
  } = useData(user || undefined);

  const bySectionType = useMemo(() => {
    const sectionTypes = [
      "Logical Reasoning",
      "Reading Comprehension",
      "Unknown",
    ];
    return sectionTypes.map((st) => {
      const subset = joined.rows.filter((r) => r.section_type === st);
      const attempted = subset.length || 0;
      const correct = subset.reduce(
        (s, r) => s + (r.question_score ? 1 : 0),
        0
      );
      const accuracy = attempted ? Math.round((100 * correct) / attempted) : 0;
      return { section_type: st, attempted, correct, accuracy };
    });
  }, [joined]);

  const bySubtype = useMemo(() => {
    const targetSubtypes = Array.from(
      new Set([...LOGICAL_REASONING_SUBTYPES, ...READING_COMP_SUBTYPES])
    );
    const map = new Map();
    for (const t of targetSubtypes)
      map.set(t, { subtype: t, attempted: 0, correct: 0, avgSec: 0 });
    for (const r of joined.rows) {
      const key = map.has(r.subtype) ? r.subtype : r.subtype || "(Other)";
      if (!map.has(key))
        map.set(key, { subtype: key, attempted: 0, correct: 0, avgSec: 0 });
      const obj = map.get(key);
      obj.attempted++;
      obj.correct += r.question_score ? 1 : 0;
      obj.avgSec += Number(r.total_time_seconds || 0);
    }
    const out = Array.from(map.values()).map((o) => ({
      ...o,
      accuracy: o.attempted ? Math.round((100 * o.correct) / o.attempted) : 0,
      avgSec: o.attempted ? Math.round(o.avgSec / o.attempted) : 0,
      section_type: LOGICAL_REASONING_SUBTYPES.includes(o.subtype)
        ? "Logical Reasoning"
        : READING_COMP_SUBTYPES.includes(o.subtype)
        ? "Reading Comprehension"
        : "Unknown",
    }));
    out.sort((a, b) => a.accuracy - b.accuracy || b.attempted - a.attempted);
    return out;
  }, [joined]);

  const downloadCSV = () => {
    const header = [
      "exam_number",
      "section",
      "question",
      "section_type",
      "subtype",
      "difficulty",
      "total_time_seconds",
      "question_score",
      "flagged",
      "experimental_section",
      "exam_date",
      "scaled_score",
    ];
    const lines = [header.join(",")];
    for (const r of joined.rows) {
      const vals = header.map((h) => r[h] ?? "");
      lines.push(
        vals
          .map((v) =>
            typeof v === "string" && v.includes(",")
              ? `"${v.replaceAll('"', '""')}"`
              : v
          )
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lsat_filtered_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Layers3 className="w-6 h-6" />
          <h1 className="text-xl font-semibold">LSAT Tracker</h1>
          <div className="ml-auto">
            <AuthPanel onAuthed={setUser} />
          </div>
        </div>
      </header>

      {/* Inputs */}
      <div className="max-w-7xl mx-auto px-4 py-4 grid md:grid-cols-2 gap-4">
        <UploadPanel
          disabled={!user}
          onUpload={({ file, examNumberOverride, examDateOverride }) =>
            uploadPdfAndUpsert({
              file,
              examNumberOverride,
              examDateOverride,
              user,
            })
              .then(() => alert("Test transformed and saved."))
              .catch((e) => {
                console.error(e);
                alert(e.message || "Failed to upload/transform.");
              })
          }
        />
        <FiltersPanel
          rows={joined.rows}
          examFilter={examFilter}
          setExamFilter={setExamFilter}
          sectionFilter={sectionFilter}
          setSectionFilter={setSectionFilter}
          flagFilter={flagFilter}
          setFlagFilter={setFlagFilter}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          onExport={downloadCSV}
        />
      </div>

      {/* Empty state */}
      <div className="max-w-7xl mx-auto px-4 pb-2">
        {!user ? (
          <div className="bg-white rounded-2xl shadow p-6 text-center">
            <h2 className="text-lg font-semibold">Sign in to get started</h2>
            <p className="text-slate-600 mt-1">
              Create an account, confirm your email, then wait for admin
              approval.
            </p>
          </div>
        ) : loading || !joined.rows.length ? (
          <div className="bg-white rounded-2xl shadow p-6 text-center">
            {loading ? "Loading…" : "No data yet. Upload a PDF above."}
          </div>
        ) : null}
      </div>

      {/* KPIs */}
      <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-5 gap-4">
        <KpiCard
          title="Questions"
          value={joined.rows.length}
          icon={<Database className="w-5 h-5" />}
        />
        <KpiCard
          title="Correct"
          value={joined.rows.reduce(
            (s, r) => s + (r.question_score ? 1 : 0),
            0
          )}
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <KpiCard
          title="Accuracy"
          value={`${Math.round(
            (joined.rows.reduce((s, r) => s + (r.question_score ? 1 : 0), 0) /
              (joined.rows.length || 1)) *
              100
          )}%`}
          icon={<XCircle className="w-5 h-5" />}
        />
        <KpiCard
          title="Avg time"
          value={fmtMMSS(
            joined.rows.length
              ? joined.rows.reduce(
                  (s, r) => s + (Number(r.total_time_seconds) || 0),
                  0
                ) / joined.rows.length
              : 0
          )}
          icon={<Clock className="w-5 h-5" />}
        />
        <KpiCard
          title="Flagged"
          value={joined.rows.filter((r) => r.flagged).length}
          icon={<Flag className="w-5 h-5" />}
        />
      </div>

      {/* Charts */}
      <div className="max-w-7xl mx-auto px-4 py-4 grid lg:grid-cols-2 gap-4">
        <SectionAccuracyChart data={bySectionType} />
        <TrendChart data={trendByExam} />
        <SubtypeBar data={bySubtype} />
        <FlaggedPie
          flagged={joined.rows.filter((r) => r.flagged).length}
          unflagged={joined.rows.filter((r) => !r.flagged).length}
        />
        <AvgTimeBar data={bySubtype} fmt={fmtMMSS} />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-2">How it works</h2>
          <ul className="list-disc ml-5 text-sm text-slate-700 space-y-1">
            <li>Sign up with email + password → confirm email.</li>
            <li>
              Admin approves your account. Until then, sign-ins are blocked.
            </li>
            <li>
              Upload a PDF. We transform it and upsert rows/meta into your
              private tables.
            </li>
          </ul>
        </div>
        <footer className="text-center text-xs text-slate-500 mt-6 pb-8">
          © {new Date().getFullYear()} LSAT Tracker.
        </footer>
      </div>
    </div>
  );
}
