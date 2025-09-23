# PostgreSQL Integration Guide for Chat Context Management

This guide shows how to integrate the chat context management system with PostgreSQL database instead of JSON files.

## 🎯 Overview

The system maintains the same multi-agent architecture but replaces JSON file storage with PostgreSQL:

- **Original System**: JSON files per chat (`/data/contexts/chat_id_context.json`)
- **New System**: PostgreSQL tables with JSONB columns
- **Same Logic**: Multi-agent system, tools, prompts, and extraction remain identical

## 🗄️ Database Schema

### Required Tables

```sql
-- Chat contexts table
CREATE TABLE chat_contexts (
    chat_id VARCHAR(255) PRIMARY KEY,
    summary JSONB DEFAULT '{}',
    itinerary JSONB DEFAULT '{}',
    user_info JSONB DEFAULT '{}',
    conversation_state JSONB DEFAULT '{}',
    trip JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat messages table (for conversation history)
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(255) NOT NULL REFERENCES chat_contexts(chat_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);
```

### Environment Variables

```env
# PostgreSQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chat_context_db
DB_USER=postgres
DB_PASSWORD=your_password

# Other existing environment variables
PORT=3000
NODE_ENV=development
```

## 📁 File Structure

```
src/
├── config/
│   └── database.js          # PG connection pool
├── utils/
│   └── database.js          # DB operations
└── routes/
    └── chat-pg.js          # PG-based chat routes

database/
└── schema.sql              # PG table creation scripts

server-pg.js                # Server with PG integration
```

## 🔧 Integration Steps

### 1. Database Setup

1. **Create Database:**
   ```sql
   CREATE DATABASE chat_context_db;
   ```

2. **Run Schema:**
   ```bash
   psql -d chat_context_db -f database/schema.sql
   ```

3. **Set Environment Variables:**
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=chat_context_db
   DB_USER=postgres
   DB_PASSWORD=your_password
   ```

### 2. Key Integration Points

#### Context Initialization

```javascript
// When context is null (new chat), initialize structure
const initializeContext = (dbContext = {}) => {
  return {
    userInfo: {
      preferences: []
    },
    summary: dbContext.summary || {
      origin: "",
      destination: "",
      outbound_date: "",
      duration_days: 0,
      budget: {
        amount: null,
        currency: "INR",
        per_person: true
      },
      tripTypes: [],
      placesOfInterests: []
    },
    itinerary: dbContext.itinerary || {
      days: [],
      computed: {
        duration_days: null,
        itinerary_length: null,
        matches_duration: false
      }
    },
    // ... rest of structure
  };
};
```

#### Database Operations

```javascript
// Fetch context (can be null)
const dbContext = await fetchContextFromDB(chatId);

// Initialize context structure
let context = initializeContext(dbContext);

// Use existing multi-agent system
const result = await run(gatewayAgent, input, { context });

// Save back to DB
await saveContextToDB(chatId, context);
```

### 3. API Endpoints

#### Message Endpoint
```http
POST /api/chat-pg/message
Content-Type: application/json

{
  "chatId": "test-chat-1",
  "message": "I want to plan a trip to Kerala"
}
```

#### Streaming Endpoint
```http
POST /api/chat-pg/stream
Content-Type: application/json

{
  "chatId": "test-chat-1",
  "message": "I want to plan a trip to Kerala"
}
```

#### Health Check
```http
GET /api/chat-pg/health
```

## 🔄 Migration from JSON to PG

### Option 1: One-time Migration

```javascript
// POST /api/migrate-context
{
  "chatId": "test-chat-1"
}
```

### Option 2: Gradual Migration

```javascript
// Check if context exists in DB
const dbContext = await fetchContextFromDB(chatId);

