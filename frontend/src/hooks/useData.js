import { useEffect, useMemo, useState } from "react";
import { supabase, TABLES, DEFAULT_TRANSFORMER } from "../lib/supabase";

/* ---- Fixed subtype lists ---- */
export const LOGICAL_REASONING_SUBTYPES = [
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
export const READING_COMP_SUBTYPES = [
  "Humanities passages",
  "Law passages",
  "Social science passages",
  "Science passages",
];

/* ---- CSV helpers ---- */
export function parseCSV(text) {
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
export const headerMap = (obj) => {
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
export const toNum = (v, d = 0) => {
  if (v === undefined || v === null || v === "") return d;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : d;
};
export const toBool = (v) => {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
};
export const inferSectionType = (subtype) => {
  if (!subtype) return "Unknown";
  if (LOGICAL_REASONING_SUBTYPES.includes(subtype)) return "Logical Reasoning";
  if (READING_COMP_SUBTYPES.includes(subtype)) return "Reading Comprehension";
  return "Unknown";
};
export const fmtMMSS = (sec) => {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

export function useData(user) {
  const [rawRows, setRawRows] = useState([]);
  const [metaRows, setMetaRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Updated filters to support multiple selections
  const [examFilter, setExamFilter] = useState([]);
  const [sectionFilter, setSectionFilter] = useState([]);
  const [sectionTypeFilter, setSectionTypeFilter] = useState([]);
  const [subtypeFilter, setSubtypeFilter] = useState([]);
  const [flagFilter, setFlagFilter] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const { data: rows, error: rErr } = await supabase
          .from(TABLES.rows)
          .select("*")
          .eq("user_id", user.id)
          .order("exam_number", { ascending: true })
          .order("section", { ascending: true })
          .order("question", { ascending: true });
        if (rErr) throw rErr;

        const { data: meta, error: mErr } = await supabase
          .from(TABLES.meta)
          .select("*")
          .eq("user_id", user.id)
          .order("exam_number", { ascending: true });
        if (mErr) throw mErr;

        setRawRows(rows || []);
        setMetaRows(meta || []);
      } catch (e) {
        console.error(e);
        alert("Failed to load your data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const joined = useMemo(() => {
    const metaByExam = new Map(metaRows.map((m) => [String(m.exam_number), m]));
    let out = rawRows.map((r) => ({
      ...r,
      section_type: r.section_type || inferSectionType(r.subtype),
      exam_date: metaByExam.get(String(r.exam_number))?.exam_date || "",
      scaled_score: metaByExam.get(String(r.exam_number))?.scaled_score ?? null,
    }));

    // Apply multiple exam filter
    if (examFilter.length > 0)
      out = out.filter((r) => examFilter.includes(String(r.exam_number)));

    // Apply multiple section filter
    if (sectionFilter.length > 0)
      out = out.filter((r) => sectionFilter.includes(r.section));

    // Apply multiple section type filter
    if (sectionTypeFilter.length > 0)
      out = out.filter((r) => sectionTypeFilter.includes(r.section_type));

    // Apply multiple subtype filter
    if (subtypeFilter.length > 0)
      out = out.filter((r) => subtypeFilter.includes(r.subtype));

    // Apply multiple flagged filter
    if (flagFilter.length > 0) {
      out = out.filter((r) => {
        if (
          flagFilter.includes("Flagged") &&
          flagFilter.includes("Not Flagged")
        ) {
          return true; // Show all if both are selected
        }
        if (flagFilter.includes("Flagged")) {
          return !!r.flagged;
        }
        if (flagFilter.includes("Not Flagged")) {
          return !r.flagged;
        }
        return true;
      });
    }

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
    sectionTypeFilter,
    subtypeFilter,
    flagFilter,
    dateFrom,
    dateTo,
  ]);

  const trendByExam = useMemo(() => {
    const groups = new Map();
    for (const r of joined.rows) {
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
    for (const m of joined.metas) {
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
      const nA = Number(a.exam_number),
        nB = Number(b.exam_number);
      if (Number.isFinite(nA) && Number.isFinite(nB)) return nA - nB;
      return String(a.exam_number).localeCompare(String(b.exam_number));
    });
    return out;
  }, [joined]);

  const kpis = useMemo(() => {
    const arr = joined.rows;
    const attempted = arr.length;
    const correct = arr.reduce((s, r) => s + (r.question_score ? 1 : 0), 0);
    const accuracy = attempted ? (100 * correct) / attempted : 0;
    const avgSec = attempted
      ? arr.reduce((s, r) => s + toNum(r.total_time_seconds), 0) / attempted
      : 0;
    const flagged = arr.filter((r) => r.flagged).length;
    const scaledAvg = (() => {
      const vals = joined.metas
        .map((m) => toNum(m.scaled_score, NaN))
        .filter(Number.isFinite);
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    })();
    return { attempted, correct, accuracy, avgSec, flagged, scaledAvg };
  }, [joined]);

  async function tryGetDetail(res) {
    try {
      const j = await res.clone().json();
      return j?.detail;
    } catch {
      return null;
    }
  }

  async function uploadPdfAndUpsert({
    file,
    examNumberOverride,
    examDateOverride,
    user,
  }) {
    const fd = new FormData();
    fd.append("file", file);
    if (examNumberOverride?.trim())
      fd.append("exam_number", examNumberOverride.trim());
    if (examDateOverride?.trim())
      fd.append("exam_date", examDateOverride.trim());

    const res = await fetch(DEFAULT_TRANSFORMER, { method: "POST", body: fd });
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

    // Parse
    const parsedRows = parseCSV(allCsv)
      .map(headerMap)
      .map((r) => ({
        exam_number: String(r.exam_number ?? r.exam ?? "").trim(),
        section: Number(String(r.section ?? "").replace(/[^0-9-]/g, "")),
        question: Number(String(r.question ?? "").replace(/[^0-9-]/g, "")),
        subtype: (r.subtype ?? "").trim(),
        difficulty:
          r.difficulty === ""
            ? null
            : Number(String(r.difficulty).replace(/[^0-9-]/g, "")),
        total_time_seconds: toNum(
          r.total_time_seconds ?? r.total_time ?? r.time_seconds ?? r.seconds,
          0
        ),
        question_score: toNum(r.question_score, 0),
        flagged: toBool(r.flagged),
        experimental_section: toBool(r.experimental_section),
      }));

    const parsedMeta = parseCSV(metaCsv)
      .map(headerMap)
      .map((r) => ({
        exam_number: String(r.exam_number ?? r.exam ?? "").trim(),
        exam_date: String(r.exam_date ?? r.date ?? "").trim(),
        scaled_score:
          r.scaled_score === "" ? null : toNum(r.scaled_score, null),
      }));

    // Upsert
    const rowsPayload = parsedRows.map((r) => ({ user_id: user.id, ...r }));
    const { error: upRowsErr } = await supabase
      .from(TABLES.rows)
      .upsert(rowsPayload, {
        onConflict: "user_id,exam_number,section,question",
      });
    if (upRowsErr) throw upRowsErr;

    const metaPayload = parsedMeta.map((m) => ({ user_id: user.id, ...m }));
    const { error: upMetaErr } = await supabase
      .from(TABLES.meta)
      .upsert(metaPayload, { onConflict: "user_id,exam_number" });
    if (upMetaErr) throw upMetaErr;

    // Refresh
    const [{ data: rowsAfter }, { data: metaAfter }] = await Promise.all([
      supabase.from(TABLES.rows).select("*").eq("user_id", user.id),
      supabase.from(TABLES.meta).select("*").eq("user_id", user.id),
    ]);
    setRawRows(rowsAfter || []);
    setMetaRows(metaAfter || []);
  }

  async function deleteTest(examNumber) {
    if (!user) return;

    try {
      setLoading(true);

      // Delete from both tables
      const [{ error: rowsError }, { error: metaError }] = await Promise.all([
        supabase
          .from(TABLES.rows)
          .delete()
          .eq("user_id", user.id)
          .eq("exam_number", examNumber),
        supabase
          .from(TABLES.meta)
          .delete()
          .eq("user_id", user.id)
          .eq("exam_number", examNumber),
      ]);

      if (rowsError) throw rowsError;
      if (metaError) throw metaError;

      // Refresh data
      const [{ data: rowsAfter }, { data: metaAfter }] = await Promise.all([
        supabase
          .from(TABLES.rows)
          .select("*")
          .eq("user_id", user.id)
          .order("exam_number", { ascending: true })
          .order("section", { ascending: true })
          .order("question", { ascending: true }),
        supabase
          .from(TABLES.meta)
          .select("*")
          .eq("user_id", user.id)
          .order("exam_number", { ascending: true }),
      ]);

      setRawRows(rowsAfter || []);
      setMetaRows(metaAfter || []);

      // Remove deleted exam from filters if it was selected
      if (examFilter.includes(String(examNumber))) {
        setExamFilter(examFilter.filter((e) => e !== String(examNumber)));
      }
    } catch (error) {
      console.error("Error deleting test:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    joined,
    kpis,
    trendByExam,
    examFilter,
    setExamFilter,
    sectionFilter,
    setSectionFilter,
    sectionTypeFilter,
    setSectionTypeFilter,
    subtypeFilter,
    setSubtypeFilter,
    flagFilter,
    setFlagFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    uploadPdfAndUpsert,
    deleteTest,
  };
}
