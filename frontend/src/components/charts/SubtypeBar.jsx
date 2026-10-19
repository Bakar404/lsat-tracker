import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import { SECTION_TYPE_COLORS } from "../ui/styles.js";
import CategoryTick from "./CategoryTick.jsx";
import ChartCard, { LegendDots } from "./ChartCard.jsx";
import StatTooltip from "./StatTooltip.jsx";
import { AXIS_LINE, AXIS_TICK, CURSOR, GRID, accuracyLine, barListHeight, timeLine } from "./theme.js";

const MAX_BARS = 15;

/**
 * Horizontal bars, one per question type, coloured by section type.
 * `rows` is already ordered; `value` picks the bar length.
 */
export function QuestionTypeBars({ rows, value, axis }) {
  const wide = useMediaQuery("(min-width: 640px)");
  return (
    <ResponsiveContainer width="100%" height={barListHeight(rows.length)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} stroke={AXIS_LINE} {...axis} />
        <YAxis
          type="category"
          dataKey="subtype"
          width={wide ? 200 : 112}
          interval={0}
          stroke={AXIS_LINE}
          tick={(props) => <CategoryTick {...props} maxChars={wide ? 30 : 15} />}
        />
        <Tooltip
          cursor={CURSOR}
          content={(props) => (
            <StatTooltip
              {...props}
              title={(d) => d.subtype}
              lines={(d) => [accuracyLine(d), timeLine(d), `${d.flagged} flagged`]}
            />
          )}
        />
        <Bar
          dataKey={value}
          maxBarSize={20}
          radius={[0, 6, 6, 0]}
          shape={(props) => (
            <Rectangle {...props} fill={SECTION_TYPE_COLORS[props.payload.section_type]} />
          )}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

const LEGEND_ORDER = Object.keys(SECTION_TYPE_COLORS);

export function SectionTypeLegend({ rows }) {
  const present = new Set(rows.map((d) => d.section_type));
  const types = LEGEND_ORDER.filter((type) => present.has(type));
  return <LegendDots items={types.map((type) => ({ label: type, color: SECTION_TYPE_COLORS[type] }))} />;
}

export default function SubtypeBar({ data }) {
  const rows = data.slice(0, MAX_BARS);
  return (
    <ChartCard
      title="Accuracy by question type"
      subtitle={data.length > MAX_BARS ? `Weakest ${MAX_BARS} of ${data.length} types` : "Weakest first"}
      legend={<SectionTypeLegend rows={rows} />}
    >
      <QuestionTypeBars rows={rows} value="accuracy" axis={{ domain: [0, 100], unit: "%" }} />
    </ChartCard>
  );
}
