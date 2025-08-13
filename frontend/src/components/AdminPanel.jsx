import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  Users,
  CheckCircle,
  XCircle,
  Mail,
  Calendar,
  UserCheck,
} from "lucide-react";

export default function AdminPanel({ user }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    setLoading(true);
    try {
      // Get all users from profiles table who are not approved
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("approved", false);

      if (profileError) throw profileError;

      // Get auth user details for each profile
      const usersWithAuth = await Promise.all(
        profiles.map(async (profile) => {
          const { data: authUser, error: authError } =
            await supabase.auth.admin.getUserById(profile.id);
          return {
            ...profile,
            email: authUser?.user?.email || "N/A",
            emailConfirmed: authUser?.user?.email_confirmed_at ? true : false,
            createdAt: authUser?.user?.created_at || profile.created_at,
          };
        })
      );

      setPendingUsers(usersWithAuth);
    } catch (error) {
      console.error("Error fetching pending users:", error);
    } finally {
      setLoading(false);
    }
  };

  const approveUser = async (userId) => {
    setActionLoading((prev) => ({ ...prev, [userId]: true }));

    try {
      // Update the user's profile to approved
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ approved: true })
        .eq("id", userId);

      if (updateError) throw updateError;

      // Call the Edge Function to send notification email
      try {
        const { data, error: functionError } = await supabase.functions.invoke(
          "notify-approved",
          {
            body: { user_id: userId },
          }
        );

        if (functionError) {
          console.error("Error sending notification email:", functionError);
          // Don't fail the approval if email fails
        } else {
          console.log("Notification email sent successfully:", data);
        }
      } catch (emailError) {
        console.error("Failed to send notification email:", emailError);
        // Don't fail the approval if email fails
      }

      // Refresh the pending users list
      await fetchPendingUsers();

      alert(
        "User approved successfully! Notification email sent (if configured)."
      );
    } catch (error) {
      console.error("Error approving user:", error);
      alert("Error approving user: " + error.message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const rejectUser = async (userId) => {
    if (
      !confirm(
        "Are you sure you want to reject this user? This will delete their account."
      )
    ) {
      return;
    }

    setActionLoading((prev) => ({ ...prev, [userId]: true }));

    try {
      // Delete from profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (profileError) throw profileError;

      // Delete from auth (requires admin privileges)
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);

      if (authError) {
        console.error("Error deleting auth user:", authError);
        // Profile is already deleted, so continue
      }

      // Refresh the pending users list
      await fetchPendingUsers();

      alert("User rejected and account deleted.");
    } catch (error) {
      console.error("Error rejecting user:", error);
      alert("Error rejecting user: " + error.message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <UserCheck className="w-6 h-6 text-slate-700" />
        <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full">
          {pendingUsers.length} pending
        </span>
      </div>

      {pendingUsers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-500 mb-2">
            No pending approvals
          </h3>
          <p className="text-slate-400">All users have been processed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingUsers.map((user) => (
            <div
              key={user.id}
              className="bg-white rounded-lg border border-slate-200 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-slate-900">
                      {user.full_name || "No name provided"}
                    </h3>
                    <div className="flex items-center gap-2">
                      {user.emailConfirmed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          Email Confirmed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          <XCircle className="w-3 h-3" />
                          Email Not Confirmed
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span>{user.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Signed up:{" "}
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => approveUser(user.id)}
                    disabled={actionLoading[user.id] || !user.emailConfirmed}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {actionLoading[user.id] ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        Approving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => rejectUser(user.id)}
                    disabled={actionLoading[user.id]}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>

              {!user.emailConfirmed && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ This user hasn't confirmed their email address yet. They
                    must confirm their email before you can approve their
                    account.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
