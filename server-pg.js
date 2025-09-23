import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import database configuration
import pool from './src/config/database.js';

// Import routes
import chatRoutes from './src/routes/chat.js';
import pgChatRoutes from './src/routes/chat-pg.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await pool.query('SELECT 1');

    res.json({
      status: 'OK',
      message: 'Server is running with PG DB',
      timestamp: new Date().toISOString(),
      database: 'PostgreSQL connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Database connection failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API routes
app.use('/api/chat', chatRoutes); // Original JSON file-based routes
app.use('/api/chat-pg', pgChatRoutes); // New PostgreSQL-based routes

// Example endpoint showing how to migrate from JSON to PG
app.post('/api/migrate-context', async (req, res) => {
  try {
    const { chatId } = req.body;

    if (!chatId) {
      return res.status(400).json({ error: 'chatId is required' });
    }

    // Read from JSON file
    const fs = await import('fs/promises');
    const contextPath = `./data/contexts/${chatId}_context.json`;

    let jsonContext;
    try {
      const contextData = await fs.readFile(contextPath, 'utf8');
      jsonContext = JSON.parse(contextData);
    } catch (error) {
      return res.status(404).json({
        error: `Context file not found for chatId: ${chatId}`
      });
    }

    // Save to PostgreSQL
    const { saveContextToDB } = await import('./src/utils/database.js');
    await saveContextToDB(chatId, jsonContext);

    res.json({
      success: true,
      message: `Context migrated from JSON to PG DB for chatId: ${chatId}`,
      chatId: chatId
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ Database: PostgreSQL`);
  console.log(`📍 Original routes: http://localhost:${PORT}/api/chat`);
  console.log(`📍 PG DB routes: http://localhost:${PORT}/api/chat-pg`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 Migration: http://localhost:${PORT}/api/migrate-context`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

export default app;
