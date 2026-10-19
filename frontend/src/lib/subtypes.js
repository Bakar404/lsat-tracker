export const LOGICAL_REASONING = "Logical Reasoning";
export const READING_COMPREHENSION = "Reading Comprehension";
export const UNKNOWN_SECTION_TYPE = "Unknown";

/** Question families as LawHub labels them in the score report "Subtype" column. */
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

export const READING_COMPREHENSION_SUBTYPES = [
  "Humanities passages",
  "Law passages",
  "Social science passages",
  "Science passages",
];

const SECTION_TYPE_BY_SUBTYPE = new Map([
  ...LOGICAL_REASONING_SUBTYPES.map((s) => [s.toLowerCase(), LOGICAL_REASONING]),
  ...READING_COMPREHENSION_SUBTYPES.map((s) => [s.toLowerCase(), READING_COMPREHENSION]),
]);

export function inferSectionType(subtype) {
  if (!subtype) return UNKNOWN_SECTION_TYPE;
  return SECTION_TYPE_BY_SUBTYPE.get(String(subtype).trim().toLowerCase()) ?? UNKNOWN_SECTION_TYPE;
}
