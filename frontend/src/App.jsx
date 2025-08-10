import React, { useMemo, useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend } from "recharts";
import { Upload, FileDown, Filter, Clock, CheckCircle2, XCircle, Flag, Layers3, Database, Settings, RefreshCw } from "lucide-react";

/**
 * LSAT Tracker – single‑file React app
 *
 * What this does
 * - Lets a user upload two CSVs (per‑question rows + exam metadata) OR try a demo dataset.
 * - Computes KPIs + visuals: accuracy by section & subtype, time per question, trends by exam, flagged analysis.
 * - Includes fixed subtype lists for Logical Reasoning and Reading Comprehension so missing categories still appear.
 * - Provides basic filtering: exam, date range, section type, flagged.
 * - Includes an optional (future) PDF -> CSV transformer endpoint field. Right now it’s a placeholder.
 *
 * Data expectations
 * all_sections_clean_scored.csv – columns (case/spacing flexible):
 *   exam_number, section, question, subtype, difficulty, total_time_seconds, question_score, flagged, experimental_section
 * exam_metadata.csv – columns: exam_number, exam_date (YYYY-MM-DD ok), scaled_score
 *
 * Notes
 * - If your column headers differ slightly, the headerMap tries to normalize names.
 * - If section type isn’t provided, it’s inferred from subtype membership (LR vs RC) using the lists below.
 */

// ----- Subtype dictionaries (fixed lists used in visuals even if data lacks some) -----
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

// Minimal CSV parser (handles quoted fields and commas). Returns array of objects keyed by header row.
function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { rows.push(row); row = []; };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      } else { field += c; i++; continue; }
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { pushField(); i++; continue; }
      if (c === '\n' || c === '\r') {
        // handle CRLF/CR
        // consume consecutive line breaks
        pushField(); pushRow();
        if (c === '\r' && text[i + 1] === '\n') i++;
        i++;
        // skip extra linebreaks
        while ((text[i] === '\n' || text[i] === '\r')) i++;
        continue;
      }
      field += c; i++; continue;
    }
  }
  // flush last
  pushField();
  if (row.length > 1 || (row.length === 1 && row[0] !== '')) pushRow();
  if (rows.length === 0) return [];
  const header = rows[0].map(h => (h || '').trim());
  return rows.slice(1).map(r => Object.fromEntries(header.map((h, idx) => [h, (r[idx] ?? '').trim()])));
}

// Normalize headers to a canonical shape
const headerMap = (obj) => {
  const map = {};
  for (const k of Object.keys(obj)) {
    const key = k.toLowerCase().replace(/\s+|_/g, "");
    if (/(^examnumber$|^examno$|^exam$)/.test(key)) map[k] = "exam_number";
    else if (/^(section|sectionid|sectionnumber)$/.test(key)) map[k] = "section";
    else if (/^(question|q|questionnumber)$/.test(key)) map[k] = "question";
    else if (/^(subtype|type|questiontype|subcategory)$/.test(key)) map[k] = "subtype";
    else if (/^(difficulty|level)$/.test(key)) map[k] = "difficulty";
    else if (/^(totaltime|totaltimeinseconds|totaltimeseconds|totaltime_seconds|totaltimesecond|totalseconds|timeinseconds)$/.test(key)) map[k] = "total_time_seconds";
    else if (/^(questionscore|score|correct)$/.test(key)) map[k] = "question_score";
    else if (/^(flag|flagged)$/.test(key)) map[k] = "flagged";
    else if (/^(experimental|experimentalsection|experimental_section)$/.test(key)) map[k] = "experimental_section";
    else if (/^(examdate|date)$/.test(key)) map[k] = "exam_date";
    else if (/^(scaledscore|scaled_score)$/.test(key)) map[k] = "scaled_score";
    else if (/^(sectiontype|sectype)$/.test(key)) map[k] = "section_type";
    else map[k] = k; // preserve unknowns
  }
  const out = {};
  for (const [oldK, newK] of Object.entries(map)) out[newK] = obj[oldK];
  return out;
};

// Infer section type from subtype list membership if absent
function inferSectionType(subtype) {
  if (!subtype) return "Unknown";
  if (LOGICAL_REASONING_SUBTYPES.includes(subtype)) return "Logical Reasoning";
  if (READING_COMP_SUBTYPES.includes(subtype)) return "Reading Comprehension";
  return "Unknown";
}

