import express from 'express';
import { config } from './src/config/env.js';
import { errorHandler, notFoundHandler } from './src/middleware/error.js';
import chatRoutes from './src/routes/chat.js';
import managerRoutes from './src/routes/manager.js';
import enhancedManagerRoutes from './src/routes/enhanced-manager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '10mb' }));
app.use(config.cors);

// Serve static assets (e.g., playground UI)
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'playground.html'));
});

app.use('/api/chat', chatRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/enhanced-manager', enhancedManagerRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
});
