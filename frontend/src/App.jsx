import React, { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import AuthCallback from "./components/AuthCallback";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentRoute, setCurrentRoute] = useState(window.location.hash.slice(1) || "/");

  // Simple hash router
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(window.location.hash.slice(1) || "/");
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Check for existing session on app load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
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
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Handle auth callback route
  if (currentRoute === "/auth-callback" || currentRoute.startsWith("/auth-callback")) {
    return <AuthCallback onGoBack={navigateToLogin} />;
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage onAuthed={setUser} />;
  }

  // Show dashboard if authenticated
  return <Dashboard user={user} onSignOut={handleSignOut} />;
}
