-- PostgreSQL Schema for Chat Context Management
-- Run this SQL to set up the required tables

-- Create database (run this separately if needed)
-- CREATE DATABASE chat_context_db;

-- Use the database
-- \c chat_context_db;

-- Create chat_contexts table to store context data
CREATE TABLE IF NOT EXISTS chat_contexts (
    chat_id VARCHAR(255) PRIMARY KEY,
    summary JSONB DEFAULT '{}',
    itinerary JSONB DEFAULT '{}',
    user_info JSONB DEFAULT '{}',
    conversation_state JSONB DEFAULT '{}',
    trip JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create chat_messages table to store conversation history
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(255) NOT NULL REFERENCES chat_contexts(chat_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_contexts_updated_at ON chat_contexts(updated_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_chat_contexts_updated_at
    BEFORE UPDATE ON chat_contexts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample data insertion (for testing)
-- INSERT INTO chat_contexts (chat_id, summary, itinerary, user_info, conversation_state, trip)
-- VALUES (
--     'test-chat-1',
--     '{
--         "origin": "Delhi",
--         "destination": "Kerala",
--         "outbound_date": "2025-10-15",
--         "return_date": "2025-10-22",
--         "duration_days": 7,
--         "budget": {"amount": 50000, "currency": "INR", "per_person": false},
--         "tripTypes": ["Leisure", "Cultural"],
--         "placesOfInterests": [
--             {"placeName": "Alleppey", "description": "Backwaters"},
--             {"placeName": "Munnar", "description": "Hills"}
--         ]
--     }',
--     '{
--         "days": [
--             {
--                 "title": "Day 1 - Arrival",
--                 "date": "2025-10-15",
--                 "segments": {
--                     "morning": [{"places": "Airport pickup", "duration_hours": 2, "descriptor": "arrival"}]
--                 }
--             }
--         ],
--         "computed": {"duration_days": 7, "itinerary_length": 1, "matches_duration": false}
--     }',
--     '{"preferences": []}',
--     '{"awaitingConfirmation": false}',
--     '{"bookingStatus": "pending", "bookingDetails": {"flights": [], "hotels": [], "activities": []}}'
-- );

-- Sample query to fetch context
-- SELECT chat_id, summary, itinerary FROM chat_contexts WHERE chat_id = 'test-chat-1';

-- Sample query to fetch conversation history
-- SELECT role, content, created_at
-- FROM chat_messages
-- WHERE chat_id = 'test-chat-1'
-- ORDER BY created_at DESC
-- LIMIT 10;

-- Sample query to get recent chats
-- SELECT chat_id, updated_at
-- FROM chat_contexts
-- ORDER BY updated_at DESC
-- LIMIT 20;
