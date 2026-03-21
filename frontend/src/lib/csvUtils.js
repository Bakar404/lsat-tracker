/**
 * Shared CSV parsing and data transformation utilities
 */

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

/**
 * Parse CSV text into array of objects
 * Handles quoted fields and proper line breaks
 */
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
      Object.fromEntries(header.map((h, idx) => [h, (r[idx] ?? "").trim()])),
    );
}

/**
 * Map CSV column names to standardized field names
 */
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
        key,
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
    else map[k] = k;
  }
  const out = {};
  for (const [oldK, newK] of Object.entries(map)) out[newK] = obj[oldK];
  return out;
};

/**
 * Get transformer URL (backend endpoint)
 */
export const DEFAULT_TRANSFORMER =
  import.meta.env.VITE_TRANSFORMER_URL ||
  (window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000/transform"
    : "https://lsat-tracker.onrender.com/transform");

export const ROWS_TABLE = "lsat_rows";
export const META_TABLE = "lsat_meta";
