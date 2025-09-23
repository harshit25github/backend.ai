import db from '../config/database-sqlite.js';

// SQLite database operations for chat context management

export const fetchContextFromDB = async (chatId) => {
  try {
    const stmt = db.prepare('SELECT summary, itinerary, user_info, conversation_state, trip FROM chat_contexts WHERE chat_id = ?');
    const row = stmt.get(chatId);

    if (!row) {
      console.log(`No context found for chatId: ${chatId}, will initialize new context`);
      return null;
    }

    console.log(`Fetched context for chatId: ${chatId}`);

    return {
      summary: JSON.parse(row.summary || '{}'),
      itinerary: JSON.parse(row.itinerary || '{}'),
      userInfo: JSON.parse(row.user_info || '{}'),
      conversationState: JSON.parse(row.conversation_state || '{}'),
      trip: JSON.parse(row.trip || '{}')
    };
  } catch (error) {
    console.error('Error fetching context from DB:', error);
    throw error;
  }
};

export const saveContextToDB = async (chatId, context) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO chat_contexts (chat_id, summary, itinerary, user_info, conversation_state, trip)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (chat_id) DO UPDATE SET
        summary = EXCLUDED.summary,
        itinerary = EXCLUDED.itinerary,
        user_info = EXCLUDED.user_info,
        conversation_state = EXCLUDED.conversation_state,
        trip = EXCLUDED.trip,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      chatId,
      JSON.stringify(context.summary || {}),
      JSON.stringify(context.itinerary || {}),
      JSON.stringify(context.userInfo || {}),
      JSON.stringify(context.conversationState || {}),
      JSON.stringify(context.trip || {})
    );

    console.log(`Context saved to DB for chatId: ${chatId}`);
  } catch (error) {
    console.error('Error saving context to DB:', error);
    throw error;
  }
};

export const appendMessageToDB = async (chatId, role, content, metadata = {}) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO chat_messages (chat_id, role, content, metadata)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(chatId, role, content, JSON.stringify(metadata));
  } catch (error) {
    console.error('Error appending message to DB:', error);
    throw error;
  }
};

export const getConversationHistory = async (chatId, limit = 10) => {
  try {
    const stmt = db.prepare(`
      SELECT role, content, created_at
      FROM chat_messages
      WHERE chat_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(chatId, limit);
    return rows.reverse(); // Return in chronological order
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    return [];
  }
};

export const getRecentChats = async (limit = 20) => {
  try {
    const stmt = db.prepare(`
      SELECT chat_id, updated_at, summary
      FROM chat_contexts
      ORDER BY updated_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit);
    return rows.map(row => ({
      chat_id: row.chat_id,
      updated_at: row.updated_at,
      summary: JSON.parse(row.summary || '{}')
    }));
  } catch (error) {
    console.error('Error fetching recent chats:', error);
    return [];
  }
};

export const deleteChatContext = async (chatId) => {
  try {
    const deleteMessages = db.prepare('DELETE FROM chat_messages WHERE chat_id = ?');
    const deleteContext = db.prepare('DELETE FROM chat_contexts WHERE chat_id = ?');

    deleteMessages.run(chatId);
    deleteContext.run(chatId);

    console.log(`Deleted context for chatId: ${chatId}`);
  } catch (error) {
    console.error('Error deleting chat context:', error);
    throw error;
  }
};

// Health check function
export const checkDatabaseHealth = async () => {
  try {
    const result = db.prepare('SELECT 1').get();
    return {
      status: 'OK',
      message: 'SQLite database connection successful'
    };
  } catch (error) {
    return {
      status: 'ERROR',
      message: error.message
    };
  }
};
