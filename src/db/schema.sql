-- ============================================================================
-- Gateway Agent Database Schema for PostgreSQL
-- ============================================================================

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Table: conversations
-- Stores conversation metadata and current state
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active', -- active, completed, archived

    -- Context storage (JSONB for efficient querying)
    context JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Indexes
    CONSTRAINT conversations_chat_id_unique UNIQUE (chat_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_chat_id ON conversations(chat_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);

-- GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_conversations_context ON conversations USING GIN (context);

-- ============================================================================
-- Table: conversation_messages
-- Stores individual messages in conversations
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- user, assistant, system
    content TEXT NOT NULL,
    agent_name VARCHAR(255), -- Trip Planner Agent, Places Intelligence Agent, etc.

    -- Message metadata
    token_count INTEGER,
    duration_ms INTEGER,
    model_used VARCHAR(100),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Additional data (tool calls, function results, etc.)
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Foreign key
    CONSTRAINT fk_conversation FOREIGN KEY (chat_id)
        REFERENCES conversations(chat_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON conversation_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON conversation_messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON conversation_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_agent_name ON conversation_messages(agent_name);

-- ============================================================================
-- Table: context_snapshots
-- Stores context snapshots at specific points (optional - for debugging/history)
-- ============================================================================
CREATE TABLE IF NOT EXISTS context_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id VARCHAR(255) NOT NULL,
    snapshot_type VARCHAR(50), -- after_message, before_itinerary, etc.
    context JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_conversation_snapshot FOREIGN KEY (chat_id)
        REFERENCES conversations(chat_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_chat_id ON context_snapshots(chat_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON context_snapshots(created_at);

-- ============================================================================
-- Table: user_preferences (optional - for personalization)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) UNIQUE NOT NULL,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- ============================================================================
-- Trigger: Update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Views for common queries
-- ============================================================================

-- View: Recent conversations with message count
CREATE OR REPLACE VIEW conversation_summary AS
SELECT
    c.id,
    c.chat_id,
    c.user_id,
    c.created_at,
    c.updated_at,
    c.status,
    c.context->>'summary' as summary,
    COUNT(m.id) as message_count,
    MAX(m.created_at) as last_message_at
FROM conversations c
LEFT JOIN conversation_messages m ON c.chat_id = m.chat_id
GROUP BY c.id, c.chat_id, c.user_id, c.created_at, c.updated_at, c.status, c.context;

-- ============================================================================
-- Sample data insertion (optional - for testing)
-- ============================================================================

-- Insert sample conversation
-- INSERT INTO conversations (chat_id, user_id, context) VALUES
-- ('test-chat-001', 'user-123', '{
--     "summary": {
--         "destination": {"city": "Tokyo", "iata": "NRT"},
--         "origin": {"city": "New York", "iata": "JFK"}
--     },
--     "itinerary": {"days": []}
-- }'::jsonb);

-- Insert sample messages
-- INSERT INTO conversation_messages (chat_id, role, content, agent_name) VALUES
-- ('test-chat-001', 'user', 'I want to plan a trip to Tokyo', NULL),
-- ('test-chat-001', 'assistant', 'Great! Let me help you plan your trip...', 'Trip Planner Agent');
