import Database from 'better-sqlite3';

// SQLite database for testing
const db = new Database('./data/chat_context.db');

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_contexts (
    chat_id TEXT PRIMARY KEY,
    summary TEXT DEFAULT '{}',
    itinerary TEXT DEFAULT '{}',
    user_info TEXT DEFAULT '{}',
    conversation_state TEXT DEFAULT '{}',
    trip TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT DEFAULT '{}',
    FOREIGN KEY (chat_id) REFERENCES chat_contexts(chat_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_chat_contexts_updated_at ON chat_contexts(updated_at);
`);

export default db;
