const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Natural order, so "S2" sorts before "S10" and "99" before "141". */
export function compareNatural(a, b) {
  return collator.compare(String(a ?? ""), String(b ?? ""));
}

export function fmtMMSS(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

export function fmtPercent(value) {
  return value === null || value === undefined ? "-" : `${Math.round(value)}%`;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Formats a YYYY-MM-DD string without shifting it into the local time zone. */
export function fmtDate(isoDate) {
  if (!isoDate) return "-";
  const date = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? isoDate : dateFormatter.format(date);
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count.toLocaleString()} ${count === 1 ? singular : pluralForm}`;
}

/** Local calendar date as YYYY-MM-DD, used in download file names. */
export function localDateStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
