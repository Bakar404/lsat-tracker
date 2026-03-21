import React, { useState, useRef, useEffect } from "react";
import { Upload, ChevronDown, Calendar, FileText, Plus } from "lucide-react";
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

export default function UploadDropdown({ user, onAfterUpload }) {
  const [isOpen, setIsOpen] = useState(false);
  const [examNumber, setExamNumber] = useState("");
  const [examDate, setExamDate] = useState(""); // yyyy-mm-dd
  const [selectedFile, setSelectedFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState({
    examNumber: false,
    examDate: false,
  });

  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const valid =
    !!examNumber.trim() && /^\d{4}-\d{2}-\d{2}$/.test(examDate) && selectedFile;

  // Validation errors only show if field is touched
  const errors = {
    examNumber: touched.examNumber && !examNumber.trim(),
    examDate:
      touched.examDate &&
      (!examDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(examDate)),
  };

  const hasVisibleErrors = Object.values(errors).some(Boolean);

  const resetForm = () => {
    setExamNumber("");
    setExamDate("");
    setSelectedFile(null);
    setTouched({ examNumber: false, examDate: false });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onUploadPdf = async () => {
    if (!user) return alert("Sign in first.");
    if (!examNumber.trim()) return alert("Exam Number is required.");
    if (!examDate.trim()) return alert("Exam Date is required.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate))
      return alert("Exam Date must be in YYYY-MM-DD format.");
    if (!selectedFile) return alert("Please select a PDF file.");
    try {
      setBusy(true);

      console.log("Current hostname:", window.location.hostname);
      console.log("Uploading to:", DEFAULT_TRANSFORMER);

      // 1) send to transformer (force-send the required fields)
      const fd = new FormData();
      fd.append("file", selectedFile);
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
        throw new Error(
          detail || `Backend error ${res.status}: ${res.statusText}`,
        );
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
            0,
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
          { onConflict: "user_id,exam_number" },
        );
      if (upMetaErr) throw upMetaErr;

      resetForm();
      setIsOpen(false);
      onAfterUpload?.(); // caller should re-fetch
      alert("Test transformed and saved.");
    } catch (e) {
      console.error("Upload error:", e);
      let errorMessage = e.message || "Failed to upload/transform.";

      // Provide more helpful error messages for common issues
      if (e.name === "TypeError" && e.message.includes("fetch")) {
        errorMessage =
          "Cannot connect to the backend server. Make sure the backend is running on localhost:8000.";
      } else if (e.message.includes("Failed to fetch")) {
        errorMessage =
          "Network error: Cannot reach the backend server. Please check if the backend is running.";
      }

      alert(errorMessage);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Upload Test Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-lg"
      >
        <Plus className="w-4 h-4" />
        Upload Test
        <ChevronDown
          className={`w-4 h-4 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-6 z-50">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload New Test
          </h3>

          <div className="space-y-4">
            {/* Exam Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Exam Number
              </label>
              <input
                value={examNumber}
                onChange={(e) => setExamNumber(e.target.value)}
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, examNumber: true }))
                }
                placeholder="Enter exam number"
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  errors.examNumber
                    ? "border-red-300 bg-red-50"
                    : "border-gray-300"
                }`}
                required
              />
            </div>

            {/* Exam Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Exam Date
              </label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, examDate: true }))
                }
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  errors.examDate
                    ? "border-red-300 bg-red-50"
                    : "border-gray-300"
                }`}
                required
              />
            </div>

            {/* PDF File Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                PDF File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                required
              />
              {selectedFile && (
                <p className="text-xs text-slate-500 mt-1">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            {/* Error Messages */}
            {hasVisibleErrors && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <strong>Please fix the following:</strong>
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

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onUploadPdf}
                disabled={!valid || busy}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  valid && !busy
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "bg-slate-200 text-slate-500 cursor-not-allowed"
                }`}
              >
                {busy ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Process & Upload
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setIsOpen(false);
                }}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
