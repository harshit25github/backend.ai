import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readConversation, appendMessage, clearConversation } from '../utils/fileStore.js';
import { managerAgent } from '../ai/manager.js';
import { loadContext, saveContext } from '../ai/multiAgentSystem.js';
import { run, user } from '@openai/agents';

// Helper function to safely serialize input
const safeInput = (message) => {
  try {
    return user(message);
  } catch (error) {
    console.warn('Input serialization issue, using simplified format:', error.message);
    return { role: 'user', content: [{ type: 'input_text', text: String(message) }] };
  }
};

const router = express.Router();

// Context snapshot helper for manager pattern
function managerContextSnapshot(runContext) {
  const ctx = runContext?.context;
  if (!ctx) return '';

  const snapshot = {
    user: ctx.userInfo,
    trip: ctx.trip
  };
  return `\n\n[Local Context Snapshot]\n${JSON.stringify(snapshot, null, 2)}\n`;
}

router.options('/v2/stream', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Connection');
  res.status(200).end();
});

router.post('/v2/message', async (req, res, next) => {
  try {
    const { chatId, message, role = 'user' } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({ error: 'chatId and message are required' });
    }

    // Load existing context
    const context = await loadContext(chatId);
    console.log(`Loaded context for manager chat ${chatId}:`, context);

    // Load previous context for comparison (before any modifications)
    const previousContext = { ...context };

    await appendMessage(chatId, { role, content: message });

    const conversation = await readConversation(chatId);
    const conversationHistory = conversation.messages.slice(-10);

    // Prepare input - pass the message as an array with single message
    const input = [safeInput(message)];

    console.log('Running manager agent with input:', input);

    // Run manager agent with context
    let result;
    try {
      result = await run(managerAgent, input, {
        context: context
      });
    } catch (error) {
      if (error.message && (error.message.includes('Failed to serialize run state') || error.message.includes('Expected string, received array'))) {
        console.warn('Serialization error detected:', error.message);
        console.warn('Attempting with simplified input...');
        // Fallback: Try with just the current message
        try {
          result = await run(managerAgent, safeInput(message), {
            context: context
          });
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError.message);
          throw error; // Throw original error
        }
      } else {
        throw error;
      }
    }

    console.log('Manager agent result:', result);
    console.log('Context after manager run:', {
      summary: context.summary,
      trip: context.trip,
      itinerary: context.itinerary
    });

    const responseContent = result?.finalOutput || 'Sorry, I could not generate a response.';

    await appendMessage(chatId, {
      role: 'assistant',
      content: responseContent
    });

    // Proactive itinerary extraction if conditions are met
    if (typeof responseContent === 'string' && responseContent.trim().length > 0) {
      await maybeExtractItineraryFromText(String(responseContent), context);
    }

    // Save updated context
    await saveContext(chatId, context);

    res.json({
      success: true,
      chatId,
      response: responseContent,
      lastAgent: result.lastAgent?.name,
      context: context,
      debug: result
    });

  } catch (error) {
    next(error);
  }
});

