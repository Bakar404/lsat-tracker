import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  Layers3,
  Clock,
  CheckCircle2,
  LogIn,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

/*
  Stand‑alone page shown immediately after a user confirms their email.
  It:
    - Presents a friendly "awaiting admin approval" message.
    - Handles the case where the confirmation hash also contains error params
      (e.g. expired link) by redirecting the user to the existing /auth-callback
      page so they see the richer error messaging already implemented there.
    - If the user is already approved (edge case: admin approved very quickly
      or user re-visits link later with active session) it shows a shortcut
      button to enter the app.
*/
export default function AwaitingApproval({ onGoToLogin }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);

  useEffect(() => {
    const parseHashForErrors = () => {
      const rawHash = window.location.hash; // includes leading '#'
      const raw = rawHash.startsWith('#') ? rawHash.substring(1) : rawHash;
      const params = new URLSearchParams(raw.includes('?') ? raw.split('?')[1] : raw);
      const error = params.get("error");
      if (error) {
        // Preserve only the query portion (?error=...&error_code=...) when forwarding
        const queryIndex = rawHash.indexOf('?');
        const query = queryIndex !== -1 ? rawHash.slice(queryIndex) : '';
        window.location.hash = "/auth-callback" + query; // -> #/auth-callback?error=...
        return true;
      }
      return false;
    };

    if (parseHashForErrors()) return; // error path handled elsewhere

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user || null;
        setSessionUser(user);
        if (!user) {
          // User might not have an active session yet (e.g. email link opened on different device).
          // We still show the generic awaiting approval message.
          setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("approved, full_name")
          .eq("id", user.id)
          .maybeSingle();
        if (error) {
          console.error("Error fetching profile", error);
        } else {
          setProfile(data);
          setApproved(!!data?.approved);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleGoToApp = () => {
    window.location.hash = "/"; // root -> App decides (will show dashboard or pending inside dashboard)
  };

  const handleReturnToLogin = async () => {
    // Optional sign out so user returns to clean state
    try {
      await supabase.auth.signOut();
    } catch (_) {}
    onGoToLogin?.();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl mx-auto mb-4">
            <Layers3 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">LSAT Tracker</h1>
          <p className="text-slate-600 mt-2">Account Status</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          {loading ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Checking Status...
              </h2>
              <p className="text-slate-600">
                Please wait while we verify your account.
              </p>
            </div>
          ) : approved ? (
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Account Approved!
              </h2>
              <p className="text-slate-600 mb-6">
                Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}!
                Your email is confirmed and an admin has approved your account.
                You can now access the LSAT Tracker.
              </p>
              <button
                onClick={handleGoToApp}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
                Enter Application
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mx-auto mb-4">
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Email Confirmed!
              </h2>
              <p className="text-slate-600 mb-6">
                Your email has been successfully verified. Your account is now{" "}
                <strong className="font-semibold">
                  awaiting admin approval
                </strong>{" "}
                before you can access the LSAT Tracker.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-blue-800">
                  <strong>What happens next:</strong>
                  <br />
                  An administrator will review your account shortly. Once
                  approved, you will automatically receive an email letting you
                  know you can sign in.
                </p>
              </div>
              {sessionUser && (
                <p className="text-xs text-slate-500 mb-4">
                  Signed in as {sessionUser.email}
                </p>
              )}
              <button
                onClick={handleReturnToLogin}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors mb-3"
              >
                <LogIn className="w-4 h-4" />
                Return to Sign In
              </button>
              <p className="text-xs text-slate-500">
                Need help? Contact support.
              </p>
            </div>
          )}
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} LSAT Tracker. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
