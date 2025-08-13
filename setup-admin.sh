#!/bin/bash

# Apply the admin column migration directly to your Supabase database

echo "Applying admin column migration to Supabase..."

# Execute the SQL to add the is_admin column
supabase db remote commit --schema public

echo "Migration complete!"
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