router.post('/v2/stream', async (req, res, next) => {
  try {
    const { chatId, message } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({ error: 'chatId and message are required' });
    }

    // Load existing context
    const context = await loadContext(chatId);
    console.log(`Loaded context for manager stream ${chatId}:`, context);

    // Load previous context for comparison (before any modifications)
    const previousContext = { ...context };

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, Connection',
      'Access-Control-Expose-Headers': 'Content-Type, Cache-Control, Connection',
    });

    await appendMessage(chatId, { role: 'user', content: message });

    const conversation = await readConversation(chatId);
    const conversationHistory = conversation.messages.slice(-10);

    console.log('Starting manager agent stream for message:', message);
    let assistantResponse = '';

    try {
      // Prepare input - pass the message directly as string
      const input = [safeInput(message)];

      console.log('Running manager agent with streaming...');

      // Run manager agent with streaming and context
      let stream;
      try {
        stream = await run(managerAgent, input, {
          context: context,
          stream: true
        });
      } catch (error) {
        if (error.message && (error.message.includes('Failed to serialize run state') || error.message.includes('Expected string, received array'))) {
          console.warn('Serialization error detected in stream:', error.message);
          console.warn('Attempting with simplified input...');
          // Fallback: Try with just the current message
          try {
            stream = await run(managerAgent, [safeInput(message)], {
              context: context,
              stream: true
            });
          } catch (fallbackError) {
            console.error('Stream fallback also failed:', fallbackError.message);
            throw error; // Throw original error
          }
        } else {
          throw error;
        }
      }

      console.log('Manager agent stream created, using toTextStream...');

      const textStream = stream.toTextStream({ compatibleWithNodeStreams: true });

      textStream.on("data", (chunk) => {
        const content = chunk.toString();
        console.log('Manager stream chunk received:', content);
        assistantResponse += content;
        res.write(`data: ${JSON.stringify({ token: content, type: 'token' })}\n\n`);
      });

      textStream.on("end", async () => {
        console.log('Manager stream ended, waiting for completion...');
        try {
          await stream.completed;
          console.log('Manager agent stream completed successfully');

          await appendMessage(chatId, {
            role: 'assistant',
            content: assistantResponse
          });

          // Proactive itinerary extraction if conditions are met
          if (typeof assistantResponse === 'string' && assistantResponse.trim().length > 0) {
            await maybeExtractItineraryFromText(String(assistantResponse), context);
          }

          // Fallback: Apply safety net parsing for itinerary if not already captured
          if (typeof assistantResponse === 'string' && assistantResponse.trim().length > 0) {
            await maybeExtractItineraryFromText(String(assistantResponse), context);
          }

          // Save updated context
          await saveContext(chatId, context);

          res.write(`data: ${JSON.stringify({
            type: 'done',
            content: assistantResponse,
            lastAgent: stream.lastAgent?.name,
            context: context
          })}\n\n`);
          res.end();
        } catch (completionError) {
          console.error('Error during manager agent stream completion:', completionError);
          res.write(`data: ${JSON.stringify({ type: 'error', error: completionError.message })}\n\n`);
          res.end();
        }
      });

      textStream.on("error", (error) => {
        console.error('Manager agent stream error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      });

    } catch (streamError) {
      console.error('Error creating manager agent stream:', streamError);
      res.write(`data: ${JSON.stringify({ type: 'error', error: streamError.message })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('Route error:', error);
    if (!res.headersSent) {
      next(error);
    }
  }
});

router.get('/v2/history/:chatId', async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const conversation = await readConversation(chatId);
    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

router.delete('/v2/clear/:chatId', async (req, res, next) => {
  try {
    const { chatId } = req.params;
    await clearConversation(chatId);

    res.json({ success: true, message: 'Manager conversation cleared' });
  } catch (error) {
    next(error);
  }
});

// Add context viewing route for debugging
router.get('/v2/context/:chatId', async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const context = await loadContext(chatId);

    res.json({
      success: true,
      chatId,
      context
    });
  } catch (error) {
    next(error);
  }
});

// New stream-manager endpoint specifically for the updated manager agent
router.post('/stream-manager', async (req, res, next) => {
  try {
    const { chatId, message } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({ error: 'chatId and message are required' });
    }

    // Load existing context from JSON file based on chatId
    let context;
    const contextPath = path.resolve(`contexts/manager-context-${chatId}.json`);

    try {
      const contextData = await fs.readFile(contextPath, 'utf8');
      context = JSON.parse(contextData);
      console.log(`Loaded context for chatId ${chatId}:`, context);
    } catch (error) {
      // If context doesn't exist, create new one
      context = {
        userInfo: { name: 'User', uid: chatId },
        trip: {},
        logger: console,
      };
      console.log(`Created new context for chatId ${chatId}`);
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, Connection',
      'Access-Control-Expose-Headers': 'Content-Type, Cache-Control, Connection',
    });

    // Load existing conversation history from JSON file
    let thread = [];
    const historyPath = path.resolve(`contexts/manager-thread-${chatId}.json`);

    try {
      const historyData = await fs.readFile(historyPath, 'utf8');
      thread = JSON.parse(historyData);
      console.log(`Loaded thread history for chatId ${chatId}:`, thread.length, 'messages');
    } catch (error) {
      console.log(`No existing thread history for chatId ${chatId}, starting fresh`);
    }

    console.log('Starting manager agent stream for message:', message);
    let assistantResponse = '';

    try {
      // Add user message to thread
      const userMessage = user(message);
      thread.push(userMessage);

      console.log('Running manager agent with streaming...');

      // Run manager agent with streaming and context
      const stream = await run(managerAgent, thread, {
        context: context,
        stream: true
      });

      console.log('Manager agent stream created, using toTextStream...');

      const textStream = stream.toTextStream({ compatibleWithNodeStreams: true });

      textStream.on("data", (chunk) => {
        const content = chunk.toString();
        console.log('Manager stream chunk received:', content);
        assistantResponse += content;
        res.write(`data: ${JSON.stringify({ token: content, type: 'token' })}\n\n`);
      });

      textStream.on("end", async () => {
        console.log('Manager stream ended, waiting for completion...');
        try {
          await stream.completed;
          console.log('Manager agent stream completed successfully');

          // Update thread with complete response
          thread = stream.history || thread;

          // Save updated context to JSON file
          await fs.mkdir(path.dirname(contextPath), { recursive: true });
          await fs.writeFile(contextPath, JSON.stringify(context, null, 2), 'utf8');
          console.log(`Saved context for chatId ${chatId} to:`, contextPath);

          // Save updated conversation history to JSON file
          await fs.mkdir(path.dirname(historyPath), { recursive: true });
          await fs.writeFile(historyPath, JSON.stringify(thread, null, 2), 'utf8');
          console.log(`Saved thread history for chatId ${chatId} to:`, historyPath);

          res.write(`data: ${JSON.stringify({
            type: 'done',
            content: assistantResponse,
            lastAgent: stream.lastAgent?.name,
            context: {
              trip: context.trip,
              userInfo: context.userInfo
            }
          })}\n\n`);
          res.end();
        } catch (completionError) {
          console.error('Error during manager agent stream completion:', completionError);
          res.write(`data: ${JSON.stringify({ type: 'error', error: completionError.message })}\n\n`);
          res.end();
        }
      });

      textStream.on("error", (error) => {
        console.error('Manager agent stream error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      });

    } catch (streamError) {
      console.error('Error creating manager agent stream:', streamError);
      res.write(`data: ${JSON.stringify({ type: 'error', error: streamError.message })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('Route error:', error);
    if (!res.headersSent) {
      next(error);
    }
  }
});

export default router;
