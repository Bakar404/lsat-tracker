import React, { useEffect, useState } from "react";
import { supabase, TABLES } from "../lib/supabase";

export default function AuthPanel({ onAuthed }) {
  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const isAuthed = !!user;

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const approved = await isApproved(user.id);
        if (approved) {
          setUser(user);
          onAuthed(user);
        }
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_e, session) => {
        const u = session?.user ?? null;
        if (!u) {
          setUser(null);
          onAuthed(null);
          return;
        }
        const approved = await isApproved(u.id);
        if (approved) {
          setUser(u);
          onAuthed(u);
        } else {
          alert(
            "Your email is verified, but your account is awaiting admin approval."
          );
          await supabase.auth.signOut();
        }
      }
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  async function isApproved(userId) {
    const { data, error } = await supabase
      .from(TABLES.profiles)
      .select("approved")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error(error);
      return false;
    }
    return !!data?.approved;
  }

  async function signUp() {
    if (!email || !password) return alert("Email & password required.");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return alert(error.message);
    alert(
      "Sign-up successful. Check your email to confirm. After confirmation, an admin must approve your account."
    );
  }

  async function signIn() {
    if (!email || !password) return alert("Email & password required.");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return alert(error.message);
    const u = data.user;
    const approved = await isApproved(u.id);
    if (!approved) {
      alert(
        "Your account is not approved yet. Please wait for admin approval."
      );
      await supabase.auth.signOut();
      return;
    }
    setUser(u);
    onAuthed(u);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    onAuthed(null);
  }

  return (
    <div className="flex items-center gap-2">
      {!isAuthed ? (
        <>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="px-2 py-1.5 rounded-xl border text-sm"
            title="Auth mode"
          >
            <option value="signin">Sign in</option>
            <option value="signup">Sign up</option>
          </select>
          <input
            type="email"
            className="px-3 py-1.5 rounded-xl border text-sm"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            className="px-3 py-1.5 rounded-xl border text-sm"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "signup" ? (
            <button
              onClick={signUp}
              className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-sm"
            >
              Sign up
            </button>
          ) : (
            <button
              onClick={signIn}
              className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-sm"
            >
              Sign in
            </button>
          )}
        </>
      ) : (
        <>
          <span className="text-sm text-slate-600">{user.email}</span>
          <button
            onClick={signOut}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Sign out
          </button>
        </>
      )}
    </div>
  );
}
