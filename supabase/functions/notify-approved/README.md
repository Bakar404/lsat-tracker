# LSAT Tracker - User Approval Notification Function

This Supabase Edge Function sends email notifications to users when their accounts are approved by an admin.

## Required Environment Variables

Make sure to set these environment variables in your Supabase project settings:

### Required:

- `SUPABASE_URL` - Your Supabase project URL (automatically provided by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (automatically provided by Supabase)

### Optional (for email notifications):

- `RESEND_API_KEY` - Your Resend API key for sending emails
- `FROM_EMAIL` - The "from" email address (defaults to "LSAT Tracker <noreply@resend.dev>")
- `SITE_URL` - Your app's URL (defaults to "https://bakar404.github.io/lsat-tracker/")

## Usage

This function is called when an admin approves a user account. It:

1. Looks up the user's email address using the Supabase Admin API
2. Sends a welcome/approval email via Resend (if configured)
3. Returns a success response

## Request Format

```json
{
  "user_id": "uuid-of-the-user-to-notify"
}
```

## Testing Locally

If you have Deno installed, you can test this function locally:

```bash
deno run --allow-net --allow-env index.ts
```

## Deployment

This function is automatically deployed when you push to your Supabase project. Make sure all required environment variables are set in your Supabase project settings under "Edge Functions" > "Environment Variables".