// If null, try to read from JSON file
if (!dbContext) {
  try {
    const contextData = await fs.readFile(`./data/contexts/${chatId}_context.json`);
    dbContext = JSON.parse(contextData);
    // Save to DB for future use
    await saveContextToDB(chatId, dbContext);
  } catch (error) {
    // Initialize new context
    dbContext = null;
  }
}
```

## 🏗️ Architecture Comparison

### Original (JSON Files)
```
User Request → chat.js → JSON File → Multi-Agent → JSON File
```

### New (PostgreSQL)
```
User Request → chat-pg.js → PG DB → Multi-Agent → PG DB
```

### Same Components
- ✅ **gatewayAgent**: Same multi-agent system
- ✅ **captureTripContext**: Same tool for context updates
- ✅ **itineraryExtractorAgent**: Same extraction logic
- ✅ **prompts.js**: Same prompt templates
- ✅ **multiAgentSystem.js**: All core logic identical

## 🎯 Benefits of PG Integration

1. **Scalability**: Handle thousands of concurrent chats
2. **Reliability**: ACID transactions, data persistence
3. **Analytics**: Query chat patterns, user preferences
4. **Backup**: Standard database backup procedures
5. **Performance**: Optimized queries, indexes
6. **Integration**: Connect with other services easily

## 🔍 Example Usage

### 1. New Chat (Null Context)
```javascript
// DB returns null for new chatId
const dbContext = await fetchContextFromDB('new-chat-1'); // null

// Initialize empty structure
const context = initializeContext(dbContext);

// Multi-agent system works the same
const result = await run(gatewayAgent, input, { context });

// Save to DB
await saveContextToDB('new-chat-1', context);
```

### 2. Existing Chat (With Context)
```javascript
// DB returns existing context
const dbContext = await fetchContextFromDB('existing-chat-1');
// { summary: {...}, itinerary: {...}, ... }

// Use existing data
const context = initializeContext(dbContext);

// Continue conversation with full context
const result = await run(gatewayAgent, input, { context });

// Update DB with changes
await saveContextToDB('existing-chat-1', context);
```

## 🧪 Testing

### Test Endpoints
```bash
# Health check
curl http://localhost:3000/api/chat-pg/health

# Test message
curl -X POST http://localhost:3000/api/chat-pg/message \
  -H "Content-Type: application/json" \
  -d '{"chatId":"test-pg-1","message":"Plan trip to Goa"}'

# Test streaming
curl -X POST http://localhost:3000/api/chat-pg/stream \
  -H "Content-Type: application/json" \
  -d '{"chatId":"test-pg-2","message":"Plan trip to Kerala"}'
```

## 📊 Database Monitoring

### Sample Queries

```sql
-- Get recent chats
SELECT chat_id, updated_at, summary->>'destination' as destination
FROM chat_contexts
ORDER BY updated_at DESC
LIMIT 10;

-- Get conversation history
SELECT role, content, created_at
FROM chat_messages
WHERE chat_id = 'test-chat-1'
ORDER BY created_at DESC
LIMIT 20;

-- Get chat statistics
SELECT
  COUNT(*) as total_chats,
  COUNT(CASE WHEN summary->>'destination' != '' THEN 1 END) as planned_trips,
  COUNT(CASE WHEN itinerary->'days' != '[]' THEN 1 END) as completed_itineraries
FROM chat_contexts;
```

## 🚀 Deployment

1. **Set up PostgreSQL** (AWS RDS, Google Cloud SQL, or self-hosted)
2. **Run migrations** on deployment
3. **Configure environment variables**
4. **Update server.js** to use `server-pg.js`
5. **Monitor database performance** and scale as needed

## 🔧 Customization

### Custom Context Fields

Add new fields to the context structure:

```javascript
const initializeContext = (dbContext = {}) => {
  return {
    // ... existing fields
    customField: dbContext.customField || null,
    preferences: dbContext.preferences || []
  };
};
```

### Custom Database Operations

Add new operations to `src/utils/database.js`:

```javascript
export const getUserStats = async (userId) => {
  // Custom query for user analytics
};
```

## 🎉 Summary

The PG integration maintains 100% compatibility with the existing multi-agent system while providing:

- **Better scalability** for production use
- **Data persistence** and reliability
- **Analytics capabilities** for insights
- **Standard backup/recovery** procedures
- **Integration options** with other services

The migration is seamless - existing JSON-based chats can be migrated to PG, and the same API endpoints work with the new backend.
