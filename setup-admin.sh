#!/bin/bash

# 🔒 SECURITY-CONSCIOUS SETUP SCRIPT

echo "🔒 Setting up LSAT Tracker Admin..."
echo ""
echo "⚠️  SECURITY REMINDER:"
echo "    - Never commit .env files to git"
echo "    - Keep your service role key secret"
echo "    - Only share anon keys (they're designed to be public)"
echo ""

echo "Next steps:"
echo "1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/yguclnshbucubicdgssk/editor"
echo "2. Run this SQL to add the admin column:"
echo "   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;"
echo ""
echo "3. Make yourself an admin by finding your user ID in the Authentication tab and running:"
echo "   UPDATE profiles SET is_admin = TRUE WHERE id = 'YOUR_USER_ID';"
echo ""
echo "4. Your Edge Function is deployed at:"
echo "   https://yguclnshbucubicdgssk.supabase.co/functions/v1/notify-approved"
echo ""
echo "🔐 For testing the Edge Function securely:"
echo "   export SUPABASE_SERVICE_ROLE_KEY='your_service_role_key'"
echo "   ./test-function.sh 'user_id_here'"
