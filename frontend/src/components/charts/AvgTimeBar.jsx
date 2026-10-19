import { compareNatural, fmtMMSS } from "../../lib/format.js";
import ChartCard from "./ChartCard.jsx";
import { QuestionTypeBars, SectionTypeLegend } from "./SubtypeBar.jsx";

const MAX_BARS = 15;

export default function AvgTimeBar({ data }) {
  const rows = [...data]
    .sort((a, b) => b.avgSeconds - a.avgSeconds || compareNatural(a.subtype, b.subtype))
    .slice(0, MAX_BARS);
  return (
    <ChartCard
      title="Average time by question type"
      subtitle={data.length > MAX_BARS ? `Slowest ${MAX_BARS} of ${data.length} types` : "Slowest first, in minutes and seconds"}
      legend={<SectionTypeLegend rows={rows} />}
    >
      <QuestionTypeBars
        rows={rows}
        value="avgSeconds"
        axis={{ tickFormatter: fmtMMSS, allowDecimals: false }}
      />
    </ChartCard>
  );
}
