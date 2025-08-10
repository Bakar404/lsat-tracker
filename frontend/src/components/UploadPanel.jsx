import React, { useState } from "react";
import { Upload, Loader2 } from "lucide-react";

/**
 * Props:
 * - transformerUrl: string (required)
 * - onUploadSuccess: (allCsv: string, metaCsv: string) => void
 */
export default function UploadPanel({ transformerUrl, onUploadSuccess }) {
  const [examNumber, setExamNumber] = useState("");
  const [examDate, setExamDate] = useState(""); // YYYY-MM-DD
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onFileSelect = (f) => {
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError("Please select a PDF file.");
      setFile(null);
      return;
    }
    setError("");
    setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!file) {
      setError("Please choose a PDF.");
      return;
    }
    // Basic client validation (optional but helpful)
    if (examDate && !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) {
      setError("Exam date must be YYYY-MM-DD.");
      return;
    }

    try {
      setBusy(true);
      const fd = new FormData();
      fd.append("file", file);
      if (examNumber.trim()) fd.append("exam_number", examNumber.trim());
      if (examDate.trim()) fd.append("exam_date", examDate.trim());

      const res = await fetch(transformerUrl, { method: "POST", body: fd });
      if (!res.ok) {
        const maybeJson = await safeJson(res);
        const msg =
          (maybeJson && maybeJson.detail) || `Upload failed (${res.status})`;
        throw new Error(msg);
      }
      const contentType = res.headers.get("content-type") || "";
      let allCsv = "",
        metaCsv = "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        allCsv = json.all_sections_csv || json.all_sections_clean_scored || "";
        metaCsv = json.exam_metadata_csv || json.exam_metadata || "";
      } else {
        // Fallback: text body with a separator
        const text = await res.text();
        const parts = text.split("\n---META---\n");
        allCsv = parts[0] || text;
        metaCsv = parts[1] || "";
      }

      if (!allCsv.trim() || !metaCsv.trim()) {
        throw new Error("Transformer response missing one of the CSVs.");
      }

      onUploadSuccess(allCsv, metaCsv);
      // Reset the file input but keep exam # / date to speed multi-uploads
      setFile(null);
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <h2 className="font-semibold mb-3 flex items-center gap-2">
        <Upload className="w-4 h-4" /> Transform & Upload Test
      </h2>
      <form onSubmit={handleSubmit} className="grid gap-3">
        <div className="grid md:grid-cols-3 gap-2">
          <input
            value={examNumber}
            onChange={(e) => setExamNumber(e.target.value)}
            placeholder="Exam # (optional)"
            className="px-3 py-2 rounded-xl border text-sm"
          />
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            placeholder="YYYY-MM-DD"
            className="px-3 py-2 rounded-xl border text-sm"
          />
          <label className="inline-flex items-center justify-center px-3 py-2 rounded-xl border text-sm bg-slate-50 hover:bg-slate-100 cursor-pointer">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => onFileSelect(e.target.files?.[0] || null)}
            />
            {file ? file.name : "Choose PDF"}
          </label>
        </div>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <div>
          <button
            type="submit"
            disabled={busy || !file}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white ${
              busy || !file ? "bg-slate-400" : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {busy ? "Uploading..." : "Upload"}
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Tip: If your filename is generic, set Exam # and Exam date so the
          parser is correct.
        </p>
      </form>
    </section>
  );
}

async function safeJson(res) {
  try {
    return await res.clone().json();
  } catch {
    return null;
  }
}
