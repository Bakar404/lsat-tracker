import { CircleAlert, FileText, FileUp, LoaderCircle, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { summarizeExam } from "../lib/analytics.js";
import { MAX_UPLOAD_BYTES, transformReport } from "../lib/api.js";
import {
  BackupError,
  MAX_EXAM_NUMBER_LENGTH,
  SCALED_SCORE_MAX,
  SCALED_SCORE_MIN,
  examNumberProblem,
  isValidIsoDate,
  isValidScaledScore,
  validateExam,
} from "../lib/backup.js";
import { plural } from "../lib/format.js";
import Modal from "./ui/Modal.jsx";
import { buttonPrimary, buttonSecondary, input, label as labelStyle } from "./ui/styles.js";

const LIMIT_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

function precheck(file) {
  if (!/\.pdf$/i.test(file.name)) {
    return "Not a PDF file. Choose the score report PDF you saved from LawHub.";
  }
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return `The file is larger than the ${LIMIT_MB} MB limit.`;
  return null;
}

function parsedFields({ metadata, rows }) {
  return {
    status: "parsed",
    error: null,
    exam_number: metadata.exam_number ?? "",
    exam_date: metadata.exam_date ?? "",
    scaled_score: metadata.scaled_score == null ? "" : String(metadata.scaled_score),
    questions: rows,
  };
}

function problemsFor(item, numberCounts) {
  const number = item.exam_number.trim();
  let examNumber = examNumberProblem(number);
  if (!examNumber && numberCounts.get(number) > 1) {
    examNumber = "Another report in this upload has the same exam number.";
  }
  let examDate = null;
  if (!item.exam_date) examDate = "Enter the date you took this exam.";
  else if (!isValidIsoDate(item.exam_date)) examDate = "Enter a valid date.";
  const scaledScore =
    item.scaled_score !== "" && !isValidScaledScore(Number(item.scaled_score))
      ? `Use a whole number from ${SCALED_SCORE_MIN} to ${SCALED_SCORE_MAX}, or leave it empty.`
      : null;
  return { exam_number: examNumber, exam_date: examDate, scaled_score: scaledScore };
}

function StatusLine({ item }) {
  if (item.status === "queued") return <p className="text-sm text-slate-500">Waiting to be read</p>;
  if (item.status === "parsing") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-slate-500">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        Reading report
      </p>
    );
  }
  if (item.status === "failed") {
    return (
      <p className="flex items-start gap-1.5 text-sm text-red-700">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {item.error}
      </p>
    );
  }
  const stats = summarizeExam(item);
  const experimental = stats.experimentalSections.length
    ? `, experimental: Section ${stats.experimentalSections.join(", ")}`
    : "";
  return (
    <p className="text-sm text-slate-600">
      {plural(stats.questions, "question")}, {stats.correct} correct, {stats.flagged} flagged
      {experimental}
    </p>
  );
}

