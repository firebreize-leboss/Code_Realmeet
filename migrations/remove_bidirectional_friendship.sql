-- Fonction RPC pour supprimer une amitié dans les deux sens et fermer la conversation privée
CREATE OR REPLACE FUNCTION remove_bidirectional_friendship(p_friend_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_conversation_id uuid;
BEGIN
  -- 1) Supprimer les deux sens de l'amitié
  DELETE FROM friendships
  WHERE (user_id = v_user_id AND friend_id = p_friend_id)
     OR (user_id = p_friend_id AND friend_id = v_user_id);

  -- 2) Supprimer la friend_request associée
  DELETE FROM friend_requests
  WHERE (sender_id = v_user_id AND receiver_id = p_friend_id)
     OR (sender_id = p_friend_id AND receiver_id = v_user_id);

  -- 3) Trouver et fermer la conversation privée entre les deux
  SELECT cp1.conversation_id INTO v_conversation_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  JOIN conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = v_user_id
    AND cp2.user_id = p_friend_id
    AND c.is_group = false;

  IF v_conversation_id IS NOT NULL THEN
    UPDATE conversations
    SET is_closed = true,
        closed_reason = 'not_friends',
        closed_at = NOW()
    WHERE id = v_conversation_id;
  END IF;
END;
$$;
