/**
 * Diagnostic page to check backend and Supabase connectivity
 */
import React, { useState, useEffect } from "react";

export default function DiagnosticsPage() {
  const [results, setResults] = useState({
    supabase: "checking...",
    backend: "checking...",
  });

  useEffect(() => {
    const runDiagnostics = async () => {
      try {
        // Check Supabase
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          setResults((prev) => ({
            ...prev,
            supabase: "❌ Missing environment variables",
          }));
        } else {
          try {
            const res = await fetch(`${supabaseUrl}/rest/v1/`, {
              headers: {
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
              },
            });
            if (res.ok) {
              setResults((prev) => ({
                ...prev,
                supabase: `✅ Connected to ${supabaseUrl}`,
              }));
            } else {
              setResults((prev) => ({
                ...prev,
                supabase: `❌ HTTP ${res.status}: ${res.statusText}`,
              }));
            }
          } catch (err) {
            setResults((prev) => ({
              ...prev,
              supabase: `❌ ${err.message}`,
            }));
          }
        }

        // Check Backend
        const backendUrl =
          import.meta.env.VITE_TRANSFORMER_URL ||
          "http://localhost:8000/healthz";

        try {
          const res = await fetch(backendUrl);
          if (res.ok) {
            setResults((prev) => ({
              ...prev,
              backend: `✅ Backend responding`,
            }));
          } else {
            setResults((prev) => ({
              ...prev,
              backend: `❌ HTTP ${res.status}: ${res.statusText}`,
            }));
          }
        } catch (err) {
          setResults((prev) => ({
            ...prev,
            backend: `❌ ${err.message} (URL: ${backendUrl})`,
          }));
        }
      } catch (err) {
        console.error("Diagnostics error:", err);
      }
    };

    runDiagnostics();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-slate-900">
          System Diagnostics
        </h1>

        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              Supabase Status
            </h2>
            <p className="text-slate-600 font-mono">{results.supabase}</p>
            <div className="text-xs text-slate-500 mt-2">
              URL: {import.meta.env.VITE_SUPABASE_URL || "Not configured"}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              Backend Status
            </h2>
            <p className="text-slate-600 font-mono">{results.backend}</p>
            <div className="text-xs text-slate-500 mt-2">
              URL:{" "}
              {import.meta.env.VITE_TRANSFORMER_URL ||
                "http://localhost:8000/healthz"}
            </div>
          </div>
        </div>

        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-900 mb-2">
            Troubleshooting Tips:
          </h3>
          <ul className="text-sm text-amber-800 space-y-1 list-disc ml-4">
            <li>Check your internet connection</li>
            <li>
              Verify environment variables in /frontend/.env.local are correct
            </li>
            <li>Check Supabase status at https://status.supabase.com</li>
            <li>Make sure backend is running (if using local)</li>
            <li>Clear browser cache and reload</li>
          </ul>
        </div>

        <button
          onClick={() => (window.location.href = "/")}
          className="mt-8 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          Back to App
        </button>
      </div>
    </div>
  );
}
