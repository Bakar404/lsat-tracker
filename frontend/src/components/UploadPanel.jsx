import React, { useState } from "react";
import { Upload } from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  toNum,
  toBool,
  parseCSV,
  headerMap,
  DEFAULT_TRANSFORMER,
  ROWS_TABLE,
  META_TABLE,
} from "../lib/csvUtils";

export default function UploadPanel({ user, profile, onAfterUpload }) {
  const [examNumber, setExamNumber] = useState("");
  const [examDate, setExamDate] = useState(""); // yyyy-mm-dd
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState({
    examNumber: false,
    examDate: false,
  });

  const valid = !!examNumber.trim() && /^\d{4}-\d{2}-\d{2}$/.test(examDate);

  // Validation errors only show if field is touched
  const errors = {
    examNumber: touched.examNumber && !examNumber.trim(),
    examDate:
      touched.examDate &&
      (!examDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(examDate)),
  };

  const hasVisibleErrors = Object.values(errors).some(Boolean);

  const onUploadPdf = async (file) => {
    if (!user) return alert("Sign in first.");
    if (!examNumber.trim()) return alert("Exam Number is required.");
    if (!examDate.trim()) return alert("Exam Date is required.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate))
      return alert("Exam Date must be in YYYY-MM-DD format.");

    try {
      setBusy(true);

      // 1) send to transformer (force-send the required fields)
      const fd = new FormData();
      fd.append("file", file);
      fd.append("exam_number", examNumber.trim());
      fd.append("exam_date", examDate.trim());

      const res = await fetch(DEFAULT_TRANSFORMER, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        let detail = null;
        try {
          detail = (await res.clone().json())?.detail;
        } catch {}
        throw new Error(detail || `Transformer error ${res.status}`);
      }

      // 2) get CSVs
      const contentType = res.headers.get("content-type") || "";
      let allCsv = "",
        metaCsv = "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        allCsv = json.all_sections_csv || json.all_sections_clean_scored || "";
        metaCsv = json.exam_metadata_csv || json.exam_metadata || "";
      } else {
        const text = await res.text();
        const parts = text.split("\n---META---\n");
        allCsv = parts[0] || text;
        metaCsv = parts[1] || "";
      }
      if (!allCsv.trim())
        throw new Error("Transformer returned empty question CSV.");

      // 3) parse rows
      const parsedRows = parseCSV(allCsv)
        .map(headerMap)
        .map((r) => ({
          exam_number: examNumber.trim(), // override with REQUIRED field
          section: String(r.section ?? "").trim(),
          question: String(r.question ?? "").trim(),
          subtype: (r.subtype ?? "").trim(),
          difficulty:
            r.difficulty === ""
              ? null
              : Number(String(r.difficulty).replace(/[^0-9-]/g, "")),
          total_time_seconds: toNum(
            r.total_time_seconds ?? r.total_time ?? r.time_seconds ?? r.seconds,
            0
          ),
          question_score: toNum(r.question_score, 0),
          flagged: toBool(r.flagged),
          experimental_section: toBool(r.experimental_section),
        }));

      // 4) parse meta (but *force* the required values)
      let parsedMeta = [];
      if (metaCsv.trim()) {
        parsedMeta = parseCSV(metaCsv).map(headerMap);
      }
      // ensure a meta row exists for this exam and uses REQUIRED values
      const metaRow = {
        exam_number: examNumber.trim(),
        exam_date: examDate.trim(),
        scaled_score:
          parsedMeta[0]?.scaled_score === "" ||
          parsedMeta[0]?.scaled_score == null
            ? null
            : toNum(parsedMeta[0].scaled_score, null),
      };

      // 5) upsert to Supabase
      const rowsPayload = parsedRows.map((r) => ({ user_id: user.id, ...r }));
      const { error: upRowsErr } = await supabase
        .from(ROWS_TABLE)
        .upsert(rowsPayload, {
          onConflict: "user_id,exam_number,section,question",
        });
      if (upRowsErr) throw upRowsErr;

      const { error: upMetaErr } = await supabase
        .from(META_TABLE)
        .upsert(
          { user_id: user.id, ...metaRow },
          { onConflict: "user_id,exam_number" }
        );
      if (upMetaErr) throw upMetaErr;

      setExamNumber("");
      setExamDate("");
      setTouched({ examNumber: false, examDate: false }); // reset touched state
      onAfterUpload?.(); // caller should re-fetch
      alert("Test transformed and saved.");
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to upload/transform.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        <div className="grid md:grid-cols-3 gap-2">
          <input
            value={examNumber}
            onChange={(e) => setExamNumber(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, examNumber: true }))}
            placeholder="Exam # (required)"
            className={`px-3 py-2 rounded-xl border text-sm ${
              errors.examNumber ? "border-red-300 bg-red-50" : "border-gray-300"
            }`}
            required
          />
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, examDate: true }))}
            className={`px-3 py-2 rounded-xl border text-sm ${
              errors.examDate ? "border-red-300 bg-red-50" : "border-gray-300"
            }`}
            required
          />
          <label
            className={`inline-flex items-center justify-center px-3 py-2 rounded-xl ${
              user && valid && !busy
                ? "bg-slate-900 text-white cursor-pointer"
                : "bg-slate-200 text-slate-500 cursor-not-allowed"
            }`}
          >
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={!user || !valid || busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadPdf(f);
              }}
            />
            {busy ? "Uploading…" : "Choose PDF & Upload"}
          </label>
        </div>
        {hasVisibleErrors && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
            <strong>Required fields missing:</strong>
            <ul className="list-disc ml-4 mt-1">
              {errors.examNumber && <li>Exam Number is required</li>}
              {errors.examDate &&
                examDate.trim() &&
                !/^\d{4}-\d{2}-\d{2}$/.test(examDate) && (
                  <li>Exam Date must be in YYYY-MM-DD format</li>
                )}
              {errors.examDate && !examDate.trim() && (
                <li>Exam Date is required</li>
              )}
            </ul>
          </div>
        )}
        <p className="text-xs text-slate-500">
          <strong>Both Exam # and Exam date are required.</strong> They will be
          saved as <code>exam_number</code> and <code>exam_date</code>.
        </p>
      </div>
    </div>
  );
}
