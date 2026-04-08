-- Add FK from merchant_applications.user_id to profiles so PostgREST can join them
ALTER TABLE merchant_applications
  ADD CONSTRAINT merchant_applications_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
