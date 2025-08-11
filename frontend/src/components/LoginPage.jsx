import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { Layers3, Mail, Lock, User, CheckCircle } from "lucide-react";

export default function LoginPage({ onAuthed }) {
  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) return setMessage("Email and password required.");

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        return setMessage("Email not confirmed yet. Please check your inbox.");
      }
      if (error.message.toLowerCase().includes("invalid login credentials")) {
        return setMessage(
          "Invalid credentials. Please check your email and password."
        );
      }
      return setMessage(error.message);
    }

    onAuthed(data.user);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password) return setMessage("Email and password required.");

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    setLoading(false);

    if (error) return setMessage(error.message);

    setMessage(
      "Check your email to confirm your account. After confirmation, an admin must approve your account."
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl mb-4">
            <Layers3 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">LSAT Tracker</h1>
          <p className="text-slate-600 mt-2">
            Track your progress, improve your scores
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-200">
          {/* Tab Buttons */}
          <div className="flex mb-6">
            <button
              onClick={() => {
                setMode("signin");
                setMessage("");
              }}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                mode === "signin"
                  ? "bg-slate-900 text-white shadow-lg"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setMessage("");
              }}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ml-2 ${
                mode === "signup"
                  ? "bg-slate-900 text-white shadow-lg"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={mode === "signin" ? handleSignIn : handleSignUp}>
            <div className="space-y-4">
              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 rounded-xl font-medium transition-all ${
                  loading
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-slate-900 hover:bg-slate-800 active:scale-95"
                } text-white shadow-lg`}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    {mode === "signin" ? "Signing In..." : "Signing Up..."}
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    {mode === "signin" ? (
                      <>
                        <User className="w-5 h-5 mr-2" />
                        Sign In
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Create Account
                      </>
                    )}
                  </span>
                )}
              </button>
            </div>
          </form>

          {/* Message */}
          {message && (
            <div
              className={`mt-4 p-3 rounded-xl text-sm ${
                message.includes("Check your email") ||
                message.includes("admin")
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {message}
            </div>
          )}

          {/* Info */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              {mode === "signup" ? (
                <>
                  By signing up, you agree to our terms. After email
                  confirmation, an admin will approve your account.
                </>
              ) : (
                <>
                  Need an account?{" "}
                  <button
                    onClick={() => setMode("signup")}
                    className="text-slate-900 font-medium hover:underline"
                  >
                    Sign up here
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} LSAT Tracker. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
