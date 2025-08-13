import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { CheckCircle, AlertCircle, Layers3, ArrowLeft } from "lucide-react";

export default function AuthCallback({ onGoBack }) {
  const [status, setStatus] = useState("loading"); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the hash fragment from the URL
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1)
        );
        
        // Check for error parameters first
        const error = hashParams.get("error");
        const errorCode = hashParams.get("error_code");
        const errorDescription = hashParams.get("error_description");
        
        if (error) {
          setStatus("error");
          if (errorCode === "otp_expired") {
            setMessage(
              "Email confirmation link has expired. Please request a new confirmation email by signing up again."
            );
          } else if (error === "access_denied") {
            setMessage(
              "Email confirmation failed or was denied. Please try signing up again."
            );
          } else {
            setMessage(
              errorDescription || `Authentication error: ${error}`
            );
          }
          
          // Clear the hash from URL
          window.history.replaceState(null, null, window.location.pathname);
          return;
        }
        
        // Check for success parameters
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        if (type === "signup" && accessToken) {
          // Email confirmation successful
          setStatus("success");
          setMessage(
            "Email confirmed successfully! Your account is now verified, but requires admin approval before you can access the application."
          );

          // Clear the hash from URL
          window.history.replaceState(null, null, window.location.pathname);
        } else if (type === "recovery" && accessToken) {
          // Password recovery
          setStatus("success");
          setMessage(
            "Password reset confirmed! You can now sign in with your new password."
          );

          // Clear the hash from URL
          window.history.replaceState(null, null, window.location.pathname);
        } else {
          // Try to handle the session with Supabase auth
          const { data, error: sessionError } = await supabase.auth.getSession();

          if (sessionError) {
            setStatus("error");
            setMessage(`Authentication error: ${sessionError.message}`);
          } else if (data.session) {
            setStatus("success");
            setMessage("Authentication successful!");
          } else {
            setStatus("error");
            setMessage(
              "No valid authentication found. Please try signing in again."
            );
          }
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        setStatus("error");
        setMessage("An unexpected error occurred during authentication.");
      }
    };

    handleAuthCallback();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl mx-auto mb-4">
            <Layers3 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">LSAT Tracker</h1>
          <p className="text-slate-600 mt-2">Email Confirmation</p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          {status === "loading" && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Confirming Email...
              </h2>
              <p className="text-slate-600">
                Please wait while we verify your email confirmation.
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Email Confirmed!
              </h2>
              <p className="text-slate-600 mb-6">{message}</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Next Steps:</strong> Your account is awaiting admin
                  approval. You'll receive an email notification once your
                  account has been approved and you can start using the LSAT
                  Tracker.
                </p>
              </div>
              <button
                onClick={onGoBack}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to Sign In
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Confirmation Failed
              </h2>
              <p className="text-slate-600 mb-6">{message}</p>
              
              {message.includes("expired") && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-yellow-800">
                    <strong>What to do next:</strong> Email confirmation links expire after 24 hours for security. Simply sign up again with the same email address to receive a new confirmation link.
                  </p>
                </div>
              )}
              
              <div className="space-y-3">
                <button
                  onClick={onGoBack}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Return to Sign In
                </button>
                
                {message.includes("expired") && (
                  <p className="text-sm text-slate-500">
                    You can sign up again with the same email to get a new confirmation link.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-slate-500">
            Having trouble? Contact support for assistance.
          </p>
        </div>
      </div>
    </div>
  );
}
