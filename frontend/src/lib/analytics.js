import { compareNatural } from "./format.js";
import {
  LOGICAL_REASONING,
  READING_COMPREHENSION,
  UNKNOWN_SECTION_TYPE,
  inferSectionType,
} from "./subtypes.js";

export const FLAG_OPTIONS = ["Flagged", "Not Flagged"];
export const SECTION_STATUS_OPTIONS = ["Scored", "Experimental"];

export const EMPTY_FILTERS = Object.freeze({
  exams: [],
  sections: [],
  sectionTypes: [],
  subtypes: [],
  flags: [],
  status: [],
  dateFrom: "",
  dateTo: "",
});

/** Chronological order: dated exams first, oldest to newest, then by natural exam number. */
export function compareExams(a, b) {
  if (Boolean(a.exam_date) !== Boolean(b.exam_date)) return a.exam_date ? -1 : 1;
  if (a.exam_date !== b.exam_date) return a.exam_date < b.exam_date ? -1 : 1;
  return compareNatural(a.exam_number, b.exam_number);
}

/** One row per question, with the exam-level fields the dashboard filters and groups by. */
export function flattenExams(exams) {
  const rows = [];
  for (const exam of exams) {
    for (const q of exam.questions) {
      rows.push({
        exam_number: exam.exam_number,
        exam_date: exam.exam_date ?? null,
        scaled_score: exam.scaled_score ?? null,
        section: q.section,
        question: q.question,
        section_type: inferSectionType(q.subtype),
        subtype: q.subtype,
        difficulty: q.difficulty ?? null,
        total_time_seconds: q.total_time_seconds,
        question_score: q.question_score,
        flagged: q.flagged,
        experimental_section: q.experimental_section,
      });
    }
  }
  return rows;
}

function unique(rows, key) {
  const values = new Set();
  for (const row of rows) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") values.add(value);
  }
  return [...values];
}

export function filterOptions(rows) {
  return {
    exams: unique(rows, "exam_number").sort(compareNatural),
    sections: unique(rows, "section").sort((a, b) => a - b),
    sectionTypes: unique(rows, "section_type").sort(compareNatural),
    subtypes: unique(rows, "subtype").sort(compareNatural),
  };
}

/** Within a filter, selected values are OR-ed; across filters they are AND-ed. */
export function applyFilters(rows, filters) {
  const f = { ...EMPTY_FILTERS, ...filters };
  const exams = new Set(f.exams);
  const sections = new Set(f.sections);
  const sectionTypes = new Set(f.sectionTypes);
  const subtypes = new Set(f.subtypes);
  const wantFlagged = f.flags.includes("Flagged");
  const wantUnflagged = f.flags.includes("Not Flagged");
  const wantExperimental = f.status.includes("Experimental");
  const wantScored = f.status.includes("Scored");

  return rows.filter((r) => {
    if (exams.size && !exams.has(r.exam_number)) return false;
    if (sections.size && !sections.has(r.section)) return false;
    if (sectionTypes.size && !sectionTypes.has(r.section_type)) return false;
    if (subtypes.size && !subtypes.has(r.subtype)) return false;
    if (wantFlagged !== wantUnflagged && Boolean(r.flagged) !== wantFlagged) return false;
    if (wantScored !== wantExperimental && Boolean(r.experimental_section) !== wantExperimental) {
      return false;
    }
    if (f.dateFrom && (!r.exam_date || r.exam_date < f.dateFrom)) return false;
    if (f.dateTo && (!r.exam_date || r.exam_date > f.dateTo)) return false;
    return true;
  });
}

export function countActiveFilters(filters) {
  return Object.values({ ...EMPTY_FILTERS, ...filters }).filter((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value),
  ).length;
}

const percent = (correct, attempted) => (attempted ? Math.round((100 * correct) / attempted) : null);

