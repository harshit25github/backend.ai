# AI Chat Backend Frontend Tester

A comprehensive frontend interface for testing the AI Chat Backend APIs.

## Features

### 🎯 Chat Interface
- **Real-time Chat**: Send messages and receive responses
- **Streaming Support**: Test Server-Sent Events streaming
- **Chat History**: Load and view conversation history
- **Multiple Chats**: Switch between different chat IDs

### 🔧 API Testing
- **Connection Testing**: Check backend server status
- **Endpoint Testing**: Test all API endpoints automatically
- **Real-time Monitoring**: Monitor API responses and errors
- **Raw Data Display**: View JSON responses and stream data

### 📊 Monitoring
- **Server Status**: Real-time connection monitoring
- **Response Logs**: Detailed logging of all API calls
- **Stream Data**: Real-time display of streaming tokens
- **Error Handling**: Comprehensive error display and logging

## Quick Start

1. **Start the frontend server:**
   ```bash
   cd frontend
   node server.js
   ```

2. **Open in browser:**
   ```
   http://localhost:8080
   ```

3. **Make sure backend is running:**
   ```
   Backend should be running on http://localhost:3000
   ```

## Usage

### Basic Chat Testing
1. Enter a Chat ID (or use default)
2. Type a message
3. Click "Send Message" for immediate response
4. Click "Send & Stream" for real-time streaming
5. Use "Load History" to see conversation history
6. Use "Clear Chat" to delete conversation

### API Testing
1. Set the Backend URL (default: http://localhost:3000)
2. Click "Test Connection" to verify server status
3. Click "Test All Endpoints" to run comprehensive tests
4. Monitor results in the API Test Results section

### Response Monitoring
- **JSON Response**: View formatted API responses
- **Stream Data**: Monitor real-time streaming tokens
- **Logs**: Track all API calls and errors with timestamps

## API Endpoints Tested

- `POST /api/chat/message` - Send message and get response
- `POST /api/chat/stream` - Send message and stream response
- `GET /api/chat/history/:chatId` - Get conversation history
- `DELETE /api/chat/clear/:chatId` - Clear conversation

## Development

The frontend is built with vanilla HTML, CSS, and JavaScript:

- `index.html` - Main interface
- `css/style.css` - Styling and responsive design
- `js/api.js` - API integration layer
- `js/ui.js` - UI management and interactions
- `js/app.js` - Main application logic
- `server.js` - Simple HTTP server

## Configuration

Update the backend URL in the interface:
1. Change the "Backend URL" field in the UI
2. Or modify the default in `js/api.js`:
   ```javascript
   const chatAPI = new ChatAPI('http://your-backend-url:port');
   ```

## Troubleshooting

### CORS Issues
Make sure your backend has CORS enabled for the frontend origin:
```javascript
// In your backend config
cors: {
  origin: 'http://localhost:8080',
  credentials: true
}
```

### Connection Issues
1. Verify backend is running on correct port
2. Check backend URL in the frontend interface
3. Look at browser console for detailed error messages
4. Check the logs section in the frontend interface