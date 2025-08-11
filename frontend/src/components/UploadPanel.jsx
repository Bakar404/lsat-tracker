import React, { useState } from "react";

export default function UploadPanel({ user, profile, onUploadPdf }) {
  return (
    <div>
      <label
        className={`inline-flex items-center justify-center px-3 py-2 rounded-xl ${
          user && profile?.approved
            ? "bg-slate-900 text-white cursor-pointer"
            : "bg-slate-200 text-slate-500 cursor-not-allowed"
        }`}
      >
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={!user || !profile?.approved}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUploadPdf(f);
          }}
        />
        Choose PDF & Upload
      </label>

      {user && !profile?.approved ? (
        <p className="text-sm text-amber-600 mt-2">
          Your account is awaiting approval. We’ll email you once it’s enabled.
        </p>
      ) : null}
    </div>
  );
}
