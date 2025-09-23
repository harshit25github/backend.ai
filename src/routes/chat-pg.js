import express from 'express';
import { run } from '@openai/agents-core';
import { user } from '@openai/agents-core';
import { gatewayAgent } from '../ai/multiAgentSystem.js';
import { captureTripContext } from '../ai/multiAgentSystem.js';
import { triggerItineraryExtractionIfNeeded } from '../ai/multiAgentSystem.js';
import {
  fetchContextFromDB,
  saveContextToDB,
  appendMessageToDB,
  getConversationHistory,
  checkDatabaseHealth
} from '../utils/database-sqlite.js';
import { maybeExtractItineraryFromText, structuredItineraryExtractor } from '../ai/multiAgentSystem.js';

const router = express.Router();

// Helper function to safely serialize input
const safeInput = (message) => {
  try {
    return user(message);
  } catch (error) {
    console.warn('Input serialization issue, using simplified format:', error.message);
    return { role: 'user', content: [{ type: 'input_text', text: String(message) }] };
  }
};

// Helper function to initialize context structure if null
const initializeContext = (dbContext = {}) => {
  return {
    userInfo: {
      preferences: []
    },
    summary: dbContext.summary || {
      origin: "",
      destination: "",
      outbound_date: "",
      return_date: "",
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
    conversationState: {
      awaitingConfirmation: false,
      currentAgent: "Trip Planner Agent",
      lastIntent: null
    },
    trip: {
      bookingStatus: "pending",
      bookingConfirmed: false,
      bookingDetails: {
        flights: [],
        hotels: [],
        activities: []
      }
    }
  };
};


// Chat message endpoint with PG DB integration
router.post('/message', async (req, res) => {
  try {
    const { chatId, message } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({
        error: 'chatId and message are required'
      });
    }

    console.log(`Processing message for chatId: ${chatId}`);

    // 1. Fetch context from PG DB (can be null)
    const dbContext = await fetchContextFromDB(chatId);
    console.log('Fetched DB context:', dbContext);

    // 2. Initialize context structure
    let context = initializeContext(dbContext);
    const previousContext = { ...context };

    // 3. Add/update conversation history in DB
    await appendMessageToDB(chatId, 'user', message);

    // 4. Prepare input for agent
    const input = [safeInput(message)];

    console.log('Running gateway agent with input:', input);

    // 5. Run gateway agent with context
    let result;
    try {
      result = await run(gatewayAgent, input, {
        context: context
      });
    } catch (error) {
      if (error.message && (error.message.includes('Failed to serialize run state') || error.message.includes('Expected string, received array'))) {
        console.warn('Serialization error detected:', error.message);
        console.warn('Attempting with simplified input...');

        try {
          result = await run(gatewayAgent, [safeInput(message)], {
            context: context
          });
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError.message);
          throw error;
        }
      } else {
        throw error;
      }
    }

    const assistantResponse = result.toText();

    // 6. Proactive itinerary extraction if needed
    await triggerItineraryExtractionIfNeeded(result, context, previousContext);

    // 7. Fallback extraction from response text
    maybeExtractItineraryFromText(String(assistantResponse), context);

    // 8. Save updated context to PG DB
    await saveContextToDB(chatId, context);

    // 9. Add assistant response to conversation history
    await appendMessageToDB(chatId, 'assistant', assistantResponse);

    // 10. Return response
    res.json({
      success: true,
      chatId: chatId,
      response: assistantResponse,
      lastAgent: result.agent?.name || 'Trip Planner Agent',
      context: context, // Return current context for debugging
      debug: {
        state: result.trace?.state,
        agent: result.agent
      }
    });

  } catch (error) {
    console.error('Error in PG chat message:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Streaming chat endpoint with PG DB integration
router.post('/stream', async (req, res) => {
  try {
    const { chatId, message } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({
        error: 'chatId and message are required'
      });
    }

    console.log(`Starting PG DB stream for chatId: ${chatId}`);
    let assistantResponse = '';

    try {
      // 1. Fetch context from PG DB
      const dbContext = await fetchContextFromDB(chatId);
      let context = initializeContext(dbContext);
      const previousContext = { ...context };

      // 2. Add user message to conversation
      await appendMessageToDB(chatId, 'user', message);

      // 3. Prepare input for streaming
      const input = [safeInput(message)];

      console.log('Running gateway agent with streaming...');

      // 4. Run gateway agent with streaming and context
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

          try {
            stream = await run(gatewayAgent, [safeInput(message)], {
              context: context,
              stream: true
            });
          } catch (fallbackError) {
            console.error('Stream fallback also failed:', fallbackError.message);
            throw error;
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
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      });

      textStream.on("end", async () => {
        console.log('Stream ended, processing final context...');

        try {
          // 5. Proactive extraction after stream completion
          await triggerItineraryExtractionIfNeeded({ finalOutput: assistantResponse }, context, previousContext);

          // 6. Fallback extraction
          maybeExtractItineraryFromText(String(assistantResponse), context);

          // 7. Save final context to PG DB
          await saveContextToDB(chatId, context);

          // 8. Add assistant response to conversation
          await appendMessageToDB(chatId, 'assistant', assistantResponse);

          console.log('Stream completed and context saved');
          res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
          res.end();
        } catch (postStreamError) {
          console.error('Error in post-stream processing:', postStreamError);
          res.write(`data: ${JSON.stringify({ error: postStreamError.message })}\n\n`);
          res.end();
        }
      });

      textStream.on("error", (error) => {
        console.error('Stream error:', error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      });

    } catch (error) {
      console.error('Error in PG chat stream:', error);
      res.status(500).json({
        error: error.message,
        stack: error.stack
      });
    }
  } catch (error) {
    console.error('Error setting up PG stream:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});


// Health check endpoint with DB connectivity test
router.get('/health', async (req, res) => {
  const dbHealth = await checkDatabaseHealth();

  res.json({
    status: dbHealth.status === 'OK' ? 'OK' : 'ERROR',
    message: 'PG DB chat routes are working',
    database: dbHealth,
    timestamp: new Date().toISOString()
  });
});

export default router;