function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className={labelStyle}>
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function UploadItem({ item, problems, showErrors, replaces, onChange, onRemove }) {
  const id = useId();
  const errorFor = (key) => (showErrors ? problems[key] : null);
  const fieldProps = (key) => ({
    id: `${id}-${key}`,
    value: item[key],
    onChange: (event) => onChange({ [key]: event.target.value }),
    "aria-invalid": errorFor(key) ? true : undefined,
    "aria-describedby": errorFor(key) ? `${id}-${key}-error` : undefined,
    className: `${input} ${errorFor(key) ? "border-red-400" : ""}`,
  });

  return (
    <li className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900" title={item.file.name}>
            {item.file.name}
          </p>
          <StatusLine item={item} />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.file.name}`}
          className="-mt-1 -mr-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {item.status === "parsed" && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Field id={`${id}-exam_number`} label="Exam number" error={errorFor("exam_number")}>
              <input type="text" maxLength={MAX_EXAM_NUMBER_LENGTH} required {...fieldProps("exam_number")} />
            </Field>
            <Field id={`${id}-exam_date`} label="Date taken" error={errorFor("exam_date")}>
              <input type="date" required {...fieldProps("exam_date")} />
            </Field>
            <Field id={`${id}-scaled_score`} label="Scaled score" error={errorFor("scaled_score")}>
              <input
                type="number"
                inputMode="numeric"
                min={SCALED_SCORE_MIN}
                max={SCALED_SCORE_MAX}
                step={1}
                placeholder="Optional"
                {...fieldProps("scaled_score")}
              />
            </Field>
          </div>
          {replaces && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Exam {item.exam_number.trim()} is already saved. Saving replaces it with this report.
            </p>
          )}
        </>
      )}
    </li>
  );
}

export default function UploadDialog({ existingNumbers, onSave, onClose }) {
  const [items, setItems] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const nextId = useRef(0);
  const queue = useRef(Promise.resolve());
  const removed = useRef(new Set());
  const controller = useRef(null);

  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    // Dropping a file outside the drop zone would otherwise make the browser open it.
    const preventDrop = (event) => event.preventDefault();
    window.addEventListener("dragover", preventDrop);
    window.addEventListener("drop", preventDrop);
    return () => {
      abort.abort();
      window.removeEventListener("dragover", preventDrop);
      window.removeEventListener("drop", preventDrop);
    };
  }, []);

  const update = (id, patch) =>
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  // Reports are parsed one at a time; the server handles them sequentially anyway.
  const parse = async (item) => {
    const signal = controller.current?.signal;
    if (!signal || signal.aborted || removed.current.has(item.id)) return;
    update(item.id, { status: "parsing" });
    try {
      update(item.id, parsedFields(await transformReport(item.file, { signal })));
    } catch (error) {
      if (error.name !== "AbortError") update(item.id, { status: "failed", error: error.message });
    }
  };

  const addFiles = (files) => {
    const added = files.map((file) => {
      nextId.current += 1;
      const problem = precheck(file);
      return {
        id: nextId.current,
        file,
        status: problem ? "failed" : "queued",
        error: problem,
        exam_number: "",
        exam_date: "",
        scaled_score: "",
        questions: [],
      };
    });
    setItems((list) => [...list, ...added]);
    setSaveError(null);
    for (const item of added) {
      if (item.status === "queued") queue.current = queue.current.then(() => parse(item));
    }
  };

  const remove = (id) => {
    removed.current.add(id);
    setItems((list) => list.filter((item) => item.id !== id));
  };

  const parsed = useMemo(() => items.filter((item) => item.status === "parsed"), [items]);
  const busy = items.some((item) => item.status === "queued" || item.status === "parsing");
  const problems = useMemo(() => {
    const counts = new Map();
    for (const item of parsed) {
      const number = item.exam_number.trim();
      counts.set(number, (counts.get(number) ?? 0) + 1);
    }
    return new Map(parsed.map((item) => [item.id, problemsFor(item, counts)]));
  }, [parsed]);

  const save = async () => {
    setShowErrors(true);
    setSaveError(null);
    const invalid = parsed.some((item) => Object.values(problems.get(item.id)).some(Boolean));
    if (invalid) return;
    setSaving(true);
    try {
      const addedAt = new Date().toISOString();
      const exams = parsed.map((item) =>
        validateExam(
          {
            exam_number: item.exam_number.trim(),
            exam_date: item.exam_date,
            scaled_score: item.scaled_score === "" ? null : Number(item.scaled_score),
            source: "upload",
            file_name: item.file.name.slice(0, 255),
            added_at: addedAt,
            questions: item.questions,
          },
          item.file.name,
        ),
      );
      await onSave(exams);
    } catch (error) {
      setSaveError(
        error instanceof BackupError
          ? `This report could not be saved: ${error.message}`
          : `Could not save to browser storage: ${error.message}`,
      );
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Upload score reports"
      description="Add LawHub score report PDFs. The server on this computer reads them, then you can check the details before saving."
      size="lg"
      onClose={onClose}
      dismissible={!saving}
      footer={
        <>
          <button type="button" className={buttonSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className={buttonPrimary}
            onClick={save}
            disabled={saving || busy || parsed.length === 0}
          >
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {parsed.length ? `Save ${plural(parsed.length, "exam")}` : "Save"}
          </button>
        </>
      }
    >
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles([...event.dataTransfer.files]);
        }}
        className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 text-center transition-colors has-focus-visible:ring-2 has-focus-visible:ring-slate-900 ${items.length ? "py-4" : "py-8"} ${dragging ? "border-slate-900 bg-slate-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"}`}
      >
        <FileUp className="h-8 w-8 text-slate-400" aria-hidden="true" />
        <span className="mt-3 font-medium text-slate-900">
          {items.length ? "Add more PDF files" : "Choose PDF files or drop them here"}
        </span>
        <span className="mt-1 text-sm text-slate-500">
          LawHub score reports, up to {LIMIT_MB} MB each
        </span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          data-autofocus
          className="sr-only"
          onChange={(event) => {
            const files = [...event.target.files];
            event.target.value = "";
            addFiles(files);
          }}
        />
      </label>

      {items.length > 0 && (
        <ul className="mt-5 space-y-3" aria-label="Selected reports">
          {items.map((item) => (
            <UploadItem
              key={item.id}
              item={item}
              problems={problems.get(item.id) ?? {}}
              showErrors={showErrors}
              replaces={item.status === "parsed" && existingNumbers.has(item.exam_number.trim())}
              onChange={(patch) => update(item.id, patch)}
              onRemove={() => remove(item.id)}
            />
          ))}
        </ul>
      )}

      {saveError && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {saveError}
        </p>
      )}
    </Modal>
  );
}
