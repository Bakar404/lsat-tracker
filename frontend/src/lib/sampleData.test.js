import { describe, expect, it } from "vitest";
import { createBackup, validateBackup } from "./backup.js";
import { generateSampleExams } from "./sampleData.js";
import { UNKNOWN_SECTION_TYPE, inferSectionType } from "./subtypes.js";

const NOW = new Date("2026-10-18T12:00:00Z");

describe("generateSampleExams", () => {
  const exams = generateSampleExams({ now: NOW });

  it("is deterministic", () => {
    expect(generateSampleExams({ now: NOW })).toEqual(exams);
    expect(generateSampleExams({ seed: 7, now: NOW })).not.toEqual(exams);
  });

  it("produces clearly labelled exams that pass backup validation", () => {
    expect(exams.map((e) => e.exam_number)).toEqual(["S1", "S2", "S3", "S4", "S5", "S6"]);
    expect(exams.every((e) => e.source === "sample")).toBe(true);
    expect(validateBackup(createBackup(exams, NOW))).toEqual(exams);
  });

  it("models a four-section LSAT with one experimental section", () => {
    for (const exam of exams) {
      const sections = new Set(exam.questions.map((q) => q.section));
      const experimental = new Set(
        exam.questions.filter((q) => q.experimental_section).map((q) => q.section),
      );
      expect([...sections]).toEqual([1, 2, 3, 4]);
      expect(experimental.size).toBe(1);
      expect(exam.scaled_score).toBeGreaterThanOrEqual(120);
      expect(exam.scaled_score).toBeLessThanOrEqual(180);
      for (const q of exam.questions) {
        expect(inferSectionType(q.subtype)).not.toBe(UNKNOWN_SECTION_TYPE);
      }
    }
  });
});
