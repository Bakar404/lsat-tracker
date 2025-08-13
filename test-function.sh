#!/bin/bash

# Test the notify-approved Edge Function
# Replace USER_ID with an actual user ID from your auth.users table

FUNCTION_URL="https://yguclnshbucubicdgssk.supabase.co/functions/v1/notify-approved"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlndWNsbnNoYnVjdWJpY2Rnc3NrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDg2ODkwOCwiZXhwIjoyMDcwNDQ0OTA4fQ.dhgg1y5zrz1zN_SyRxDcnGePoiBg-74VK_kd8lzJoZA"

echo "Testing notify-approved function..."
echo "Note: Replace USER_ID with an actual user ID from your database"
echo ""

# Example test call (you'll need to replace USER_ID with a real one)
curl -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "REPLACE_WITH_ACTUAL_USER_ID"}'

echo ""
echo "Function URL: $FUNCTION_URL"
echo "Dashboard: https://supabase.com/dashboard/project/yguclnshbucubicdgssk/functions"
