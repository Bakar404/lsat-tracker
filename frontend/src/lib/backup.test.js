import { describe, expect, it } from "vitest";
import {
  BackupError,
  createBackup,
  examsToCsv,
  isValidIsoDate,
  parseBackup,
  rowsToCsv,
  validateBackup,
} from "./backup.js";

const NOW = new Date("2026-10-18T12:00:00Z");

const exam = {
  exam_number: "141",
  exam_date: "2026-10-03",
  scaled_score: 163,
  source: "upload",
  file_name: "PrepTest 141.pdf",
  added_at: "2026-10-04T09:30:00.000Z",
  questions: [
    {
      section: 1,
      question: 1,
      subtype: "Flaws",
      difficulty: 2,
      total_time_seconds: 75,
      question_score: 1,
      flagged: false,
      experimental_section: false,
    },
  ],
};

const backupWith = (overrides) => ({
  ...createBackup([exam], NOW),
  ...overrides,
});

const examWith = (overrides) => backupWith({ exams: [{ ...exam, ...overrides }] });

const questionWith = (overrides) =>
  examWith({ questions: [{ ...exam.questions[0], ...overrides }] });

describe("backup round trip", () => {
  it("restores exactly what was exported", () => {
    const text = JSON.stringify(createBackup([exam], NOW));
    expect(parseBackup(text)).toEqual([exam]);
    expect(JSON.parse(text)).toMatchObject({
      format: "lsat-tracker-backup",
      version: 1,
      exported_at: "2026-10-18T12:00:00.000Z",
    });
  });

  it("accepts numeric exam numbers and 0/1 booleans from hand-edited files", () => {
    const [restored] = validateBackup(
      examWith({
        exam_number: 141,
        questions: [{ ...exam.questions[0], question_score: true, flagged: 1 }],
      }),
    );
    expect(restored.exam_number).toBe("141");
    expect(restored.questions[0]).toMatchObject({ question_score: 1, flagged: true });
  });

  it("fills in a missing source and timestamp", () => {
    const [restored] = validateBackup(examWith({ source: "elsewhere", added_at: undefined }), {
      now: NOW,
    });
    expect(restored).toMatchObject({ source: "import", added_at: NOW.toISOString() });
  });
});

describe("backup validation", () => {
  const rejects = (input, message) => {
    const run = () => (typeof input === "string" ? parseBackup(input) : validateBackup(input));
    expect(run).toThrow(BackupError);
    expect(run).toThrow(message);
  };

  it("rejects files that are not backups", () => {
    rejects("{not json", "not valid JSON");
    rejects({ exams: [] }, "not an LSAT Tracker backup");
    rejects(backupWith({ version: 2 }), "Backup version 2 is not supported");
    rejects(backupWith({ exams: {} }), "exams must be a list");
  });

  it("points at the invalid field", () => {
    rejects(examWith({ exam_number: " " }), "exams[0].exam_number is invalid");
    rejects(examWith({ exam_date: "2026-02-30" }), "exams[0].exam_date must be a date");
    rejects(examWith({ scaled_score: 181 }), "exams[0].scaled_score must be a whole number");
    rejects(examWith({ questions: [] }), "exams[0].questions must be a non-empty list");
    rejects(questionWith({ section: 0 }), "exams[0].questions[0].section must be a whole number");
    rejects(questionWith({ question_score: 2 }), "exams[0].questions[0].question_score must be");
    rejects(questionWith({ total_time_seconds: -1 }), "total_time_seconds must be a number");
  });

  it("rejects duplicate exam numbers", () => {
    rejects(backupWith({ exams: [exam, { ...exam }] }), 'exams[1].exam_number "141" appears');
  });

  it("validates calendar dates", () => {
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("10/03/2026")).toBe(false);
  });
});

describe("CSV export", () => {
  it("writes a header and one row per question", () => {
    const lines = examsToCsv([exam]).trimEnd().split("\r\n");
    expect(lines).toEqual([
      "exam_number,exam_date,scaled_score,section,question,section_type,subtype,difficulty,total_time_seconds,question_score,flagged,experimental_section",
      "141,2026-10-03,163,1,1,Logical Reasoning,Flaws,2,75,1,false,false",
    ]);
  });

  it("quotes special characters and neutralizes spreadsheet formulas", () => {
    const csv = rowsToCsv(
      [{ a: 'He said "hi", twice', b: "=HYPERLINK(1)", c: null, d: -3 }],
      ["a", "b", "c", "d"],
    );
    expect(csv).toBe('a,b,c,d\r\n"He said ""hi"", twice",\'=HYPERLINK(1),,-3\r\n');
  });
});
