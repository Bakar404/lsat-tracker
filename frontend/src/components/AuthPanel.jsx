// src/components/AuthPanel.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function AuthPanel({ onAuthed }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) onAuthed(session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [onAuthed]);

  const signUp = async () => {
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg(
      "Check your email to confirm your account. After you confirm, an admin must approve you."
    );
  };

  const signIn = async () => {
    setBusy(true);
    setMsg("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error) {
      // Friendly messages
      if (error.message.toLowerCase().includes("email not confirmed")) {
        return setMsg(
          "Email not confirmed yet. Please confirm via the link we sent."
        );
      }
      if (error.message.toLowerCase().includes("invalid login credentials")) {
        return setMsg("Invalid credentials. Double-check email/password.");
      }
      return setMsg(error.message);
    }
    // Signed in — RLS will still block data writes until admin flips profiles.approved = true
    onAuthed?.(data.user);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMsg("Signed out.");
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="grid sm:grid-cols-3 gap-2">
        <input
          className="px-3 py-2 rounded-xl border text-sm"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="px-3 py-2 rounded-xl border text-sm"
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={signIn}
            className={`px-3 py-2 rounded-xl text-white text-sm ${
              busy ? "bg-slate-400" : "bg-slate-900"
            }`}
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
          <button
            disabled={busy}
            onClick={signUp}
            className={`px-3 py-2 rounded-xl border text-sm ${
              busy
                ? "border-slate-300 text-slate-400"
                : "border-slate-300 text-slate-900"
            }`}
          >
            {busy ? "Signing up..." : "Sign up"}
          </button>
        </div>
      </div>
      {msg ? <p className="text-xs text-slate-600 mt-2">{msg}</p> : null}
      <button onClick={signOut} className="mt-2 text-xs underline">
        Sign out
      </button>
    </div>
  );
}
