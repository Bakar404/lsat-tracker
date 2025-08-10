import React, { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
} from "recharts";
import {
  Upload,
  FileDown,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  Flag,
  Layers3,
  Database,
} from "lucide-react";

/* ---- Fixed subtype lists ---- */
const LOGICAL_REASONING_SUBTYPES = [
  "Assumptions",
  "Strengthen or Weaken",
  "Conclusions and Disputes",
  "Flaws",
  "Deductions and Inference",
  "Matching Structure and Principles",
  "Matching Flaws",
  "Explain or Resolve",
  "Techniques, Roles, and Principles",
];
const READING_COMP_SUBTYPES = [
  "Humanities passages",
  "Law passages",
  "Social science passages",
  "Science passages",
];

/* ---- Where to call the backend ---- */
const DEFAULT_TRANSFORMER =
  import.meta.env.VITE_TRANSFORMER_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:8000/transform" // dev
    : "https://lsat-tracker.onrender.com/transform"); // prod

/* ---- CSV helpers ---- */
function parseCSV(text) {
  const rows = [];
  let i = 0,
    field = "",
    row = [],
    inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    } else {
      if (c === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (c === ",") {
        pushField();
        i++;
        continue;
      }
      if (c === "\n" || c === "\r") {
        pushField();
        pushRow();
        if (c === "\r" && text[i + 1] === "\n") i++;
        i++;
        while (text[i] === "\n" || text[i] === "\r") i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
  }
  pushField();
  if (row.length > 1 || (row.length === 1 && row[0] !== "")) pushRow();
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => (h || "").trim());
  return rows
    .slice(1)
    .map((r) =>
      Object.fromEntries(header.map((h, idx) => [h, (r[idx] ?? "").trim()]))
    );
}
const headerMap = (obj) => {
  const map = {};
  for (const k of Object.keys(obj)) {
    const key = k.toLowerCase().replace(/\s+|_/g, "");
    if (/(^examnumber$|^examno$|^exam$)/.test(key)) map[k] = "exam_number";
    else if (/^(section|sectionid|sectionnumber)$/.test(key))
      map[k] = "section";
    else if (/^(question|q|questionnumber)$/.test(key)) map[k] = "question";
    else if (/^(subtype|type|questiontype|subcategory)$/.test(key))
      map[k] = "subtype";
    else if (/^(difficulty|level)$/.test(key)) map[k] = "difficulty";
    else if (
      /^(totaltime|totaltimeinseconds|totaltimeseconds|totaltime_seconds|totaltimesecond|totalseconds|timeinseconds)$/.test(
        key
      )
    )
      map[k] = "total_time_seconds";
    else if (/^(questionscore|score|correct)$/.test(key))
      map[k] = "question_score";
    else if (/^(flag|flagged)$/.test(key)) map[k] = "flagged";
    else if (
      /^(experimental|experimentalsection|experimental_section)$/.test(key)
    )
      map[k] = "experimental_section";
    else if (/^(examdate|date)$/.test(key)) map[k] = "exam_date";
    else if (/^(scaledscore|scaled_score)$/.test(key)) map[k] = "scaled_score";
    else if (/^(sectiontype|sectype)$/.test(key)) map[k] = "section_type";
    else map[k] = k;
  }
  const out = {};
  for (const [oldK, newK] of Object.entries(map)) out[newK] = obj[oldK];
  return out;
};
function inferSectionType(subtype) {
  if (!subtype) return "Unknown";
  if (LOGICAL_REASONING_SUBTYPES.includes(subtype)) return "Logical Reasoning";
  if (READING_COMP_SUBTYPES.includes(subtype)) return "Reading Comprehension";
  return "Unknown";
}
const toNum = (v, d = 0) => {
  if (v === undefined || v === null || v === "") return d;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : d;
};
const toBool = (v) => {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
};
const fmtMMSS = (sec) => {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

export default function App() {
  // Data in memory (DB wiring next step)
  const [rawRows, setRawRows] = useState([]);
  const [metaRows, setMetaRows] = useState([]);

  // Exam overrides (optional)
  const [examNumberOverride, setExamNumberOverride] = useState("");
  const [examDateOverride, setExamDateOverride] = useState(""); // YYYY-MM-DD

  // Filters
  const [examFilter, setExamFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [flagFilter, setFlagFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Upload PDF → backend → 2 CSVs → parse → append
  const onUploadPdf = async (file) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (examNumberOverride.trim())
        fd.append("exam_number", examNumberOverride.trim());
      if (examDateOverride.trim())
        fd.append("exam_date", examDateOverride.trim());

      const res = await fetch(DEFAULT_TRANSFORMER, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const detail = await tryGetDetail(res);
        throw new Error(detail || `Transformer error ${res.status}`);
      }

      const contentType = res.headers.get("content-type") || "";
      let allCsv = "",
        metaCsv = "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        allCsv = json.all_sections_csv || json.all_sections_clean_scored || "";
        metaCsv = json.exam_metadata_csv || json.exam_metadata || "";
      } else {
        const text = await res.text();
        const parts = text.split("\n---META---\n");
        allCsv = parts[0] || text;
        metaCsv = parts[1] || "";
      }
      if (!allCsv.trim() || !metaCsv.trim())
        throw new Error("Transformer response missing one of the CSVs.");

      const parsedRows = parseCSV(allCsv)
        .map(headerMap)
        .map((r) => ({
          exam_number: String(r.exam_number ?? r.exam ?? "").trim(),
          section: String(r.section ?? "").trim(),
          question: String(r.question ?? "").trim(),
          subtype: (r.subtype ?? "").trim(),
          difficulty: String(r.difficulty ?? "").replace(/[^0-9-]/g, ""),
          total_time_seconds: toNum(
            r.total_time_seconds ?? r.total_time ?? r.time_seconds ?? r.seconds,
            0
          ),
          question_score: toNum(r.question_score, 0),
          flagged: toBool(r.flagged),
          experimental_section: toBool(r.experimental_section),
          section_type:
            r.section_type || inferSectionType((r.subtype || "").trim()),
        }));
      const parsedMeta = parseCSV(metaCsv)
        .map(headerMap)
        .map((r) => ({
          exam_number: String(r.exam_number ?? r.exam ?? "").trim(),
          exam_date: String(r.exam_date ?? r.date ?? "").trim(),
          scaled_score: toNum(r.scaled_score ?? r.score, null),
        }));

      setRawRows((prev) => mergeRows(prev, parsedRows));
      setMetaRows((prev) => mergeMeta(prev, parsedMeta));
      alert("Test transformed and uploaded.");
    } catch (e) {
      console.error(e);
      alert(
        e.message || "Failed to transform this PDF. Check console and backend."
      );
    }
  };

  // De-dupers
  const mergeRows = (base, incoming) => {
    const key = (r) => `${r.exam_number}|${r.section}|${r.question}`;
    const map = new Map(base.map((r) => [key(r), r]));
    for (const r of incoming) map.set(key(r), r);
    return Array.from(map.values());
  };
  const mergeMeta = (base, incoming) => {
    const map = new Map(base.map((m) => [String(m.exam_number), m]));
    for (const m of incoming) map.set(String(m.exam_number), m);
    return Array.from(map.values());
  };

  // Derived
  const rows = useMemo(() => {
    const metaByExam = new Map(metaRows.map((m) => [m.exam_number, m]));
    let out = rawRows.map((r) => ({
      ...r,
      section_type: r.section_type || inferSectionType(r.subtype),
      exam_date: metaByExam.get(r.exam_number)?.exam_date || "",
      scaled_score: metaByExam.get(r.exam_number)?.scaled_score ?? null,
    }));
    if (examFilter !== "all")
      out = out.filter((r) => String(r.exam_number) === String(examFilter));
    if (sectionFilter !== "all")
      out = out.filter((r) => r.section_type === sectionFilter);
    if (flagFilter === "flagged") out = out.filter((r) => !!r.flagged);
    if (flagFilter === "unflagged") out = out.filter((r) => !r.flagged);
    const fromOk = dateFrom ? new Date(dateFrom) : null;
    const toOk = dateTo ? new Date(dateTo) : null;
    if (fromOk)
      out = out.filter((r) => r.exam_date && new Date(r.exam_date) >= fromOk);
    if (toOk)
      out = out.filter((r) => r.exam_date && new Date(r.exam_date) <= toOk);
    return { rows: out, metas: metaRows };
  }, [
    rawRows,
    metaRows,
    examFilter,
    sectionFilter,
    flagFilter,
    dateFrom,
    dateTo,
  ]);

  const kpis = useMemo(() => {
    const arr = rows.rows;
    const attempted = arr.length;
    const correct = arr.reduce((s, r) => s + (r.question_score ? 1 : 0), 0);
    const accuracy = attempted ? (100 * correct) / attempted : 0;
    const avgSec = attempted
      ? arr.reduce((s, r) => s + toNum(r.total_time_seconds), 0) / attempted
      : 0;
    const flagged = arr.filter((r) => r.flagged).length;
    const scaledAvg = (() => {
      const vals = rows.metas
        .map((m) => toNum(m.scaled_score, NaN))
        .filter(Number.isFinite);
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    })();
    return { attempted, correct, accuracy, avgSec, flagged, scaledAvg };
  }, [rows]);

  const bySectionType = useMemo(() => {
    const sectionTypes = [
      "Logical Reasoning",
      "Reading Comprehension",
      "Unknown",
    ];
    return sectionTypes.map((st) => {
      const subset = rows.rows.filter((r) => r.section_type === st);
      const attempted = subset.length || 0;
      const correct = subset.reduce(
        (s, r) => s + (r.question_score ? 1 : 0),
        0
      );
      const accuracy = attempted ? Math.round((100 * correct) / attempted) : 0;
      return { section_type: st, attempted, correct, accuracy };
    });
  }, [rows]);

  const bySubtype = useMemo(() => {
    const targetSubtypes = Array.from(
      new Set([...LOGICAL_REASONING_SUBTYPES, ...READING_COMP_SUBTYPES])
    );
    const map = new Map();
    for (const t of targetSubtypes)
      map.set(t, { subtype: t, attempted: 0, correct: 0, avgSec: 0 });
    for (const r of rows.rows) {
      const key = map.has(r.subtype) ? r.subtype : r.subtype || "(Other)";
      if (!map.has(key))
        map.set(key, { subtype: key, attempted: 0, correct: 0, avgSec: 0 });
      const obj = map.get(key);
      obj.attempted++;
      obj.correct += r.question_score ? 1 : 0;
      obj.avgSec += toNum(r.total_time_seconds);
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
  }, [rows]);

  const trendByExam = useMemo(() => {
    const groups = new Map();
    for (const r of rows.rows) {
      const k = String(r.exam_number);
      if (!groups.has(k))
        groups.set(k, {
          exam_number: k,
          attempted: 0,
          correct: 0,
          exam_date: r.exam_date || "",
        });
      const g = groups.get(k);
      g.attempted++;
      g.correct += r.question_score ? 1 : 0;
    }
    for (const m of rows.metas) {
      const k = String(m.exam_number);
      if (!groups.has(k))
        groups.set(k, {
          exam_number: k,
          attempted: 0,
          correct: 0,
          exam_date: m.exam_date || "",
        });
      groups.get(k).scaled_score = toNum(m.scaled_score, null);
      if (!groups.get(k).exam_date) groups.get(k).exam_date = m.exam_date || "";
    }
    const out = Array.from(groups.values()).map((g) => ({
      ...g,
      accuracy: g.attempted ? Math.round((100 * g.correct) / g.attempted) : 0,
    }));
    out.sort((a, b) => {
      const da = a.exam_date ? new Date(a.exam_date).getTime() : null;
      const db = b.exam_date ? new Date(b.exam_date).getTime() : null;
      if (da && db) return da - db;
      return toNum(a.exam_number) - toNum(b.exam_number);
    });
    return out;
  }, [rows]);

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
    for (const r of rows.rows) {
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
        </div>
      </header>

      {/* Upload */}
      <div className="max-w-7xl mx-auto px-4 py-4 grid md:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Upload className="w-4 h-4" /> Transform & Upload Test
          </h2>
          <div className="grid gap-3">
            <div className="grid md:grid-cols-3 gap-2">
              <input
                value={examNumberOverride}
                onChange={(e) => setExamNumberOverride(e.target.value)}
                placeholder="Exam # (optional)"
                className="px-3 py-2 rounded-xl border text-sm"
              />
              <input
                type="date"
                value={examDateOverride}
                onChange={(e) => setExamDateOverride(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="px-3 py-2 rounded-xl border text-sm"
              />
              <label className="inline-flex items-center justify-center px-3 py-2 rounded-xl bg-slate-900 text-white cursor-pointer">
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadPdf(f);
                  }}
                />
                Choose PDF & Upload
              </label>
            </div>
            <p className="text-xs text-slate-500">
              If your filename is generic, set Exam # and Exam date so the
              parser is correct.
            </p>
          </div>
        </section>

        {/* Filters */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filters
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-600">Exam</label>
              <select
                value={examFilter}
                onChange={(e) => setExamFilter(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border"
              >
                <option value="all">All</option>
                {Array.from(
                  new Set(rawRows.map((r) => String(r.exam_number)))
                ).map((ex) => (
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
              onClick={downloadCSV}
              className="col-span-full inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-slate-50"
            >
              <FileDown className="w-4 h-4" /> Export filtered CSV
            </button>
          </div>
        </section>
      </div>

      {/* Empty state */}
      <div className="max-w-7xl mx-auto px-4 pb-2">
        {rawRows.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-6 text-center">
            <h2 className="text-lg font-semibold">No data yet</h2>
            <p className="text-slate-600 mt-1">
              Set optional overrides, then click <em>Choose PDF & Upload</em>.
            </p>
          </div>
        ) : null}
      </div>

      {/* KPIs */}
      <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-5 gap-4">
        <KpiCard
          title="Questions"
          value={rows.rows.length}
          icon={<Database className="w-5 h-5" />}
        />
        <KpiCard
          title="Correct"
          value={rows.rows.reduce((s, r) => s + (r.question_score ? 1 : 0), 0)}
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <KpiCard
          title="Accuracy"
          value={`${Math.round(
            (rows.rows.reduce((s, r) => s + (r.question_score ? 1 : 0), 0) /
              (rows.rows.length || 1)) *
              100
          )}%`}
          icon={<XCircle className="w-5 h-5" />}
        />
        <KpiCard
          title="Avg time"
          value={fmtMMSS(
            rows.rows.length
              ? rows.rows.reduce((s, r) => s + toNum(r.total_time_seconds), 0) /
                  rows.rows.length
              : 0
          )}
          icon={<Clock className="w-5 h-5" />}
        />
        <KpiCard
          title="Flagged"
          value={rows.rows.filter((r) => r.flagged).length}
          icon={<Flag className="w-5 h-5" />}
        />
      </div>

      {/* Charts */}
      <div className="max-w-7xl mx-auto px-4 py-4 grid lg:grid-cols-2 gap-4">
        <Card title="Accuracy by Section Type">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={bySectionType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="section_type" />
              <YAxis unit="%" />
              <Tooltip />
              <Bar dataKey="accuracy" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Trend by Exam (Accuracy & Scaled Score)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendByExam}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="exam_number" />
              <YAxis yAxisId="left" unit="%" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="accuracy"
                name="Accuracy %"
                stroke="#10b981"
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="scaled_score"
                name="Scaled"
                stroke="#f97316"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Subtype Weaknesses & Strengths (Accuracy)">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              data={bySubtype.slice(0, 15)}
              layout="vertical"
              margin={{ left: 140 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} unit="%" />
              <YAxis type="category" dataKey="subtype" width={140} />
              <Tooltip
                formatter={(v, name) => (name === "accuracy" ? `${v}%` : v)}
              />
              <Bar dataKey="accuracy">
                {bySubtype.slice(0, 15).map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={
                      [
                        "#0ea5e9",
                        "#10b981",
                        "#f97316",
                        "#a78bfa",
                        "#f43f5e",
                        "#14b8a6",
                        "#eab308",
                        "#64748b",
                      ][idx % 8]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Flagged vs Un-flagged">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                dataKey="value"
                data={[
                  {
                    name: "Flagged",
                    value: rows.rows.filter((r) => r.flagged).length,
                  },
                  {
                    name: "Un-flagged",
                    value: rows.rows.filter((r) => !r.flagged).length,
                  },
                ]}
                outerRadius={100}
                label
              >
                <Cell fill="#f43f5e" />
                <Cell fill="#14b8a6" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Average Time by Subtype (mm:ss)">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={bySubtype.slice(0, 12)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="subtype"
                interval={0}
                angle={-20}
                textAnchor="end"
                height={80}
              />
              <YAxis />
              <Tooltip formatter={(v) => fmtMMSS(v)} />
              <Bar dataKey="avgSec">
                {bySubtype.slice(0, 12).map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={
                      [
                        "#0ea5e9",
                        "#10b981",
                        "#f97316",
                        "#a78bfa",
                        "#f43f5e",
                        "#14b8a6",
                        "#eab308",
                        "#64748b",
                      ][(idx + 2) % 8]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* About */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-2">How it works</h2>
          <ul className="list-disc ml-5 text-sm text-slate-700 space-y-1">
            <li>
              Set optional <strong>Exam #</strong> and{" "}
              <strong>Exam date</strong> (YYYY-MM-DD).
            </li>
            <li>
              Click <strong>Choose PDF & Upload</strong>. Your data appears
              below and aggregates across uploads.
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

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function KpiCard({ title, value, icon }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4 flex items-center gap-3">
      <div className="p-2 rounded-xl bg-slate-100">{icon}</div>
      <div>
        <div className="text-xs text-slate-500">{title}</div>
        <div className="text-lg font-semibold">{value ?? "—"}</div>
      </div>
    </div>
  );
}

async function tryGetDetail(res) {
  try {
    const j = await res.clone().json();
    return j?.detail;
  } catch {
    return null;
  }
}
