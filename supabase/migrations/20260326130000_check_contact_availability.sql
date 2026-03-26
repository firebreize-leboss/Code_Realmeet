-- Fonction RPC pour vérifier l'unicité email/téléphone avant inscription
CREATE OR REPLACE FUNCTION public.check_contact_availability(
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  email_taken boolean := false;
  phone_taken boolean := false;
BEGIN
  -- Vérifier l'email dans auth.users
  IF p_email IS NOT NULL AND p_email != '' THEN
    SELECT EXISTS(
      SELECT 1 FROM auth.users WHERE lower(email) = lower(p_email)
    ) INTO email_taken;
  END IF;

  -- Vérifier le téléphone dans profiles (format international, ex: +33767989253)
  IF p_phone IS NOT NULL AND p_phone != '' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.profiles WHERE phone = p_phone
    ) INTO phone_taken;
  END IF;

  result := json_build_object(
    'email_taken', email_taken,
    'phone_taken', phone_taken
  );

  RETURN result;
END;
$$;
