-- Add phone_verified column to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;
