-- Extend messages table for audio/voice note support

-- Drop existing check constraint and replace with one that includes 'audio'
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text', 'image', 'file', 'audio'));

-- Duration in seconds for audio messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS audio_duration INTEGER;

-- Whisper transcription result (nullable — populated async after upload)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS transcription TEXT;
