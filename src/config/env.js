import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT) || 3000,
  openaiApiKey: process.env.OPENAI_API_KEY,
  cors: cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:8080',
      process.env.CORS_ORIGIN
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization',
      'Cache-Control',
      'Connection',
      'Accept',
      'Accept-Encoding',
      'Accept-Language'
    ],
    exposedHeaders: [
      'Content-Type',
      'Cache-Control',
      'Connection'
    ]
  })
};