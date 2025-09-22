# Backend AI Chat

A REST-based backend for AI chat using OpenAI Agents SDK with Express.js.

## Project Structure

```
project/
├── server.js              # Express bootstrap
├── .env.example           # Environment variables template
├── README.md              # This file
├── package.json           # Dependencies and scripts
├── data/                  # Chat transcripts (gitignored)
└── src/
    ├── config/
    │   └── env.js         # Environment configuration + CORS
    ├── middleware/
    │   └── error.js       # Central error handling + 404
    ├── utils/
    │   └── fileStore.js   # Atomic JSON read/append/rotate by chatId
    ├── ai/
    │   └── agent.js       # OpenAI Agents SDK integration
    ├── routes/
    │   └── chat.js        # REST + SSE endpoints
    ├── tools/             # Custom tool implementations
    └── lib/               # Small helper utilities
```

## Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your OpenAI API key:
   ```env
   NODE_ENV=development
   PORT=3000
   OPENAI_API_KEY=your_openai_api_key_here
   CORS_ORIGIN=http://localhost:3000
   ```

## Installation & Running

```bash
# Install dependencies
npm install

# Start the server
npm start

# Development with auto-restart
npm run dev
```

## API Endpoints

### POST /api/chat/message
Send a message and get an immediate response.

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"chatId": "test-chat", "message": "Hello, how are you?"}'
```

Response:
```json
{
  "success": true,
  "chatId": "test-chat",
  "response": "Hello! I'm doing well, thank you for asking..."
}
```

### POST /api/chat/stream
Send a message and stream the AI response using Server-Sent Events.

```bash
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"chatId": "test-chat", "message": "Tell me a story"}'
```

### GET /api/chat/history/:chatId
Fetch conversation history.

```bash
curl http://localhost:3000/api/chat/history/test-chat
```

### DELETE /api/chat/clear/:chatId
Clear conversation history.

```bash
curl -X DELETE http://localhost:3000/api/chat/clear/test-chat
```

## Usage Examples

1. **Send a message and get immediate response:**
   ```bash
   curl -X POST http://localhost:3000/api/chat/message \
     -H "Content-Type: application/json" \
     -d '{"chatId": "my-chat", "message": "What is 2+2?"}'
   ```

2. **Stream a response (real-time):**
   ```bash
   curl -X POST http://localhost:3000/api/chat/stream \
     -H "Content-Type: application/json" \
     -d '{"chatId": "my-chat", "message": "Write a poem about coding"}'
   ```

3. **Check conversation history:**
   ```bash
   curl http://localhost:3000/api/chat/history/my-chat
   ```

## Features

- **REST API**: Standard HTTP endpoints for chat operations
- **Server-Sent Events**: Real-time streaming of AI responses
- **File-based Storage**: JSON transcripts stored per chatId in `data/`
- **OpenAI Agents SDK**: Proper integration using `@openai/agents` package
- **Conversation Context**: Maintains conversation history for context-aware responses
- **Error Handling**: Centralized error middleware with proper logging
- **CORS Support**: Configurable cross-origin resource sharing
- **Environment Config**: Flexible environment-based configuration