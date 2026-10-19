import { LOGICAL_REASONING_SUBTYPES, READING_COMPREHENSION_SUBTYPES } from "./subtypes.js";

export const SAMPLE_SOURCE = "sample";
export const SAMPLE_SEED = 20260606;

const SAMPLE_DATES = [
  "2026-06-06",
  "2026-06-20",
  "2026-07-04",
  "2026-07-18",
  "2026-08-01",
  "2026-08-15",
];

// How often each Logical Reasoning family appears in a section.
const LR_WEIGHTS = [5, 5, 2, 4, 3, 3, 1, 2, 2];

// The synthetic test taker's relative strength per subtype; negative is a weak area.
const SKILL = {
  Assumptions: 0.35,
  "Strengthen or Weaken": 0.2,
  "Conclusions and Disputes": 0.6,
  Flaws: 0.1,
  "Deductions and Inference": -0.35,
  "Matching Structure and Principles": -0.55,
  "Matching Flaws": -0.2,
  "Explain or Resolve": 0.45,
  "Techniques, Roles, and Principles": 0,
  "Humanities passages": 0.3,
  "Law passages": 0.15,
  "Social science passages": 0.05,
  "Science passages": -0.45,
};

/** Small seeded PRNG so the sample data is identical on every load. */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function createRandom(seed) {
  const next = mulberry32(seed);
  const api = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    normal: () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next()),
    weighted(items, weights) {
      let roll = next() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < items.length; i += 1) {
        roll -= weights[i];
        if (roll < 0) return items[i];
      }
      return items.at(-1);
    },
    shuffle(items) {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = api.int(0, i);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
  return api;
}

function answer(random, { subtype, difficulty, examIndex, baseSeconds }) {
  const logit = 1.1 + SKILL[subtype] + 0.14 * examIndex - 0.6 * (difficulty - 3) + 0.35 * random.normal();
  const correct = random.next() < 1 / (1 + Math.exp(-logit));
  const seconds = baseSeconds + 14 * (difficulty - 3) + (correct ? 0 : 12) + 18 * random.normal();
  const flagChance = 0.03 + 0.05 * (difficulty - 1) + (correct ? 0 : 0.1);
  return {
    question_score: correct ? 1 : 0,
    total_time_seconds: Math.round(clamp(seconds, 20, 300)),
    flagged: random.next() < flagChance,
  };
}

function logicalReasoningSection(random, section, examIndex, experimental) {
  const count = random.int(25, 26);
  return Array.from({ length: count }, (_, i) => {
    const subtype = random.weighted(LOGICAL_REASONING_SUBTYPES, LR_WEIGHTS);
    // Questions get harder as a Logical Reasoning section goes on.
    const difficulty = clamp(Math.round(1 + (4 * i) / count + 0.8 * random.normal()), 1, 5);
    return {
      section,
      question: i + 1,
      subtype,
      difficulty,
      ...answer(random, { subtype, difficulty, examIndex, baseSeconds: 80 }),
      experimental_section: experimental,
    };
  });
}

function readingComprehensionSection(random, section, examIndex, experimental) {
  const passageSizes = random.shuffle([7, 7, 6, random.int(6, 7)]);
  const passageTypes = random.shuffle(READING_COMPREHENSION_SUBTYPES);
  const questions = [];
  passageSizes.forEach((size, passage) => {
    const subtype = passageTypes[passage];
    for (let i = 0; i < size; i += 1) {
      const difficulty = clamp(Math.round(3 + 1.1 * random.normal()), 1, 5);
      // Model the passage reading time on the first question of each passage.
      const baseSeconds = i === 0 ? 210 : 55;
      questions.push({
        section,
        question: questions.length + 1,
        subtype,
        difficulty,
        ...answer(random, { subtype, difficulty, examIndex, baseSeconds }),
        experimental_section: experimental,
      });
    }
  });
  return questions;
}

function scaledScoreFor(questions) {
  const scored = questions.filter((q) => !q.experimental_section);
  const accuracy = scored.reduce((sum, q) => sum + q.question_score, 0) / scored.length;
  return Math.round(clamp(120 + (60 * (accuracy - 0.2)) / 0.78, 120, 180));
}

/**
 * Builds a deterministic set of synthetic exams for exploring the dashboard.
 * Each exam has two Logical Reasoning sections, one Reading Comprehension section
 * and one unscored experimental section, like a current LSAT.
 */
export function generateSampleExams({ seed = SAMPLE_SEED, now = new Date() } = {}) {
  const random = createRandom(seed);
  return SAMPLE_DATES.map((examDate, examIndex) => {
    const layout = random.shuffle(["LR", "LR", "RC"]);
    layout.splice(random.int(0, 3), 0, random.next() < 0.5 ? "LR*" : "RC*");
    const questions = layout.flatMap((kind, i) => {
      const experimental = kind.endsWith("*");
      const build = kind.startsWith("LR") ? logicalReasoningSection : readingComprehensionSection;
      return build(random, i + 1, examIndex, experimental);
    });
    return {
      exam_number: `S${examIndex + 1}`,
      exam_date: examDate,
      scaled_score: scaledScoreFor(questions),
      source: SAMPLE_SOURCE,
      file_name: null,
      added_at: now.toISOString(),
      questions,
    };
  });
}
