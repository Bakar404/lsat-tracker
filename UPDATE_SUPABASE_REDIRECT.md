# Updating Supabase Email Confirmation Redirect

This guide explains how to configure Supabase so that after a user confirms their email they are sent to the new standalone "Awaiting Admin Approval" page instead of the generic auth callback or main app.

## 1. Determine the Redirect URL

Use the hash-based route that was added:

Local development:

```
http://localhost:5173/#/awaiting-approval
```

(Adjust the port if Vite is running on a different one.)

Production (GitHub Pages):

```
https://bakar404.github.io/lsat-tracker/#/awaiting-approval
```

## 2. Set Redirect in Supabase Dashboard

1. Go to https://app.supabase.com and open your project.
2. Navigate to: Authentication -> URL Configuration (left sidebar).
3. In the **Site URL** field keep your primary site (e.g. GitHub Pages URL) if already set.
4. Scroll to **Additional Redirect URLs**.
5. Add BOTH of these (one per line if you use multiple envs):
   - `http://localhost:5173/#/awaiting-approval`
   - `https://bakar404.github.io/lsat-tracker/#/awaiting-approval`
6. Click **Save**.

Supabase will only redirect to URLs present in the allow list. The hash (`#/awaiting-approval`) is preserved after redirect.

## 3. Ensure Sign Up Uses This URL

The code now sets `emailRedirectTo` for signups to the awaiting approval page in `LoginPage.jsx`:

```
emailRedirectTo: <base>#/awaiting-approval
```

No further change needed unless you refactor routing.

## 4. Handling Expired / Error Links

If the confirmation link is expired or contains an error, the user may still land with error parameters. The `AwaitingApproval` page detects `error` params and forwards to `#/auth-callback`, which already shows detailed error messaging and instructions to re-register.

## 5. Testing Checklist

- [ ] Sign up locally -> receive email -> confirm -> lands on Awaiting Approval page.
- [ ] While still pending (not approved in `profiles.approved`), refresh page: still shows awaiting message.
- [ ] Manually set `approved = true` in `profiles` then refresh `#/awaiting-approval` -> shows "Account Approved" button to enter app.
- [ ] Try using an already-used / expired confirmation link -> redirected to `#/auth-callback` with friendly error.
- [ ] Production signup (GitHub Pages) flows to production awaiting approval page.

## 6. Security Notes

- Do NOT put service role keys in the frontend env; only public anon key is used client-side.
- Ensure only admins can toggle `profiles.approved`.
- Edge Function continues to send approval notifications; no change required.

## 7. Rollback

If you ever want to revert to the generic callback, change the signup `emailRedirectTo` back to:

```
<site-url>#/auth-callback
```

and optionally remove the awaiting approval URLs from the allow list.

---

For any issues, consult `SECURITY_AUDIT.md` and verify no secret exposure when modifying redirects.
