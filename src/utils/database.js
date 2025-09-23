import pool from '../config/database.js';

// Database operations for chat context management

export const fetchContextFromDB = async (chatId) => {
  try {
    const result = await pool.query(
      'SELECT summary, itinerary, user_info, conversation_state, trip FROM chat_contexts WHERE chat_id = $1',
      [chatId]
    );

    if (result.rows.length === 0) {
      console.log(`No context found for chatId: ${chatId}, will initialize new context`);
      return null;
    }

    const row = result.rows[0];
    console.log(`Fetched context for chatId: ${chatId}`);

    return {
      summary: row.summary || null,
      itinerary: row.itinerary || null,
      userInfo: row.user_info || null,
      conversationState: row.conversation_state || null,
      trip: row.trip || null
    };
  } catch (error) {
    console.error('Error fetching context from DB:', error);
    throw error;
  }
};

export const saveContextToDB = async (chatId, context) => {
  try {
    await pool.query(`
      INSERT INTO chat_contexts (chat_id, summary, itinerary, user_info, conversation_state, trip)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (chat_id) DO UPDATE SET
        summary = EXCLUDED.summary,
        itinerary = EXCLUDED.itinerary,
        user_info = EXCLUDED.user_info,
        conversation_state = EXCLUDED.conversation_state,
        trip = EXCLUDED.trip,
        updated_at = NOW()
    `, [
      chatId,
      context.summary || {},
      context.itinerary || {},
      context.userInfo || {},
      context.conversationState || {},
      context.trip || {}
    ]);

    console.log(`Context saved to DB for chatId: ${chatId}`);
  } catch (error) {
    console.error('Error saving context to DB:', error);
    throw error;
  }
};

export const appendMessageToDB = async (chatId, role, content, metadata = {}) => {
  try {
    await pool.query(`
      INSERT INTO chat_messages (chat_id, role, content, metadata)
      VALUES ($1, $2, $3, $4)
    `, [chatId, role, content, metadata]);
  } catch (error) {
    console.error('Error appending message to DB:', error);
    throw error;
  }
};

export const getConversationHistory = async (chatId, limit = 10) => {
  try {
    const result = await pool.query(`
      SELECT role, content, created_at
      FROM chat_messages
      WHERE chat_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [chatId, limit]);

    // Return in chronological order (oldest first)
    return result.rows.reverse();
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    return [];
  }
};

export const getRecentChats = async (limit = 20) => {
  try {
    const result = await pool.query(`
      SELECT chat_id, updated_at, summary
      FROM chat_contexts
      ORDER BY updated_at DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  } catch (error) {
    console.error('Error fetching recent chats:', error);
    return [];
  }
};

export const deleteChatContext = async (chatId) => {
  try {
    // Delete messages first (due to foreign key constraint)
    await pool.query('DELETE FROM chat_messages WHERE chat_id = $1', [chatId]);
    // Then delete context
    await pool.query('DELETE FROM chat_contexts WHERE chat_id = $1', [chatId]);

    console.log(`Deleted context for chatId: ${chatId}`);
  } catch (error) {
    console.error('Error deleting chat context:', error);
    throw error;
  }
};

// Health check function
export const checkDatabaseHealth = async () => {
  try {
    const result = await pool.query('SELECT 1');
    return {
      status: 'OK',
      message: 'Database connection successful'
    };
  } catch (error) {
    return {
      status: 'ERROR',
      message: error.message
    };
  }
};
