import React, { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import AuthCallback from "./components/AuthCallback";
import AwaitingApproval from "./components/AwaitingApproval";
import DiagnosticsPage from "./components/DiagnosticsPage";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentRoute, setCurrentRoute] = useState(
    window.location.hash.slice(1) || "/",
  );
  const [error, setError] = useState(null);

  // Simple hash router
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(window.location.hash.slice(1) || "/");
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Check for existing session on app load with timeout
  useEffect(() => {
    let isMounted = true;
    let timeoutId;

    const initAuth = async () => {
      try {
        // Add a timeout to prevent infinite loading
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error("Auth check timeout - Supabase may be unreachable"),
              ),
            8000,
          ),
        );

        const {
          data: { session },
        } = await Promise.race([sessionPromise, timeoutPromise]);

        if (isMounted) {
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        if (isMounted) {
          setError(err.message || "Failed to initialize authentication");
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const navigateToLogin = () => {
    window.location.hash = "/";
    setCurrentRoute("/");
  };

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-slate-600">Initializing...</p>
          <p className="text-xs text-slate-500">
            If this takes longer than 10 seconds, check your connection
          </p>
        </div>
      </div>
    );
  }

  // Show error if initialization failed
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
        <div className="flex flex-col items-center space-y-4 max-w-md text-center">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-2xl font-bold text-red-900">Connection Error</h1>
          <p className="text-red-700">{error}</p>
          <div className="text-sm text-red-600 space-y-2">
            <p>Please check:</p>
            <ul className="list-disc ml-4 text-left">
              <li>Your internet connection</li>
              <li>Supabase status at supabase.com/status</li>
              <li>Browser console for error messages</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => (window.location.hash = "#/diagnostics")}
              className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              Run Diagnostics
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Diagnostics route (accessible even if auth fails)
  if (currentRoute === "/diagnostics") {
    return <DiagnosticsPage />;
  }

  // New awaiting approval route (stand-alone page after email confirm)
  if (currentRoute === "/awaiting-approval") {
    return <AwaitingApproval onGoToLogin={navigateToLogin} />;
  }

  // Handle auth callback route
  if (
    currentRoute === "/auth-callback" ||
    currentRoute.startsWith("/auth-callback")
  ) {
    return <AuthCallback onGoBack={navigateToLogin} />;
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage onAuthed={setUser} />;
  }

  // Show dashboard if authenticated
  return <Dashboard user={user} onSignOut={handleSignOut} />;
}
