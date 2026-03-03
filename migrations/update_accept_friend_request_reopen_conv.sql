-- Met à jour accept_friend_request pour réactiver la conversation privée si elle existait
CREATE OR REPLACE FUNCTION public.accept_friend_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sender_id   UUID;
  v_receiver_id UUID;
  v_conversation_id UUID;
BEGIN
  -- 1) On récupère la demande "pending"
  SELECT sender_id, receiver_id
  INTO v_sender_id, v_receiver_id
  FROM friend_requests
  WHERE id = p_request_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found or already processed';
  END IF;

  -- 2) On vérifie que c'est bien l'utilisateur connecté qui est le receiver
  IF v_receiver_id <> auth.uid() THEN
    RAISE EXCEPTION 'You are not allowed to accept this friend request';
  END IF;

  -- 3) On met la demande en "accepted"
  UPDATE friend_requests
  SET status = 'accepted',
      updated_at = NOW()
  WHERE id = p_request_id;

  -- 4) On crée l'amitié bidirectionnelle
  PERFORM create_bidirectional_friendship(v_sender_id, v_receiver_id);

  -- 5) Réactiver la conversation privée si elle existait
  SELECT cp1.conversation_id INTO v_conversation_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  JOIN conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = v_sender_id
    AND cp2.user_id = v_receiver_id
    AND c.is_group = false
    AND c.is_closed = true;

  IF v_conversation_id IS NOT NULL THEN
    UPDATE conversations
    SET is_closed = false,
        closed_reason = NULL,
        closed_at = NULL
    WHERE id = v_conversation_id;
  END IF;
END;
$$;
