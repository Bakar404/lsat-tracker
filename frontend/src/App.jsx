import { CircleAlert, FileText, LayoutDashboard, LoaderCircle } from "lucide-react";
import { Suspense, lazy, useMemo, useRef, useState } from "react";
import EmptyState from "./components/EmptyState.jsx";
import ExamsView from "./components/ExamsView.jsx";
import Footer from "./components/Footer.jsx";
import Header from "./components/Header.jsx";
import SampleBanner from "./components/SampleBanner.jsx";
import UploadDialog from "./components/UploadDialog.jsx";
import ConfirmDialog from "./components/ui/ConfirmDialog.jsx";
import ToastProvider from "./components/ui/ToastProvider.jsx";
import { card } from "./components/ui/styles.js";
import { useToast } from "./components/ui/useToast.js";
import { useExams } from "./hooks/useExams.js";
import { ROUTES, navigate, useHashRoute } from "./hooks/useHashRoute.js";
import { createBackup, examsToCsv, parseBackup } from "./lib/backup.js";
import { downloadFile } from "./lib/download.js";
import { localDateStamp, plural } from "./lib/format.js";
import { SAMPLE_SOURCE, generateSampleExams } from "./lib/sampleData.js";

// The dashboard pulls in the charting library, so it loads on demand.
const Dashboard = lazy(() => import("./components/dashboard/Dashboard.jsx"));

const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

function Loading({ label }) {
  return (
    <div className={`${card} flex flex-col items-center gap-3 px-6 py-16 text-slate-500`}>
      <LoaderCircle className="h-8 w-8 animate-spin text-slate-400" aria-hidden="true" />
      <p role="status">{label}</p>
    </div>
  );
}

function StorageError({ error }) {
  return (
    <div role="alert" className={`${card} px-6 py-12 text-center`}>
      <CircleAlert className="mx-auto h-10 w-10 text-red-500" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-semibold text-slate-900">Browser storage is unavailable</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
        LSAT Tracker saves your exams in this browser&apos;s IndexedDB storage, and the browser refused
        access. Private or incognito windows and strict privacy settings can block it. Try a regular
        window or another browser.
      </p>
      <p className="mt-4 text-xs text-slate-400">{String(error?.message ?? error)}</p>
    </div>
  );
}

