import express from 'express';
import { readConversation, appendMessage, clearConversation } from '../utils/fileStore.js';
import { runChatAgent, chatAgent } from '../ai/agent.js';
import { gatewayAgent, loadContext, saveContext, maybeExtractItineraryFromText, triggerItineraryExtractionIfNeeded, captureTripContext, formatPlacesArray } from '../ai/multiAgentSystem.js';
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

// Places are now generated as natural language strings from the beginning
// No formatting needed for display - context already contains the natural language format

router.options('/stream', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Connection');
  res.status(200).end();
});

router.post('/message', async (req, res, next) => {
  try {
    const { chatId, message, role = 'user' } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({ error: 'chatId and message are required' });
    }

    // Load existing context
    const context = await loadContext(chatId);
    console.log(`Loaded context for chat ${chatId}:`, context);

    // Load previous context for comparison (before any modifications)
    const previousContext = { ...context };

    await appendMessage(chatId, { role, content: message });

    const conversation = await readConversation(chatId);
    const conversationHistory = conversation.messages.slice(-10);

    // Prepare input - pass the message as an array with single message
    // The conversation history is handled via context persistence
    const input = [safeInput(message)];

    console.log('Running gateway agent with input:', input);

    // Run gateway agent with context
    let result;
    try {
      result = await run(gatewayAgent, input, {
        context: context
      });
    } catch (error) {
      if (error.message && (error.message.includes('Failed to serialize run state') || error.message.includes('Expected string, received array'))) {
        console.warn('Serialization error detected:', error.message);
        console.warn('Attempting with simplified input...');
        // Fallback: Try with just the current message
        try {
          result = await run(gatewayAgent, safeInput(message), {
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

    console.log('Gateway agent result:', result);

    const responseContent = result?.finalOutput || 'Sorry, I could not generate a response.';

    await appendMessage(chatId, {
      role: 'assistant',
      content: responseContent
    });

    // Proactive itinerary extraction if conditions are met
    await triggerItineraryExtractionIfNeeded(result, context, previousContext);

    // Fallback: Apply safety net parsing for itinerary if not already captured
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

router.post('/stream', async (req, res, next) => {
  try {
    const { chatId, message } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({ error: 'chatId and message are required' });
    }

    // Load existing context
    const context = await loadContext(chatId);
    console.log(`Loaded context for chat ${chatId}:`, context);

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

    console.log('Starting gateway agent stream for message:', message);
    let assistantResponse = '';

    try {
      // Prepare input - pass the message directly as string
      // The conversation history is handled via context persistence
      const input = [safeInput(message)];

      console.log('Running gateway agent with streaming...');

      // Run gateway agent with streaming and context
      let stream;
      try {
        stream = await run(gatewayAgent, input, {
          context: context,
          stream: true
        });
      } catch (error) {
        if (error.message && (error.message.includes('Failed to serialize run state') || error.message.includes('Expected string, received array'))) {
          console.warn('Serialization error detected in stream:', error.message);
          console.warn('Attempting with simplified input...');
          // Fallback: Try with just the current message
          try {
            stream = await run(gatewayAgent, [safeInput(message)], {
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

      console.log('Gateway agent stream created, using toTextStream...');

      const textStream = stream.toTextStream({ compatibleWithNodeStreams: true });

      textStream.on("data", (chunk) => {
        const content = chunk.toString();
        console.log('Stream chunk received:', content);
        assistantResponse += content;
        res.write(`data: ${JSON.stringify({ token: content, type: 'token' })}\n\n`);
      });

      textStream.on("end", async () => {
        console.log('Stream ended, waiting for completion...');
        try {
          await stream.completed;
          console.log('Gateway agent stream completed successfully');

          await appendMessage(chatId, {
            role: 'assistant',
            content: assistantResponse
          });

          // Proactive itinerary extraction if conditions are met
          await triggerItineraryExtractionIfNeeded({ finalOutput: assistantResponse }, context, previousContext);

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
          console.error('Error during gateway agent stream completion:', completionError);
          res.write(`data: ${JSON.stringify({ type: 'error', error: completionError.message })}\n\n`);
          res.end();
        }
      });

      textStream.on("error", (error) => {
        console.error('Gateway agent stream error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      });

    } catch (streamError) {
      console.error('Error creating gateway agent stream:', streamError);
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

router.get('/history/:chatId', async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const conversation = await readConversation(chatId);
    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

router.delete('/clear/:chatId', async (req, res, next) => {
  try {
    const { chatId } = req.params;
    await clearConversation(chatId);

    res.json({ success: true, message: 'Conversation cleared' });
  } catch (error) {
    next(error);
  }
});

// Add context viewing route for debugging
router.get('/context/:chatId', async (req, res, next) => {
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

export default router;