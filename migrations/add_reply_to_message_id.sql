-- Add reply_to_message_id column to messages table for reply/quote feature
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Index for faster lookups when loading replied-to messages
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_message_id)
WHERE reply_to_message_id IS NOT NULL;
