-- Adjust room_messages table for Phase 5 Room Chat specification
DO $$ 
BEGIN
    -- Rename sender_id to user_id if sender_id exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_messages' AND column_name = 'sender_id') THEN
        ALTER TABLE room_messages RENAME COLUMN sender_id TO user_id;
    END IF;
END $$;

-- Make user_id nullable for system messages
ALTER TABLE room_messages ALTER COLUMN user_id DROP NOT NULL;

-- Add message_type if it doesn't exist
ALTER TABLE room_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(50) DEFAULT 'text';

-- Add metadata_json if it doesn't exist
ALTER TABLE room_messages ADD COLUMN IF NOT EXISTS metadata_json JSONB NULL;
