# PostgreSQL Database Setup Guide

Complete guide to set up PostgreSQL integration for the Gateway Agent.

---

## 📋 Prerequisites

- PostgreSQL 12+ installed
- Node.js 18+ with `pg` package

---

## 🚀 Quick Setup

### 1. Install PostgreSQL Package

```bash
npm install pg
```

### 2. Create Database

```sql
CREATE DATABASE travel_agent;
```

### 3. Run Schema

```bash
psql -U postgres -d travel_agent -f src/db/schema.sql
```

Or manually execute `src/db/schema.sql` in your PostgreSQL client.

### 4. Configure Environment Variables

Create/update `.env`:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=travel_agent
DB_USER=postgres
DB_PASSWORD=your_password_here
```

### 5. Add Route to Server

Update `server.js`:

```javascript
import chatWithDbRoutes from './src/routes/chat-with-db.js';

// Add route
app.use('/api/chat-db', chatWithDbRoutes);
```

---

## 📁 Files Created

### 1. **`src/db/schema.sql`**
Database schema with tables:
- `conversations` - Stores context and metadata
- `conversation_messages` - Stores message history
- `context_snapshots` - Optional debugging/history
- `user_preferences` - Optional user personalization

### 2. **`src/db/conversationDb.js`**
Database functions:
- `getOrCreateContext()` - Get or create conversation
- `saveContext()` - Save updated context
- `getConversationHistory()` - Get message history
- `addMessage()` - Add message to history
- `getConversationData()` - Get context + history together

### 3. **`src/routes/chat-with-db.js`**
API routes with database integration:
- `POST /api/chat-db/message` - Non-streaming chat
- `POST /api/chat-db/stream` - Streaming chat
- `GET /api/chat-db/context/:chatId` - Get context
- `GET /api/chat-db/history/:chatId` - Get history
- `DELETE /api/chat-db/conversation/:chatId` - Delete conversation

---

## 🔧 Usage Examples

### Basic Chat Request

```javascript
// Send message (non-streaming)
const response = await fetch('http://localhost:3000/api/chat-db/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chatId: 'user-session-123',
    userId: 'user-456', // optional
    message: 'I want to plan a trip to Tokyo'
  })
});

const data = await response.json();
console.log(data.response); // Agent's response
console.log(data.context); // Updated context
console.log(data.itinerary); // Itinerary (if created)
```

### Streaming Chat Request

```javascript
// Send message (streaming)
const response = await fetch('http://localhost:3000/api/chat-db/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chatId: 'user-session-123',
    userId: 'user-456',
    message: 'Create a detailed itinerary'
  })
});

// Process SSE stream
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  // Parse SSE events...
}
```

### Get Context

```javascript
// Retrieve saved context
const response = await fetch('http://localhost:3000/api/chat-db/context/user-session-123');
const data = await response.json();
console.log(data.context);
```

### Get History

```javascript
// Retrieve conversation history
const response = await fetch('http://localhost:3000/api/chat-db/history/user-session-123');
const data = await response.json();
console.log(data.messages); // All messages
```

---

## 🔍 How It Works

### Flow Diagram

```
Client Request
     ↓
1. Get context + history from PostgreSQL
     ↓
2. Add user message to DB
     ↓
3. Feed context + history to LLM
     ↓
4. LLM generates response
     ↓
5. Add assistant message to DB
     ↓
6. Save updated context to DB
     ↓
Response sent to client
```

### Database Schema

```
conversations (main table)
├── id (UUID)
├── chat_id (VARCHAR, unique)
├── user_id (VARCHAR)
├── context (JSONB) ← Full context stored here
├── created_at
└── updated_at

conversation_messages (history)
├── id (UUID)
├── chat_id (VARCHAR)
├── role (user/assistant/system)
├── content (TEXT)
├── agent_name (VARCHAR)
└── created_at
```

### Context Storage

Context is stored as JSONB in PostgreSQL:

```json
{
  "userInfo": { "preferences": [] },
  "summary": {
    "origin": { "city": "New York", "iata": "JFK" },
    "destination": { "city": "Tokyo", "iata": "NRT" },
    "outbound_date": "2026-04-10",
    "return_date": "2026-04-15",
    "duration_days": 5,
    "passenger_count": 2,
    "budget": { "amount": 3000, "currency": "USD" }
  },
  "itinerary": {
    "days": [ /* 5-day itinerary */ ]
  }
}
```

---

## 🎯 Benefits of Database Integration

### ✅ **Persistent Storage**
- Context survives server restarts
- History preserved across sessions

### ✅ **Scalability**
- Multiple users, multiple conversations
- No file system bottlenecks

### ✅ **Query Power**
- Search conversations by user
- Filter by date, status, etc.
- Efficient JSONB queries

### ✅ **Analytics**
- Track message counts
- Monitor user engagement
- Analyze conversation patterns

---

## 🔒 Security Considerations

### 1. Environment Variables
Never commit `.env` to git:

```bash
# .gitignore
.env
.env.local
```

### 2. SQL Injection Prevention
All queries use parameterized statements:

```javascript
// ✅ Safe
client.query('SELECT * FROM conversations WHERE chat_id = $1', [chatId]);

