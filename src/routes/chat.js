import express from 'express';
import { readConversation, appendMessage, clearConversation } from '../utils/fileStore.js';
import { runChatAgent, chatAgent } from '../ai/agent.js';
import { runMultiAgentSystem, loadContext, saveContext } from '../ai/multiAgentSystem.js';
import { user } from '@openai/agents';

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

    await appendMessage(chatId, { role, content: message });

    const conversation = await readConversation(chatId);
    const conversationHistory = conversation.messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    console.log(`Running multi-agent system for chat ${chatId}`);

    // Use the new runMultiAgentSystem function
    const result = await runMultiAgentSystem(message, chatId, conversationHistory);

    const responseContent = result?.finalOutput || 'Sorry, I could not generate a response.';

    await appendMessage(chatId, {
      role: 'assistant',
      content: responseContent
    });

    // Itinerary is now directly in context (captured via tools)
    const itineraryToSend = result.context.itinerary?.days?.length > 0
      ? result.context.itinerary
      : null;

    res.json({
      success: true,
      chatId,
      response: responseContent,
      lastAgent: result.lastAgent,
      context: result.context,
      summary: result.context.summary,
      itinerary: itineraryToSend,
      suggestedQuestions: result.context.summary?.suggestedQuestions || [],
      placesOfInterest: result.context.summary?.placesOfInterest || []
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
    const conversationHistory = conversation.messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    console.log('Starting multi-agent system stream for message:', message);

    try {
      // Use the new runMultiAgentSystem function with streaming
      const result = await runMultiAgentSystem(message, chatId, conversationHistory, true);

      // Stream the response
      if (result.stream) {
        let assistantResponse = '';
        const textStream = result.stream.toTextStream({ compatibleWithNodeStreams: true });

        textStream.on("data", (chunk) => {
          const content = chunk.toString();
          assistantResponse += content;
          res.write(`data: ${JSON.stringify({ token: content, type: 'token' })}\n\n`);
        });

        textStream.on("end", async () => {
          try {
            await result.stream.completed;

            await appendMessage(chatId, {
              role: 'assistant',
              content: assistantResponse
            });

            // Itinerary is captured via tools in context
            const context = result.context;
            const itineraryToSend = context.itinerary?.days?.length > 0
              ? context.itinerary
              : null;

            res.write(`data: ${JSON.stringify({
              type: 'done',
              content: assistantResponse,
              itinerary: itineraryToSend,
              summary: context.summary || null,
              suggestedQuestions: context.summary?.suggestedQuestions || [],
              placesOfInterest: context.summary?.placesOfInterest || []
            })}\n\n`);
            res.end();
          } catch (completionError) {
            console.error('Error during stream completion:', completionError);
            res.write(`data: ${JSON.stringify({ type: 'error', error: completionError.message })}\n\n`);
            res.end();
          }
        });

        textStream.on("error", (error) => {
          console.error('Stream error:', error);
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
          res.end();
        });
      } else {
        // Non-streaming response
        await appendMessage(chatId, {
          role: 'assistant',
          content: result.finalOutput
        });

        const itineraryToSend = result.context.itinerary?.days?.length > 0
          ? result.context.itinerary
          : null;

        res.write(`data: ${JSON.stringify({
          type: 'done',
          content: result.finalOutput,
          itinerary: itineraryToSend,
          summary: result.context.summary || null,
          suggestedQuestions: result.context.summary?.suggestedQuestions || [],
          placesOfInterest: result.context.summary?.placesOfInterest || []
        })}\n\n`);
        res.end();
      }

    } catch (streamError) {
      console.error('Error in stream:', streamError);
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