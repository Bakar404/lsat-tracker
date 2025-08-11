import React, { useMemo, useState, useEffect } from "react";
import {
  Layers3,
  Database,
  CheckCircle2,
  XCircle,
  Clock,
  Flag,
  LogOut,
  Filter,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import UploadDropdown from "./UploadDropdown";
import FiltersPanel from "./FiltersPanel";
import KpiCard from "./cards/KpiCard";

import SectionAccuracyChart from "../charts/SectionAccuracyChart";
import TrendChart from "../charts/TrendChart";
import SubtypeBar from "../charts/SubtypeBar";
import FlaggedPie from "../charts/FlaggedPie";
import AvgTimeBar from "../charts/AvgTimeBar";

import {
  useData,
  fmtMMSS,
  LOGICAL_REASONING_SUBTYPES,
  READING_COMP_SUBTYPES,
} from "../hooks/useData";

export default function Dashboard({ user, onSignOut }) {
  const [profile, setProfile] = useState(null);
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
  } = useData(user);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("approved, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }
      setProfile(data);
    })();
  }, [user]);

  const bySectionType = useMemo(() => {
    const sectionTypes = ["Logical Reasoning", "Reading Comprehension"];
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onSignOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Upload Test Button */}
            <UploadDropdown
              user={user}
              onAfterUpload={() => window.location.reload()}
            />

            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-slate-900 rounded-xl">
                <Layers3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  LSAT Tracker
                </h1>
                <p className="text-sm text-slate-500">
                  Welcome back, {user?.email}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Filters Section */}
        <div className="bg-white rounded-3xl shadow-lg border border-slate-200/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg">
              <Filter className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
          </div>
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

        {/* Empty State */}
        {loading || !joined.rows.length ? (
          <div className="bg-white rounded-3xl shadow-lg border border-slate-200/50 p-12 text-center">
            {loading ? (
              <div className="space-y-4">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto"></div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Loading your data...
                </h3>
                <p className="text-slate-500">
                  Please wait while we fetch your LSAT progress.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
                  <Database className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  No data yet
                </h3>
                <p className="text-slate-500">
                  Click "Upload Test" in the header to upload your first LSAT
                  PDF and start tracking your progress.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl">
                  <Database className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Questions</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {joined.rows.length}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Correct</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {joined.rows.reduce(
                      (s, r) => s + (r.question_score ? 1 : 0),
                      0
                    )}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-xl">
                  <XCircle className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Accuracy</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {Math.round(
                      (joined.rows.reduce(
                        (s, r) => s + (r.question_score ? 1 : 0),
                        0
                      ) /
                        (joined.rows.length || 1)) *
                        100
                    )}
                    %
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-xl">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Avg Time</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {fmtMMSS(
                      joined.rows.length
                        ? joined.rows.reduce(
                            (s, r) => s + (Number(r.total_time_seconds) || 0),
                            0
                          ) / joined.rows.length
                        : 0
                    )}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-xl">
                  <Flag className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Flagged</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {joined.rows.filter((r) => r.flagged).length}
                  </p>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="space-y-8">
              {/* Row 1 */}
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl shadow-lg border border-slate-200/50 overflow-hidden">
                  <SectionAccuracyChart data={bySectionType} />
                </div>
                <div className="bg-white rounded-3xl shadow-lg border border-slate-200/50 overflow-hidden">
                  <TrendChart data={trendByExam} />
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl shadow-lg border border-slate-200/50 overflow-hidden">
                  <SubtypeBar data={bySubtype} />
                </div>
                <div className="bg-white rounded-3xl shadow-lg border border-slate-200/50 overflow-hidden">
                  <FlaggedPie
                    flagged={joined.rows.filter((r) => r.flagged).length}
                    unflagged={joined.rows.filter((r) => !r.flagged).length}
                  />
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl shadow-lg border border-slate-200/50 overflow-hidden">
                  <AvgTimeBar data={bySubtype} fmt={fmtMMSS} />
                </div>
                <div className="bg-white rounded-3xl shadow-lg border border-slate-200/50 p-8">
                  <h3 className="text-xl font-semibold text-slate-900 mb-4">
                    How it works
                  </h3>
                  <ul className="space-y-3 text-slate-600">
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-slate-400 rounded-full mt-2 flex-shrink-0"></div>
                      <span>Sign up with email + password → confirm email</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-slate-400 rounded-full mt-2 flex-shrink-0"></div>
                      <span>Admin approves your account for security</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-slate-400 rounded-full mt-2 flex-shrink-0"></div>
                      <span>Upload PDFs to track your LSAT progress</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/50 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} LSAT Tracker. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