const TABS = [
  { route: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { route: "exams", label: "Exams", icon: FileText },
];

function Tabs({ route, examCount }) {
  return (
    <nav aria-label="Views" className={`${card} p-2`}>
      <ul className="flex gap-2">
        {TABS.map(({ route: target, label, icon: Icon }) => {
          const current = route === target;
          return (
            <li key={target}>
              <a
                href={ROUTES[target]}
                aria-current={current ? "page" : undefined}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${current ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
                {target === "exams" && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${current ? "bg-white/20" : "bg-slate-100 text-slate-700"}`}
                  >
                    {examCount}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Tracker() {
  const { status, exams, error, saveExams, deleteExams, clearExams } = useExams();
  const route = useHashRoute();
  const { notify } = useToast();
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const importInput = useRef(null);

  const existingNumbers = useMemo(() => new Set(exams.map((exam) => exam.exam_number)), [exams]);
  const sampleNumbers = useMemo(
    () => exams.filter((exam) => exam.source === SAMPLE_SOURCE).map((exam) => exam.exam_number),
    [exams],
  );
  const hasExams = exams.length > 0;

  const fail = (message, err) => notify(`${message} ${err?.message ?? ""}`.trim(), "error");

  const loadSampleNow = async (sample) => {
    try {
      await saveExams(sample);
      navigate("dashboard");
      notify(`Loaded ${plural(sample.length, "sample exam")}.`);
    } catch (err) {
      fail("Could not load the sample data.", err);
    }
  };

  const loadSample = () => {
    const sample = generateSampleExams();
    const sampleNumberSet = new Set(sample.map((exam) => exam.exam_number));
    const clashes = exams.filter(
      (exam) => exam.source !== SAMPLE_SOURCE && sampleNumberSet.has(exam.exam_number),
    );
    if (!clashes.length) return loadSampleNow(sample);
    setConfirm({
      title: "Replace exams with sample data?",
      message: `The sample data uses exam numbers ${[...sampleNumberSet].join(", ")}. Loading it replaces your saved ${plural(clashes.length, "exam")} with the same number.`,
      confirmLabel: "Load sample data",
      tone: "danger",
      action: () => loadSampleNow(sample),
    });
  };

  const removeSample = async () => {
    try {
      await deleteExams(sampleNumbers);
      notify("Removed the sample data.");
    } catch (err) {
      fail("Could not remove the sample data.", err);
    }
  };

  const exportJson = () => {
    const backup = createBackup(exams);
    downloadFile(
      `lsat-tracker-backup-${localDateStamp()}.json`,
      `${JSON.stringify(backup, null, 2)}\n`,
      "application/json",
    );
    notify(`Exported a backup of ${plural(exams.length, "exam")}.`);
  };

  const exportCsv = () => {
    downloadFile(
      `lsat-tracker-questions-${localDateStamp()}.csv`,
      examsToCsv(exams),
      "text/csv;charset=utf-8",
    );
    notify(`Exported all questions from ${plural(exams.length, "exam")} to CSV.`);
  };

  const importBackup = async (file) => {
    let imported;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("The file is too large to be a backup.");
      imported = parseBackup(await file.text());
    } catch (err) {
      fail("Import failed.", err);
      return;
    }
    if (!imported.length) {
      notify("That backup does not contain any exams.", "info");
      return;
    }
    const replaced = imported.filter((exam) => existingNumbers.has(exam.exam_number)).length;
    setConfirm({
      title: "Import backup?",
      message: `${file.name} contains ${plural(imported.length, "exam")}. ${
        replaced
          ? `${plural(replaced, "saved exam")} with the same number will be replaced.`
          : "They will be added to the exams saved in this browser."
      }`,
      confirmLabel: `Import ${plural(imported.length, "exam")}`,
      tone: "primary",
      action: async () => {
        await saveExams(imported);
        notify(`Imported ${plural(imported.length, "exam")}.`);
      },
    });
  };

  const clearAll = () =>
    setConfirm({
      title: "Delete all data?",
      message: `This permanently deletes ${plural(exams.length, "exam")} from this browser. Export a backup first if you might want them later.`,
      confirmLabel: "Delete all data",
      tone: "danger",
      action: async () => {
        await clearExams();
        notify("Deleted all data.");
      },
    });

  const deleteExam = (exam) =>
    setConfirm({
      title: `Delete exam ${exam.exam_number}?`,
      message: `This removes exam ${exam.exam_number} and its ${plural(exam.questions.length, "question")} from this browser.`,
      confirmLabel: "Delete exam",
      tone: "danger",
      action: async () => {
        await deleteExams([exam.exam_number]);
        notify(`Deleted exam ${exam.exam_number}.`);
      },
    });

  const runConfirmed = async () => {
    try {
      await confirm.action();
    } catch (err) {
      fail("Something went wrong.", err);
    } finally {
      setConfirm(null);
    }
  };

  const saveUploads = async (uploaded) => {
    await saveExams(uploaded);
    setUploading(false);
    navigate("dashboard");
    notify(`Saved ${plural(uploaded.length, "exam")}.`);
  };

  let content;
  if (status === "loading") content = <Loading label="Loading your exams" />;
  else if (status === "error") content = <StorageError error={error} />;
  else if (!hasExams) {
    content = <EmptyState onUpload={() => setUploading(true)} onLoadSample={loadSample} />;
  } else {
    content = (
      <>
        <Tabs route={route} examCount={exams.length} />
        {sampleNumbers.length > 0 && (
          <SampleBanner count={sampleNumbers.length} onRemove={removeSample} />
        )}
        {route === "exams" ? (
          <ExamsView exams={exams} onDelete={deleteExam} />
        ) : (
          <Suspense fallback={<Loading label="Loading the dashboard" />}>
            <Dashboard exams={exams} />
          </Suspense>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-indigo-100">
      <Header
        onUpload={() => setUploading(true)}
        hasExams={hasExams}
        onLoadSample={loadSample}
        onImport={() => importInput.current?.click()}
        onExportJson={exportJson}
        onExportCsv={exportCsv}
        onClearAll={clearAll}
      />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-8">
        {content}
      </main>
      <Footer />

      <input
        ref={importInput}
        id="import-backup-input"
        type="file"
        accept="application/json,.json"
        aria-label="Import backup file"
        className="hidden"
        onChange={(event) => {
          const [file] = event.target.files;
          event.target.value = "";
          if (file) importBackup(file);
        }}
      />
      {uploading && (
        <UploadDialog
          existingNumbers={existingNumbers}
          onSave={saveUploads}
          onClose={() => setUploading(false)}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          tone={confirm.tone}
          onConfirm={runConfirmed}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Tracker />
    </ToastProvider>
  );
}
