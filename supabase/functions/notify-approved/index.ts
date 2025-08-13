import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@3";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Optional: init Resend
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = resendApiKey ? new Resend(resendApiKey) : null;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    console.log("Received request to notify approved user");

    const body = await req.json();
    const { user_id } = body;

    if (!user_id) {
      throw new Error("user_id is required");
    }

    console.log(`Processing approval notification for user: ${user_id}`);

    // Look up the user's email (from auth.users via Admin API)
    const { data: user, error } = await supabase.auth.admin.getUserById(
      user_id
    );

    if (error) {
      console.error("Error fetching user:", error);
      throw new Error(`Cannot find user: ${error.message}`);
    }

    if (!user?.user?.email) {
      throw new Error(`No email found for user ${user_id}`);
    }

    console.log(`Found user email: ${user.user.email}`);

    // Send the "approved" email (skip if no provider configured)
    if (resend) {
      console.log("Sending approval email via Resend...");

      const emailResult = await resend.emails.send({
        from: Deno.env.get("FROM_EMAIL") ?? "LSAT Tracker <noreply@resend.dev>",
        to: user.user.email!,
        subject: "✅ You're approved — welcome to LSAT Tracker",
        html: `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:32px 0">
              <tr><td>
                <table width="600" align="center" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.06)">
                  <tr>
                    <td style="background:#111827;color:#fff;padding:20px 24px;font-size:18px;font-weight:600">
                      LSAT Tracker — Access Approved
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px;color:#111827">
                      <p style="font-size:16px;margin:0 0 12px">Hi ${
                        user.user.email?.split("@")[0] || "there"
                      },</p>
                      <p style="font-size:16px;margin:0 0 12px">
                        Your account has been approved! You can now sign in and start uploading your LSAT tests to track your progress.
                      </p>
                      <p style="margin:0 0 20px">
                        <a href="${
                          Deno.env.get("SITE_URL") ??
                          "https://bakar404.github.io/lsat-tracker/"
                        }" 
                           style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">
                          Open LSAT Tracker
                        </a>
                      </p>
                      <p style="font-size:14px;color:#6b7280;margin:0 0 8px">
                        <strong>What you can do now:</strong>
                      </p>
                      <ul style="font-size:14px;color:#6b7280;margin:0 0 16px;padding-left:20px">
                        <li>Upload your LSAT practice test PDFs</li>
                        <li>Track your progress across different sections</li>
                        <li>Analyze your performance trends</li>
                        <li>Export your data for further analysis</li>
                      </ul>
                      <p style="font-size:13px;color:#6b7280;margin:0">
                        If you didn't request this account, you can ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </div>`,
      });

      console.log("Email sent successfully:", emailResult);
    } else {
      console.log("No email provider configured, skipping email notification");
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: "User notification sent successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (e) {
    console.error("Error in notify-approved function:", e);

    return new Response(
      JSON.stringify({
        ok: false,
        error: `${e}`,
        message: "Failed to send user notification",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
