import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  applyFilters,
  computeKpis,
  countActiveFilters,
  filterOptions,
  flagSummary,
  flattenExams,
  statsByDifficulty,
  statsBySectionType,
  statsBySubtype,
  summarizeExam,
  trendByExam,
} from "./analytics.js";

const q = (section, question, subtype, overrides = {}) => ({
  section,
  question,
  subtype,
  difficulty: 3,
  total_time_seconds: 60,
  question_score: 1,
  flagged: false,
  experimental_section: false,
  ...overrides,
});

const exams = [
  {
    exam_number: "S10",
    exam_date: "2026-08-01",
    scaled_score: 170,
    questions: [
      q(1, 1, "Flaws"),
      q(1, 2, "Flaws", { question_score: 0, flagged: true, difficulty: 5, total_time_seconds: 120 }),
      q(2, 1, "Law passages", { experimental_section: true }),
    ],
  },
  {
    exam_number: "S2",
    exam_date: "2026-06-01",
    scaled_score: 160,
    questions: [
      q(1, 1, "Assumptions", { question_score: 0, difficulty: 1 }),
      q(2, 1, "Science passages", { flagged: true }),
    ],
  },
  {
    exam_number: "S1",
    exam_date: null,
    scaled_score: null,
    questions: [q(1, 1, "Mystery subtype", { difficulty: null })],
  },
];

const rows = flattenExams(exams);

describe("flattenExams", () => {
  it("attaches exam fields and infers the section type from the subtype", () => {
    expect(rows).toHaveLength(6);
    expect(rows[2]).toMatchObject({
      exam_number: "S10",
      exam_date: "2026-08-01",
      scaled_score: 170,
      section_type: "Reading Comprehension",
      experimental_section: true,
    });
    expect(rows[0].section_type).toBe("Logical Reasoning");
    expect(rows[5].section_type).toBe("Unknown");
  });
});

describe("filters", () => {
  it("lists options in natural order", () => {
    const options = filterOptions(rows);
    expect(options.exams).toEqual(["S1", "S2", "S10"]);
    expect(options.sections).toEqual([1, 2]);
    expect(options.sectionTypes).toEqual(["Logical Reasoning", "Reading Comprehension", "Unknown"]);
  });

  it("treats both or neither flag options as no filter", () => {
    expect(applyFilters(rows, { flags: ["Flagged"] })).toHaveLength(2);
    expect(applyFilters(rows, { flags: ["Not Flagged"] })).toHaveLength(4);
    expect(applyFilters(rows, { flags: ["Flagged", "Not Flagged"] })).toHaveLength(6);
  });

  it("separates scored and experimental sections", () => {
    expect(applyFilters(rows, { status: ["Experimental"] }).map((r) => r.subtype)).toEqual([
      "Law passages",
    ]);
    expect(applyFilters(rows, { status: ["Scored"] })).toHaveLength(5);
  });

  it("excludes undated exams from date ranges and combines filters with AND", () => {
    expect(applyFilters(rows, { dateFrom: "2026-07-01" }).map((r) => r.exam_number)).toEqual([
      "S10",
      "S10",
      "S10",
    ]);
    expect(applyFilters(rows, { dateTo: "2026-06-01", sections: [2] })).toHaveLength(1);
  });

  it("counts active filters", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, exams: ["S1"], dateTo: "2026-01-01" })).toBe(2);
  });
});

describe("aggregations", () => {
  it("computes headline numbers and averages each exam's scaled score once", () => {
    expect(computeKpis(rows)).toEqual({
      questions: 6,
      correct: 4,
      accuracy: 67,
      avgSeconds: 70,
      flagged: 2,
      exams: 3,
      avgScaled: 165,
    });
    expect(computeKpis([])).toMatchObject({ questions: 0, accuracy: null, avgScaled: null });
  });

  it("orders the trend by date, then undated exams by natural exam number", () => {
    expect(trendByExam(rows).map((e) => [e.exam_number, e.accuracy])).toEqual([
      ["S2", 50],
      ["S10", 67],
      ["S1", 100],
    ]);
  });

  it("puts the weakest subtypes first and only lists attempted subtypes", () => {
    const subtypes = statsBySubtype(rows);
    expect(subtypes.map((s) => s.subtype)).toEqual([
      "Assumptions",
      "Flaws",
      "Law passages",
      "Mystery subtype",
      "Science passages",
    ]);
    expect(subtypes[1]).toMatchObject({ attempted: 2, correct: 1, accuracy: 50, avgSeconds: 90 });
  });

  it("groups by section type and difficulty", () => {
    expect(statsBySectionType(rows).map((s) => [s.section_type, s.accuracy])).toEqual([
      ["Logical Reasoning", 33],
      ["Reading Comprehension", 100],
      ["Unknown", 100],
    ]);
    expect(statsByDifficulty(rows).map((d) => [d.label, d.attempted])).toEqual([
      ["Level 1", 1],
      ["Level 3", 3],
      ["Level 5", 1],
    ]);
  });

  it("compares flagged and unflagged accuracy", () => {
    const summary = flagSummary(rows);
    expect(summary.flagged).toMatchObject({ attempted: 2, accuracy: 50 });
    expect(summary.unflagged).toMatchObject({ attempted: 4, accuracy: 75 });
  });

  it("summarizes a single exam", () => {
    expect(summarizeExam(exams[0])).toMatchObject({
      questions: 3,
      correct: 2,
      accuracy: 67,
      flagged: 1,
      sections: 2,
      experimentalSections: [2],
    });
  });
});
