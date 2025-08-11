import React, { useState } from "react";

export default function UploadPanel({ disabled, onUpload }) {
  const [examNumber, setExamNumber] = useState("");
  const [examDate, setExamDate] = useState("");

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <h2 className="font-semibold mb-3">Transform & Upload Test</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <input
          value={examNumber}
          onChange={(e) => setExamNumber(e.target.value)}
          placeholder="Exam # (optional)"
          className="px-3 py-2 rounded-xl border text-sm"
          disabled={disabled}
        />
        <input
          type="date"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          className="px-3 py-2 rounded-xl border text-sm"
          disabled={disabled}
        />
        <label
          className={`inline-flex items-center justify-center px-3 py-2 rounded-xl ${
            disabled
              ? "bg-slate-200 text-slate-500 cursor-not-allowed"
              : "bg-slate-900 text-white cursor-pointer"
          }`}
        >
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f)
                onUpload({
                  file: f,
                  examNumberOverride: examNumber,
                  examDateOverride: examDate,
                });
            }}
          />
          Choose PDF & Upload
        </label>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        If your filename is generic, set Exam # and Exam date so the parser is
        correct.
      </p>
    </section>
  );
}