// Safe number parse
const toNum = (v, d = 0) => {
  if (v === undefined || v === null || v === "") return d;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : d;
};

// Boolean-ish parser
const toBool = (v) => {
  const s = String(v || "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
};

// Format seconds as mm:ss
const fmtMMSS = (sec) => {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

// Demo fallback (tiny)

export default function App() {
  const [userId, setUserId] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);

  // all data kept per-user in localStorage for this demo
  const [rawRows, setRawRows] = useState([]);
  const [metaRows, setMetaRows] = useState([]);

  // Backend endpoint that hosts your Python transformer
  const [transformerUrl, setTransformerUrl] = useState("");

  // Filters
  const [examFilter, setExamFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all"); // LR/RC/Unknown
  const [flagFilter, setFlagFilter] = useState("all"); // all/flagged/unflagged
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // --- AUTH (demo) ---
  useEffect(() => {
    // try auto-load last user
    const last = localStorage.getItem("lsat_user_last");
    if (last) {
      setUserId(last);
      setIsAuthed(true);
    }
  }, []);

  const signIn = () => {
    if (!userId.trim()) { alert("Enter an email or username to sign in."); return; }
    localStorage.setItem("lsat_user_last", userId.trim());
    setIsAuthed(true);
    loadFromStorage(userId.trim());
  };
  const signOut = () => {
    setIsAuthed(false);
    setUserId("");
    setRawRows([]);
    setMetaRows([]);
  };

  // --- PERSISTENCE ---
  const storageKey = (uid) => `lsat_data_${uid}`;
  const loadFromStorage = (uid) => {
    const blob = localStorage.getItem(storageKey(uid));
    if (!blob) { setRawRows([]); setMetaRows([]); return; }
    try {
      const parsed = JSON.parse(blob);
      setRawRows(parsed.rawRows || []);
      setMetaRows(parsed.metaRows || []);
    } catch (e) {
      console.error("Bad storage payload", e);
    }
  };
  const saveToStorage = (uid, raw, meta) => {
    localStorage.setItem(storageKey(uid), JSON.stringify({ rawRows: raw, metaRows: meta }));
  };

  // Minimal CSV parser and helpers are defined above

  // Parse + normalize uploaded CSVs (manual upload still supported for debugging)
  const onUploadRows = async (file) => {
    const text = await file.text();
    const parsed = parseCSV(text).map(headerMap).map((r) => ({
      exam_number: String(r.exam_number ?? r.exam ?? "").trim(),
      section: String(r.section ?? "").trim(),
      question: String(r.question ?? "").trim(),
      subtype: (r.subtype ?? "").trim(),
      difficulty: String(r.difficulty ?? "").replace(/[^0-9-]/g, ""),
      total_time_seconds: toNum(r.total_time_seconds ?? r.total_time ?? r.time_seconds ?? r.seconds, 0),
      question_score: toNum(r.question_score, 0),
      flagged: toBool(r.flagged),
      experimental_section: toBool(r.experimental_section),
      section_type: r.section_type || inferSectionType((r.subtype || "").trim()),
    }));
    const next = mergeRows(rawRows, parsed);
    setRawRows(next);
    if (isAuthed) saveToStorage(userId, next, metaRows);
  };

  const onUploadMeta = async (file) => {
    const text = await file.text();
    const parsed = parseCSV(text).map(headerMap).map((r) => ({
      exam_number: String(r.exam_number ?? r.exam ?? "").trim(),
      exam_date: String(r.exam_date ?? r.date ?? "").trim(),
      scaled_score: toNum(r.scaled_score ?? r.score, null),
    }));
    const next = mergeMeta(metaRows, parsed);
    setMetaRows(next);
    if (isAuthed) saveToStorage(userId, rawRows, next);
  };

  // --- TRANSFORM & UPLOAD TEST (PDF → 2 CSVs → append) ---
  const onUploadPdf = async (file) => {
    if (!transformerUrl) { alert("Add your transformer URL first."); return; }
    if (!isAuthed) { alert("Sign in first."); return; }
    try {
      const fd = new FormData();
      fd.append("file", file);
      // The backend should return JSON with two text payloads or two files. We support both.
      const res = await fetch(transformerUrl, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Transformer error ${res.status}`);
      const contentType = res.headers.get("content-type") || "";
      let allCsv = "", metaCsv = "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        allCsv = json.all_sections_csv || json.all_sections_clean_scored || "";
        metaCsv = json.exam_metadata_csv || json.exam_metadata || "";
      } else if (contentType.includes("text/csv") || contentType.includes("multipart")) {
        // If backend streams a multipart or single CSV, adjust as needed
        const text = await res.text();
        // naive split fallback: expect two CSVs separated by a marker
        const parts = text.split("
---META---
");
        allCsv = parts[0] || "";
        metaCsv = parts[1] || "";
      } else {
        // try to parse as blob->text
        const text = await res.text();
        const parts = text.split("
---META---
");
        allCsv = parts[0] || text;
        metaCsv = parts[1] || "";
      }
      if (!allCsv.trim() || !metaCsv.trim()) {
        alert("Transformer response missing one of the CSVs.");
        return;
      }
      // parse and append
      const parsedRows = parseCSV(allCsv).map(headerMap).map((r) => ({
        exam_number: String(r.exam_number ?? r.exam ?? "").trim(),
        section: String(r.section ?? "").trim(),
        question: String(r.question ?? "").trim(),
        subtype: (r.subtype ?? "").trim(),
        difficulty: String(r.difficulty ?? "").replace(/[^0-9-]/g, ""),
        total_time_seconds: toNum(r.total_time_seconds ?? r.total_time ?? r.time_seconds ?? r.seconds, 0),
        question_score: toNum(r.question_score, 0),
        flagged: toBool(r.flagged),
        experimental_section: toBool(r.experimental_section),
        section_type: r.section_type || inferSectionType((r.subtype || "").trim()),
      }));
      const parsedMeta = parseCSV(metaCsv).map(headerMap).map((r) => ({
        exam_number: String(r.exam_number ?? r.exam ?? "").trim(),
        exam_date: String(r.exam_date ?? r.date ?? "").trim(),
        scaled_score: toNum(r.scaled_score ?? r.score, null),
      }));
      const nextRows = mergeRows(rawRows, parsedRows);
      const nextMeta = mergeMeta(metaRows, parsedMeta);
      setRawRows(nextRows);
      setMetaRows(nextMeta);
      saveToStorage(userId, nextRows, nextMeta);
      alert("Test transformed and uploaded.");
    } catch (e) {
      console.error(e);
      alert("Failed to transform this PDF. Check console and backend.");
    }
  };

  // Mergers with de-duplication
  const mergeRows = (base, incoming) => {
    const key = (r) => `${r.exam_number}|${r.section}|${r.question}`;
    const map = new Map(base.map(r => [key(r), r]));
    for (const r of incoming) map.set(key(r), r);
    return Array.from(map.values());
  };
  const mergeMeta = (base, incoming) => {
    const map = new Map(base.map(m => [String(m.exam_number), m]));
    for (const m of incoming) map.set(String(m.exam_number), m);
    return Array.from(map.values());
  };

  // Derived: join rows with metadata, apply filters
  const rows = useMemo(() => {
    const metaByExam = new Map(metaRows.map(m => [m.exam_number, m]));
    const enrich = (r) => ({
      ...r,
      section_type: r.section_type || inferSectionType(r.subtype),
      exam_date: metaByExam.get(r.exam_number)?.exam_date || "",
      scaled_score: metaByExam.get(r.exam_number)?.scaled_score ?? null,
    });
    let out = rawRows.map(enrich);
    const metas = metaRows;

    // Filters
    if (examFilter !== "all") out = out.filter(r => String(r.exam_number) === String(examFilter));
    if (sectionFilter !== "all") out = out.filter(r => r.section_type === sectionFilter);
    if (flagFilter === "flagged") out = out.filter(r => !!r.flagged);
    if (flagFilter === "unflagged") out = out.filter(r => !r.flagged);
    const fromOk = dateFrom ? new Date(dateFrom) : null;
    const toOk = dateTo ? new Date(dateTo) : null;
    if (fromOk) out = out.filter(r => r.exam_date && new Date(r.exam_date) >= fromOk);
    if (toOk) out = out.filter(r => r.exam_date && new Date(r.exam_date) <= toOk);

    return { rows: out, metas };
  }, [rawRows, metaRows, examFilter, sectionFilter, flagFilter, dateFrom, dateTo]);

  // KPI helpers
  const kpis = useMemo(() => {
    const arr = rows.rows;
    const attempted = arr.length;
    const correct = arr.reduce((s, r) => s + (r.question_score ? 1 : 0), 0);
    const accuracy = attempted ? (100 * correct / attempted) : 0;
    const avgSec = attempted ? (arr.reduce((s, r) => s + toNum(r.total_time_seconds), 0) / attempted) : 0;
    const flagged = arr.filter(r => r.flagged).length;
    const scaledAvg = (() => {
      const vals = rows.metas.map(m => toNum(m.scaled_score, NaN)).filter(Number.isFinite);
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    })();
    return { attempted, correct, accuracy, avgSec, flagged, scaledAvg };
  }, [rows]);

  // Accuracy by section type
  const bySectionType = useMemo(() => {
    const sectionTypes = ["Logical Reasoning", "Reading Comprehension", "Unknown"];
    return sectionTypes.map(st => {
      const subset = rows.rows.filter(r => r.section_type === st);
      const attempted = subset.length || 0;
      const correct = subset.reduce((s, r) => s + (r.question_score ? 1 : 0), 0);
      const accuracy = attempted ? Math.round((100 * correct) / attempted) : 0;
      return { section_type: st, attempted, correct, accuracy };
    });
  }, [rows]);

  // Accuracy by subtype – include missing subtypes from fixed lists
  const bySubtype = useMemo(() => {
    const targetSubtypes = Array.from(new Set([...LOGICAL_REASONING_SUBTYPES, ...READING_COMP_SUBTYPES]));
    const map = new Map();
    for (const t of targetSubtypes) map.set(t, { subtype: t, attempted: 0, correct: 0, avgSec: 0 });
    for (const r of rows.rows) {
      const key = map.has(r.subtype) ? r.subtype : r.subtype || "(Other)";
      if (!map.has(key)) map.set(key, { subtype: key, attempted: 0, correct: 0, avgSec: 0 });
      const obj = map.get(key);
      obj.attempted++;
      obj.correct += r.question_score ? 1 : 0;
      obj.avgSec += toNum(r.total_time_seconds);
    }
    const out = Array.from(map.values()).map(o => ({
      ...o,
      accuracy: o.attempted ? Math.round((100 * o.correct) / o.attempted) : 0,
      avgSec: o.attempted ? Math.round(o.avgSec / o.attempted) : 0,
      section_type: LOGICAL_REASONING_SUBTYPES.includes(o.subtype) ? "Logical Reasoning" : (READING_COMP_SUBTYPES.includes(o.subtype) ? "Reading Comprehension" : "Unknown"),
    }));
    out.sort((a, b) => a.accuracy - b.accuracy || b.attempted - a.attempted);
    return out;
  }, [rows]);

  const trendByExam = useMemo(() => {
    const groups = new Map();
    for (const r of rows.rows) {
      const k = String(r.exam_number);
      if (!groups.has(k)) groups.set(k, { exam_number: k, attempted: 0, correct: 0, exam_date: r.exam_date || "" });
      const g = groups.get(k);
      g.attempted++; g.correct += r.question_score ? 1 : 0;
    }
    for (const m of rows.metas) {
      const k = String(m.exam_number);
      if (!groups.has(k)) groups.set(k, { exam_number: k, attempted: 0, correct: 0, exam_date: m.exam_date || "" });
      groups.get(k).scaled_score = toNum(m.scaled_score, null);
      if (!groups.get(k).exam_date) groups.get(k).exam_date = m.exam_date || "";
    }
    const out = Array.from(groups.values()).map(g => ({
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
    const header = ["exam_number","section","question","section_type","subtype","difficulty","total_time_seconds","question_score","flagged","experimental_section","exam_date","scaled_score"];
    const lines = [header.join(",")];
    for (const r of rows.rows) {
      const vals = header.map(h => r[h] ?? "");
      lines.push(vals.map(v => typeof v === 'string' && v.includes(',') ? `"${v.replaceAll('"','""')}"` : v).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `lsat_filtered_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const chartColors = ["#0ea5e9", "#10b981", "#f97316", "#a78bfa", "#f43f5e", "#14b8a6", "#eab308", "#64748b"]; 

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Layers3 className="w-6 h-6" />
          <h1 className="text-xl font-semibold">LSAT Tracker</h1>
          <span className="text-slate-500 text-sm">— sign in, transform & upload each test PDF</span>
          <div className="ml-auto flex items-center gap-2">
            {!isAuthed ? (
              <>
                <input value={userId} onChange={e=>setUserId(e.target.value)} placeholder="email or username" className="px-3 py-1.5 rounded-xl border text-sm"/>
                <button onClick={signIn} className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-sm">Sign in</button>
              </>
            ) : (
              <>
                <span className="text-sm text-slate-600">{userId}</span>
                <button onClick={signOut} className="px-3 py-1.5 rounded-xl border text-sm">Sign out</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 py-4 grid md:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Upload className="w-4 h-4"/> Data Input</h2>
          <div className="grid gap-3">
            <div className="grid md:grid-cols-3 gap-2">
              <input value={transformerUrl} onChange={e=>setTransformerUrl(e.target.value)} placeholder="https://api.yourdomain/transform" className="md:col-span-2 px-3 py-2 rounded-xl border text-sm"/>
              <label className={`inline-flex items-center justify-center px-3 py-2 rounded-xl ${isAuthed? 'bg-slate-900 text-white cursor-pointer':'bg-slate-200 text-slate-500 cursor-not-allowed'}`}>
                <input type="file" accept="application/pdf" className="hidden" disabled={!isAuthed} onChange={(e)=>{
                  const f = e.target.files?.[0]; if (f) onUploadPdf(f);
                }}/>
                Transform & Upload Test
              </label>
            </div>
            <details className="text-sm text-slate-600">
              <summary className="cursor-pointer">Debug: upload CSVs directly</summary>
              <div className="grid sm:grid-cols-2 gap-3 mt-2">
                <label className="block">
                  <span className="text-sm text-slate-600">all_sections_clean_scored.csv</span>
                  <input type="file" accept=".csv" className="mt-1 block w-full text-sm" onChange={(e) => e.target.files?.[0] && onUploadRows(e.target.files[0])} />
                </label>
                <label className="block">
                  <span className="text-sm text-slate-600">exam_metadata.csv</span>
                  <input type="file" accept=".csv" className="mt-1 block w-full text-sm" onChange={(e) => e.target.files?.[0] && onUploadMeta(e.target.files[0])} />
                </label>
              </div>
            </details>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Filter className="w-4 h-4"/> Filters</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-600">Exam</label>
              <select value={examFilter} onChange={e=>setExamFilter(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border">
                <option value="all">All</option>
                {Array.from(new Set(rawRows.map(r=>String(r.exam_number)))).map(ex => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-600">Section type</label>
              <select value={sectionFilter} onChange={e=>setSectionFilter(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border">
                <option value="all">All</option>
                <option>Logical Reasoning</option>
                <option>Reading Comprehension</option>
                <option>Unknown</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-600">Flagged</label>
              <select value={flagFilter} onChange={e=>setFlagFilter(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border">
                <option value="all">All</option>
                <option value="flagged">Only flagged</option>
                <option value="unflagged">Only un-flagged</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm text-slate-600">From</label>
                <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border"/>
              </div>
              <div>
                <label className="text-sm text-slate-600">To</label>
                <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border"/>
              </div>
            </div>
            <button onClick={downloadCSV} className="col-span-full inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-slate-50">
              <FileDown className="w-4 h-4"/> Export filtered CSV
            </button>
          </div>
        </section>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-2">{rawRows.length===0 ? (<div className="bg-white rounded-2xl shadow p-6 text-center"><h2 className="text-lg font-semibold">No data yet</h2><p className="text-slate-600 mt-1">Sign in, add your Transformer URL, then click <em>Transform & Upload Test</em> to add your first exam.</p></div>) : null}</div>

{/* KPIs */}
      <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-5 gap-4">
        <KpiCard title="Questions" value={kpis.attempted} icon={<Database className="w-5 h-5"/>} />
        <KpiCard title="Correct" value={kpis.correct} icon={<CheckCircle2 className="w-5 h-5"/>} />
        <KpiCard title="Accuracy" value={`${Math.round(kpis.accuracy)}%`} icon={<XCircle className="w-5 h-5"/>} />
        <KpiCard title="Avg time" value={fmtMMSS(kpis.avgSec)} icon={<Clock className="w-5 h-5"/>} />
        <KpiCard title="Flagged" value={kpis.flagged} icon={<Flag className="w-5 h-5"/>} />
      </div>

      {/* Charts grid (unchanged) */}
      <div className="max-w-7xl mx-auto px-4 py-4 grid lg:grid-cols-2 gap-4">
        <Card title="Accuracy by Section Type">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={bySectionType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="section_type" />
              <YAxis unit="%" />
              <Tooltip />
              <Bar dataKey="accuracy" fill={chartColors[0]} />
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
              <Line yAxisId="left" type="monotone" dataKey="accuracy" name="Accuracy %" stroke={chartColors[1]} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="scaled_score" name="Scaled" stroke={chartColors[2]} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Subtype Weaknesses & Strengths (Accuracy; avg time labels)">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={bySubtype.slice(0, 15)} layout="vertical" margin={{ left: 140 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} unit="%" />
              <YAxis type="category" dataKey="subtype" width={140} />
              <Tooltip formatter={(v, name, p) => name === 'accuracy' ? `${v}%` : v} labelFormatter={(l) => l} />
              <Bar dataKey="accuracy">
                {bySubtype.slice(0, 15).map((_, idx) => (
                  <Cell key={idx} fill={chartColors[idx % chartColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 mt-2">Sorted by lowest accuracy first. Consider drilling these first. Hover for details; aim to reduce avg time while raising accuracy.</p>
        </Card>

        <Card title="Subtype Balance (Radar – attempts share)">
          <ResponsiveContainer width="100%" height={360}>
            <RadarChart data={bySubtype.filter(s=>s.attempted>0).slice(0,12)}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subtype" />
              <PolarRadiusAxis />
              <Radar name="Attempts" dataKey="attempted" stroke={chartColors[0]} fill={chartColors[0]} fillOpacity={0.4} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Flagged vs Un‑flagged">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie dataKey="value" data={[
                { name: "Flagged", value: rows.rows.filter(r=>r.flagged).length },
                { name: "Un‑flagged", value: rows.rows.filter(r=>!r.flagged).length },
              ]} outerRadius={100} label>
                <Cell fill={chartColors[4]} />
                <Cell fill={chartColors[5]} />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Average Time by Subtype (mm:ss)">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={bySubtype.slice(0, 12)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="subtype" interval={0} angle={-20} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip formatter={(v) => fmtMMSS(v)} />
              <Bar dataKey="avgSec">
                {bySubtype.slice(0,12).map((_, idx) => <Cell key={idx} fill={chartColors[(idx+2)%chartColors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Help / About */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-2">How it works now</h2>
          <ul className="list-disc ml-5 text-sm text-slate-700 space-y-1">
            <li><strong>Sign in</strong> with an email/username (demo auth). Your data saves locally per user.</li>
            <li>Paste your <strong>Transformer URL</strong> (backend running your Python script).</li>
            <li>Click <strong>Transform & Upload Test</strong>, pick a PDF. The app calls your endpoint, parses the two CSVs, and <strong>appends</strong> to your history with de‑duplication.</li>
            <li>Use filters and charts to analyze strengths/weaknesses by section and subtype (LR & RC fixed lists baked in).</li>
          </ul>
          <p className="text-sm text-slate-600 mt-3">To go production: replace demo auth with Supabase/Firebase Auth and store rows/meta in a hosted DB. Swap localStorage saves with API calls.</p>
        </div>
        <footer className="text-center text-xs text-slate-500 mt-6 pb-8">© {new Date().getFullYear()} LSAT Tracker – multi‑exam, per‑user uploads with PDF transformer.</footer>
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
        <div className="text-lg font-semibold">{value ?? '—'}</div>
      </div>
    </div>
  );
}

