import { flattenExams } from "./analytics.js";

export const BACKUP_FORMAT = "lsat-tracker-backup";
export const BACKUP_VERSION = 1;
export const MAX_EXAM_NUMBER_LENGTH = 40;
export const SCALED_SCORE_MIN = 120;
export const SCALED_SCORE_MAX = 180;
export const EXAM_SOURCES = ["upload", "sample", "import"];

export class BackupError extends Error {
  constructor(message) {
    super(message);
    this.name = "BackupError";
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Returns a user-facing problem with an exam number, or null when it is valid. */
export function examNumberProblem(value) {
  const text = String(value ?? "").trim();
  if (!text) return "Exam number is required.";
  if (text.length > MAX_EXAM_NUMBER_LENGTH) {
    return `Exam number must be at most ${MAX_EXAM_NUMBER_LENGTH} characters.`;
  }
  return null;
}

export function isValidScaledScore(value) {
  return Number.isInteger(value) && value >= SCALED_SCORE_MIN && value <= SCALED_SCORE_MAX;
}

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

function fail(path, message) {
  throw new BackupError(`${path} ${message}`);
}

function readInteger(value, path, { min, max, nullable = false }) {
  if (value === null || value === undefined) {
    if (nullable) return null;
    fail(path, "is required.");
  }
  if (!Number.isInteger(value) || value < min || (max !== undefined && value > max)) {
    fail(path, max === undefined ? `must be a whole number of at least ${min}.` : `must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

function readBoolean(value, path) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  return fail(path, "must be true or false.");
}

function readText(value, path, { maxLength, nullable = false }) {
  if (value === null || value === undefined || value === "") {
    if (nullable) return null;
    fail(path, "is required.");
  }
  if (typeof value !== "string" || value.length > maxLength) {
    fail(path, `must be text of at most ${maxLength} characters.`);
  }
  return value;
}

function readQuestion(raw, path) {
  if (!isObject(raw)) fail(path, "must be an object.");
  const seconds = raw.total_time_seconds;
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    fail(`${path}.total_time_seconds`, "must be a number of seconds, 0 or more.");
  }
  return {
    section: readInteger(raw.section, `${path}.section`, { min: 1 }),
    question: readInteger(raw.question, `${path}.question`, { min: 1 }),
    subtype: readText(raw.subtype, `${path}.subtype`, { maxLength: 120 }).trim(),
    difficulty: readInteger(raw.difficulty, `${path}.difficulty`, { min: 1, max: 5, nullable: true }),
    total_time_seconds: seconds,
    question_score: readBoolean(raw.question_score, `${path}.question_score`) ? 1 : 0,
    flagged: readBoolean(raw.flagged, `${path}.flagged`),
    experimental_section: readBoolean(raw.experimental_section, `${path}.experimental_section`),
  };
}

/** Validates one stored exam and returns a normalized copy. Throws BackupError. */
export function validateExam(raw, path = "exam", { now = new Date() } = {}) {
  if (!isObject(raw)) fail(path, "must be an object.");

  const examNumber =
    typeof raw.exam_number === "number" ? String(raw.exam_number) : raw.exam_number;
  if (typeof examNumber !== "string") fail(`${path}.exam_number`, "is required.");
  const numberProblem = examNumberProblem(examNumber);
  if (numberProblem) fail(`${path}.exam_number`, `is invalid: ${numberProblem}`);

  if (raw.exam_date != null && !isValidIsoDate(raw.exam_date)) {
    fail(`${path}.exam_date`, "must be a date in YYYY-MM-DD format.");
  }
  if (raw.scaled_score != null && !isValidScaledScore(raw.scaled_score)) {
    fail(`${path}.scaled_score`, `must be a whole number from ${SCALED_SCORE_MIN} to ${SCALED_SCORE_MAX}.`);
  }
  if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
    fail(`${path}.questions`, "must be a non-empty list.");
  }

  const addedAt = typeof raw.added_at === "string" && !Number.isNaN(Date.parse(raw.added_at));
  return {
    exam_number: examNumber.trim(),
    exam_date: raw.exam_date ?? null,
    scaled_score: raw.scaled_score ?? null,
    source: EXAM_SOURCES.includes(raw.source) ? raw.source : "import",
    file_name: readText(raw.file_name, `${path}.file_name`, { maxLength: 255, nullable: true }),
    added_at: addedAt ? raw.added_at : now.toISOString(),
    questions: raw.questions.map((q, i) => readQuestion(q, `${path}.questions[${i}]`)),
  };
}

export function createBackup(exams, now = new Date()) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: now.toISOString(),
    exams: exams.map((exam) => ({
      exam_number: exam.exam_number,
      exam_date: exam.exam_date ?? null,
      scaled_score: exam.scaled_score ?? null,
      source: exam.source,
      file_name: exam.file_name ?? null,
      added_at: exam.added_at,
      questions: exam.questions.map((q) => ({
        section: q.section,
        question: q.question,
        subtype: q.subtype,
        difficulty: q.difficulty ?? null,
        total_time_seconds: q.total_time_seconds,
        question_score: q.question_score,
        flagged: q.flagged,
        experimental_section: q.experimental_section,
      })),
    })),
  };
}

/** Validates a parsed backup object and returns its exams. Throws BackupError. */
export function validateBackup(data, options) {
  if (!isObject(data) || data.format !== BACKUP_FORMAT) {
    throw new BackupError("This file is not an LSAT Tracker backup.");
  }
  if (data.version !== BACKUP_VERSION) {
    throw new BackupError(
      `Backup version ${JSON.stringify(data.version)} is not supported. This version of the app reads version ${BACKUP_VERSION}.`,
    );
  }
  if (!Array.isArray(data.exams)) fail("exams", "must be a list.");

  const seen = new Set();
  return data.exams.map((raw, i) => {
    const exam = validateExam(raw, `exams[${i}]`, options);
    if (seen.has(exam.exam_number)) {
      fail(`exams[${i}].exam_number`, `"${exam.exam_number}" appears more than once.`);
    }
    seen.add(exam.exam_number);
    return exam;
  });
}

export function parseBackup(text, options) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("This file is not valid JSON.");
  }
  return validateBackup(data, options);
}

export const CSV_COLUMNS = [
  "exam_number",
  "exam_date",
  "scaled_score",
  "section",
  "question",
  "section_type",
  "subtype",
  "difficulty",
  "total_time_seconds",
  "question_score",
  "flagged",
  "experimental_section",
];

function csvCell(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Spreadsheet apps execute cells that start with these characters as formulas.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToCsv(rows, columns = CSV_COLUMNS) {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvCell(row[column])).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

export function examsToCsv(exams) {
  return rowsToCsv(flattenExams(exams));
}