function groupStats(rows, keyOf) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    let group = groups.get(key);
    if (!group) {
      group = { attempted: 0, correct: 0, seconds: 0, flagged: 0 };
      groups.set(key, group);
    }
    group.attempted += 1;
    group.correct += row.question_score ? 1 : 0;
    group.seconds += Number(row.total_time_seconds) || 0;
    group.flagged += row.flagged ? 1 : 0;
  }
  return groups;
}

function summarize(group = { attempted: 0, correct: 0, seconds: 0, flagged: 0 }) {
  return {
    attempted: group.attempted,
    correct: group.correct,
    flagged: group.flagged,
    accuracy: percent(group.correct, group.attempted),
    avgSeconds: group.attempted ? Math.round(group.seconds / group.attempted) : null,
  };
}

export function computeKpis(rows) {
  const all = summarize(groupStats(rows, () => "all").get("all"));
  const scaledByExam = new Map();
  for (const row of rows) {
    if (Number.isFinite(row.scaled_score)) scaledByExam.set(row.exam_number, row.scaled_score);
  }
  const scaled = [...scaledByExam.values()];
  return {
    questions: all.attempted,
    correct: all.correct,
    accuracy: all.accuracy,
    avgSeconds: all.avgSeconds,
    flagged: all.flagged,
    exams: unique(rows, "exam_number").length,
    avgScaled: scaled.length ? Math.round(scaled.reduce((a, b) => a + b, 0) / scaled.length) : null,
  };
}

const SECTION_TYPE_ORDER = [LOGICAL_REASONING, READING_COMPREHENSION, UNKNOWN_SECTION_TYPE];

export function statsBySectionType(rows) {
  const groups = groupStats(rows, (r) => r.section_type);
  return SECTION_TYPE_ORDER.filter((type) => groups.has(type)).map((type) => ({
    section_type: type,
    ...summarize(groups.get(type)),
  }));
}

/** Weakest subtypes first; ties go to the subtype with more attempts. */
export function statsBySubtype(rows) {
  const groups = groupStats(rows, (r) => r.subtype || "Other");
  return [...groups]
    .map(([subtype, group]) => ({
      subtype,
      section_type: inferSectionType(subtype),
      ...summarize(group),
    }))
    .sort(
      (a, b) =>
        a.accuracy - b.accuracy ||
        b.attempted - a.attempted ||
        compareNatural(a.subtype, b.subtype),
    );
}

export function statsByDifficulty(rows) {
  const groups = groupStats(
    rows.filter((r) => Number.isFinite(r.difficulty)),
    (r) => r.difficulty,
  );
  return [...groups]
    .sort(([a], [b]) => a - b)
    .map(([difficulty, group]) => ({
      difficulty,
      label: `Level ${difficulty}`,
      ...summarize(group),
    }));
}

export function flagSummary(rows) {
  const groups = groupStats(rows, (r) => (r.flagged ? "flagged" : "unflagged"));
  return {
    flagged: summarize(groups.get("flagged")),
    unflagged: summarize(groups.get("unflagged")),
  };
}

/** Accuracy and scaled score per exam, in chronological order. */
export function trendByExam(rows) {
  const exams = new Map();
  for (const row of rows) {
    let exam = exams.get(row.exam_number);
    if (!exam) {
      exam = {
        exam_number: row.exam_number,
        exam_date: row.exam_date,
        scaled_score: row.scaled_score ?? null,
        attempted: 0,
        correct: 0,
      };
      exams.set(row.exam_number, exam);
    }
    exam.attempted += 1;
    exam.correct += row.question_score ? 1 : 0;
  }
  return [...exams.values()]
    .map((exam) => ({ ...exam, accuracy: percent(exam.correct, exam.attempted) }))
    .sort(compareExams);
}

export function summarizeExam(exam) {
  const stats = summarize(groupStats(exam.questions, () => "all").get("all"));
  const sections = new Set();
  const experimental = new Set();
  for (const q of exam.questions) {
    sections.add(q.section);
    if (q.experimental_section) experimental.add(q.section);
  }
  return {
    ...stats,
    questions: stats.attempted,
    sections: sections.size,
    experimentalSections: [...experimental].sort((a, b) => a - b),
  };
}
