import { fmtMMSS } from "../../lib/format.js";

export const AXIS_TICK = { fontSize: 12, fill: "#64748b" };
export const AXIS_LINE = "#cbd5e1";
export const GRID = "#e2e8f0";
export const CURSOR = { fill: "#f1f5f9" };

export const accuracyLine = (d) => `${d.accuracy}% correct (${d.correct} of ${d.attempted})`;
export const timeLine = (d) => `Average time ${fmtMMSS(d.avgSeconds)}`;

/** Height of a horizontal bar chart with one bar per category. */
export const barListHeight = (count) => Math.max(180, count * 30 + 40);
