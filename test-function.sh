#!/bin/bash

# Test the notify-approved Edge Function
# SECURITY: This script uses environment variables to avoid exposing secrets

# Check if required environment variables are set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set"
    echo ""
    echo "To use this script, first set your service role key:"
    echo "export SUPABASE_SERVICE_ROLE_KEY='your_service_role_key_here'"
    echo ""
    echo "You can find your service role key in:"
    echo "https://supabase.com/dashboard/project/yguclnshbucubicdgssk/settings/api"
    exit 1
fi

if [ -z "$1" ]; then
    echo "❌ Error: User ID is required"
    echo ""
    echo "Usage: $0 <USER_ID>"
    echo "Example: $0 12345678-1234-1234-1234-123456789012"
    echo ""
    echo "You can find user IDs in your Supabase dashboard:"
    echo "https://supabase.com/dashboard/project/yguclnshbucubicdgssk/auth/users"
    exit 1
fi

USER_ID="$1"
FUNCTION_URL="https://yguclnshbucubicdgssk.supabase.co/functions/v1/notify-approved"

echo "🧪 Testing notify-approved function..."
echo "📧 User ID: $USER_ID"
echo "🔗 Function URL: $FUNCTION_URL"
echo ""

# Test the function
curl -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\"}" \
  -w "\n\nHTTP Status: %{http_code}\nTotal time: %{time_total}s\n"

echo ""
echo "✅ Test complete!"
echo "📊 Check the logs at: https://supabase.com/dashboard/project/yguclnshbucubicdgssk/functions"
echo "Dashboard: https://supabase.com/dashboard/project/yguclnshbucubicdgssk/functions"
