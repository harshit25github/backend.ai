import express from 'express';
import { config } from './src/config/env.js';
import { errorHandler, notFoundHandler } from './src/middleware/error.js';
import chatRoutes from './src/routes/chat.js';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(config.cors);

app.use('/api/chat', chatRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
});