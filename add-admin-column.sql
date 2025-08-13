-- Add is_admin column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Make the first user (you) an admin - replace with your actual user ID
-- You can find your user ID in the Supabase dashboard under Authentication > Users
-- UPDATE profiles SET is_admin = TRUE WHERE id = 'your-user-id-here';

-- Example: UPDATE profiles SET is_admin = TRUE WHERE id = '12345678-1234-1234-1234-123456789012';
