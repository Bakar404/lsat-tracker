import { CheckCircle2, Clock, Database, Flag, Gauge, SearchX, Target } from "lucide-react";
import { useMemo, useState } from "react";
import {
  EMPTY_FILTERS,
  applyFilters,
  computeKpis,
  filterOptions,
  flagSummary,
  flattenExams,
  statsByDifficulty,
  statsBySectionType,
  statsBySubtype,
  trendByExam,
} from "../../lib/analytics.js";
import { rowsToCsv } from "../../lib/backup.js";
import { downloadFile } from "../../lib/download.js";
import { fmtMMSS, fmtPercent, localDateStamp, plural } from "../../lib/format.js";
import AvgTimeBar from "../charts/AvgTimeBar.jsx";
import DifficultyChart from "../charts/DifficultyChart.jsx";
import FlaggedPie from "../charts/FlaggedPie.jsx";
import SectionAccuracyChart from "../charts/SectionAccuracyChart.jsx";
import SubtypeBar from "../charts/SubtypeBar.jsx";
import TrendChart from "../charts/TrendChart.jsx";
import { buttonSecondary, card } from "../ui/styles.js";
import { useToast } from "../ui/useToast.js";
import DataTable from "./DataTable.jsx";
import FiltersPanel from "./FiltersPanel.jsx";
import KpiCard from "./KpiCard.jsx";

/** Drops selections that no longer exist, for example after an exam is deleted. */
function pruneFilters(filters, options) {
  const keep = (selected, available) => selected.filter((value) => available.includes(value));
  return {
    ...filters,
    exams: keep(filters.exams, options.exams),
    sections: keep(filters.sections, options.sections),
    sectionTypes: keep(filters.sectionTypes, options.sectionTypes),
    subtypes: keep(filters.subtypes, options.subtypes),
  };
}

export default function Dashboard({ exams }) {
  const { notify } = useToast();
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const allRows = useMemo(() => flattenExams(exams), [exams]);
  const options = useMemo(() => filterOptions(allRows), [allRows]);
  const activeFilters = useMemo(() => pruneFilters(filters, options), [filters, options]);
  const rows = useMemo(() => applyFilters(allRows, activeFilters), [allRows, activeFilters]);
  const stats = useMemo(
    () => ({
      kpis: computeKpis(rows),
      bySectionType: statsBySectionType(rows),
      bySubtype: statsBySubtype(rows),
      byDifficulty: statsByDifficulty(rows),
      flags: flagSummary(rows),
      trend: trendByExam(rows),
    }),
    [rows],
  );

  const exportFiltered = () => {
    downloadFile(
      `lsat-tracker-filtered-questions-${localDateStamp()}.csv`,
      rowsToCsv(rows),
      "text/csv;charset=utf-8",
    );
    notify(`Exported ${plural(rows.length, "question")} to CSV.`);
  };

  const { kpis } = stats;

  return (
    <div className="space-y-6 sm:space-y-8">
      <FiltersPanel
        filters={activeFilters}
        options={options}
        onChange={setFilters}
        shown={rows.length}
        total={allRows.length}
        onExport={exportFiltered}
      />

      {rows.length === 0 ? (
        <section className={`${card} px-6 py-12 text-center`}>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <SearchX className="h-7 w-7 text-slate-400" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No questions match these filters</h2>
          <p className="mt-1 text-sm text-slate-500">Remove a filter or widen the date range.</p>
          <button
            type="button"
            className={`${buttonSecondary} mt-6`}
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            Clear filters
          </button>
        </section>
      ) : (
        <>
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              label="Questions"
              value={kpis.questions.toLocaleString()}
              detail={plural(kpis.exams, "exam")}
              icon={Database}
              tone="blue"
            />
            <KpiCard
              label="Correct"
              value={kpis.correct.toLocaleString()}
              detail={`${(kpis.questions - kpis.correct).toLocaleString()} incorrect`}
              icon={CheckCircle2}
              tone="green"
            />
            <KpiCard label="Accuracy" value={fmtPercent(kpis.accuracy)} icon={Target} tone="purple" />
            <KpiCard
              label="Avg time"
              value={fmtMMSS(kpis.avgSeconds)}
              detail="per question"
              icon={Clock}
              tone="orange"
            />
            <KpiCard
              label="Flagged"
              value={kpis.flagged.toLocaleString()}
              detail={`${fmtPercent((100 * kpis.flagged) / kpis.questions)} of total`}
              icon={Flag}
              tone="red"
            />
            <KpiCard
              label="Avg scaled"
              value={kpis.avgScaled ?? "-"}
              detail={kpis.avgScaled == null ? "none recorded" : "per exam"}
              icon={Gauge}
              tone="indigo"
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionAccuracyChart data={stats.bySectionType} />
            <TrendChart data={stats.trend} />
            <SubtypeBar data={stats.bySubtype} />
            <AvgTimeBar data={stats.bySubtype} />
            <FlaggedPie summary={stats.flags} />
            {stats.byDifficulty.length > 0 && <DifficultyChart data={stats.byDifficulty} />}
          </div>

          <DataTable rows={rows} />
        </>
      )}
    </div>
  );
}
