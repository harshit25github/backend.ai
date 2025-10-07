import pg from 'pg';
const { Pool } = pg;

// ============================================================================
// PostgreSQL Connection Pool
// ============================================================================
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'travel_agent',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ============================================================================
// Context Management Functions
// ============================================================================

/**
 * Get or create conversation context from database
 * @param {string} chatId - Unique chat identifier
 * @param {string} userId - User identifier (optional)
 * @returns {Promise<Object>} - Conversation context
 */
export async function getOrCreateContext(chatId, userId = null) {
  const client = await pool.connect();
  try {
    // Try to get existing conversation
    let result = await client.query(
      'SELECT context FROM conversations WHERE chat_id = $1',
      [chatId]
    );

    if (result.rows.length > 0) {
      return result.rows[0].context;
    }

    // Create new conversation with default context
    const defaultContext = {
      userInfo: { preferences: [] },
      summary: {
        origin: { city: null, iata: null },
        destination: { city: null, iata: null },
        budget: { currency: 'INR', per_person: true },
        tripTypes: [],
        placesOfInterests: [],
        suggestedQuestions: []
      },
      itinerary: { days: [], computed: { matches_duration: true } },
      conversationState: { awaitingConfirmation: false },
      trip: {
        bookingStatus: 'pending',
        bookingConfirmed: false,
        bookingDetails: { flights: [], hotels: [], activities: [] }
      }
    };

    await client.query(
      `INSERT INTO conversations (chat_id, user_id, context)
       VALUES ($1, $2, $3)
       ON CONFLICT (chat_id) DO NOTHING`,
      [chatId, userId, JSON.stringify(defaultContext)]
    );

    return defaultContext;
  } finally {
    client.release();
  }
}

/**
 * Save conversation context to database
 * @param {string} chatId - Unique chat identifier
 * @param {Object} context - Updated context object
 */
export async function saveContext(chatId, context) {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE conversations
       SET context = $1, updated_at = CURRENT_TIMESTAMP
       WHERE chat_id = $2`,
      [JSON.stringify(context), chatId]
    );
  } finally {
    client.release();
  }
}

// ============================================================================
// Conversation History Functions
// ============================================================================

/**
 * Get conversation history (messages)
 * @param {string} chatId - Unique chat identifier
 * @param {number} limit - Number of messages to retrieve (default: 50)
 * @returns {Promise<Array>} - Array of messages
 */
export async function getConversationHistory(chatId, limit = 50) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT role, content, agent_name, created_at, metadata
       FROM conversation_messages
       WHERE chat_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [chatId, limit]
    );

    return result.rows.map(row => ({
      role: row.role,
      content: row.content,
      agentName: row.agent_name,
      createdAt: row.created_at,
      metadata: row.metadata
    }));
  } finally {
    client.release();
  }
}

/**
 * Add message to conversation history
 * @param {string} chatId - Unique chat identifier
 * @param {Object} message - Message object {role, content, agentName, metadata}
 */
export async function addMessage(chatId, message) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO conversation_messages (chat_id, role, content, agent_name, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        chatId,
        message.role,
        message.content,
        message.agentName || null,
        JSON.stringify(message.metadata || {})
      ]
    );
  } finally {
    client.release();
  }
}

// ============================================================================
// Complete Flow: Get Context + History
// ============================================================================

/**
 * Get complete conversation data (context + history)
 * @param {string} chatId - Unique chat identifier
 * @param {string} userId - User identifier (optional)
 * @returns {Promise<Object>} - {context, history}
 */
export async function getConversationData(chatId, userId = null) {
  const context = await getOrCreateContext(chatId, userId);
  const history = await getConversationHistory(chatId);

  return {
    context,
    history,
    conversationHistory: history.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Delete conversation and all associated data
 * @param {string} chatId - Unique chat identifier
 */
export async function deleteConversation(chatId) {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM conversations WHERE chat_id = $1', [chatId]);
  } finally {
    client.release();
  }
}

/**
 * Get conversation summary
 * @param {string} chatId - Unique chat identifier
 * @returns {Promise<Object>} - Conversation summary
 */
export async function getConversationSummary(chatId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
        c.chat_id,
        c.user_id,
        c.created_at,
        c.updated_at,
        c.status,
        c.context->>'summary' as summary,
        COUNT(m.id) as message_count
       FROM conversations c
       LEFT JOIN conversation_messages m ON c.chat_id = m.chat_id
       WHERE c.chat_id = $1
       GROUP BY c.chat_id, c.user_id, c.created_at, c.updated_at, c.status, c.context`,
      [chatId]
    );

    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Search conversations by user
 * @param {string} userId - User identifier
 * @param {number} limit - Number of conversations to retrieve
 * @returns {Promise<Array>} - Array of conversations
 */
export async function getUserConversations(userId, limit = 10) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM conversation_summary
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  } finally {
    client.release();
  }
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Test database connection
 * @returns {Promise<boolean>} - Connection status
 */
export async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

export async function closePool() {
  await pool.end();
}

process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});