// ❌ Never do this
client.query(`SELECT * FROM conversations WHERE chat_id = '${chatId}'`);
```

### 3. User Isolation
Associate conversations with `userId`:

```javascript
await getConversationData(chatId, userId);
```

### 4. Connection Pooling
Limited connections prevent resource exhaustion:

```javascript
max: 20,  // Maximum 20 connections
idleTimeoutMillis: 30000,
```

---

## 📊 Monitoring & Maintenance

### Check Connection Health

```javascript
import { testConnection } from './src/db/conversationDb.js';

const isHealthy = await testConnection();
console.log('Database:', isHealthy ? 'Connected' : 'Disconnected');
```

### View Active Conversations

```sql
SELECT * FROM conversation_summary
ORDER BY updated_at DESC
LIMIT 10;
```

### Clean Old Conversations

```sql
-- Delete conversations older than 30 days
DELETE FROM conversations
WHERE updated_at < NOW() - INTERVAL '30 days'
  AND status = 'completed';
```

### Monitor Database Size

```sql
SELECT
  pg_size_pretty(pg_database_size('travel_agent')) as db_size;
```

---

## 🐛 Troubleshooting

### Connection Refused

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Or on Windows
sc query postgresql-x64-14
```

### Permission Denied

```sql
-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE travel_agent TO your_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
```

### Cannot Create Extension

```sql
-- Run as superuser
psql -U postgres
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## 🔄 Migration from File Storage

If migrating from file-based storage:

```javascript
import fs from 'fs/promises';
import { getOrCreateContext, saveContext } from './src/db/conversationDb.js';

// Migrate existing conversations
const files = await fs.readdir('./data/contexts');

for (const file of files) {
  const chatId = file.replace('_context.json', '');
  const data = await fs.readFile(`./data/contexts/${file}`, 'utf8');
  const context = JSON.parse(data);

  await saveContext(chatId, context);
  console.log(`Migrated: ${chatId}`);
}
```

---

## 📈 Performance Tips

### 1. Index Optimization
Schema includes indexes for common queries:
- `chat_id` (unique, primary lookup)
- `user_id` (filter by user)
- `created_at` / `updated_at` (time-based queries)
- GIN index on JSONB for deep queries

### 2. Connection Pooling
Reuse connections instead of creating new ones:

```javascript
// ✅ Good - uses pool
const { context } = await getConversationData(chatId);

// ❌ Bad - creates new connection each time
```

### 3. Batch Operations
For multiple operations, use transactions:

```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(/* query 1 */);
  await client.query(/* query 2 */);
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

---

## ✅ Testing

### 1. Test Database Connection

```bash
node -e "import('./src/db/conversationDb.js').then(m => m.testConnection().then(r => console.log('Connected:', r)))"
```

### 2. Create Test Conversation

```javascript
import { getOrCreateContext, addMessage, saveContext } from './src/db/conversationDb.js';

const chatId = 'test-' + Date.now();

// Create context
const context = await getOrCreateContext(chatId, 'user-123');

// Add messages
await addMessage(chatId, { role: 'user', content: 'Hello' });
await addMessage(chatId, { role: 'assistant', content: 'Hi there!' });

// Update context
context.summary.destination.city = 'Tokyo';
await saveContext(chatId, context);

console.log('Test conversation created:', chatId);
```

---

## 🚀 Production Deployment

### Environment Variables

```env
# Production Database
DB_HOST=your-db-host.com
DB_PORT=5432
DB_NAME=travel_agent_prod
DB_USER=prod_user
DB_PASSWORD=secure_password_here

# SSL Configuration (recommended for production)
DB_SSL=true
```

### SSL Configuration

```javascript
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
});
```

---

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [node-postgres Documentation](https://node-postgres.com/)
- [JSONB Operators](https://www.postgresql.org/docs/current/functions-json.html)

---

**Status:** ✅ Ready for integration
**Last Updated:** October 7, 2025
