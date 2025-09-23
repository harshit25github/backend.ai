import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import SQLite database (no connection needed)
import './src/config/database-sqlite.js';

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
    const { checkDatabaseHealth } = await import('./src/utils/database-sqlite.js');
    const dbHealth = await checkDatabaseHealth();

    res.json({
      status: dbHealth.status === 'OK' ? 'OK' : 'ERROR',
      message: 'Server is running with SQLite DB',
      timestamp: new Date().toISOString(),
      database: dbHealth
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
app.use('/api/chat-sqlite', pgChatRoutes); // SQLite-based routes (same code, different DB)

export default app;
