import express from 'express';
import { runMultiAgentSystem } from '../ai/multiAgentSystem.js';
import {
  getConversationData,
  saveContext,
  addMessage
} from '../db/conversationDb.js';

const router = express.Router();

// ============================================================================
// POST /api/chat-db/message - Chat with Database Integration
// ============================================================================
router.post('/message', async (req, res, next) => {
  try {
    const { chatId, message, userId } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({
        error: 'chatId and message are required'
      });
    }

    // 1. Get context and history from database
    const { context, conversationHistory } = await getConversationData(chatId, userId);

    console.log(`[DB] Loaded context for chat: ${chatId}`);
    console.log(`[DB] History length: ${conversationHistory.length} messages`);

    // 2. Add user message to history in DB
    await addMessage(chatId, {
      role: 'user',
      content: message
    });

    // 3. Run multi-agent system with context and history
    const result = await runMultiAgentSystem(
      message,
      chatId,
      conversationHistory,
      false // streaming = false
    );

    const responseContent = result?.finalOutput || 'Sorry, I could not generate a response.';

    // 4. Add assistant message to history in DB
    await addMessage(chatId, {
      role: 'assistant',
      content: responseContent,
      agentName: result.lastAgent
    });

    // 5. Save updated context to database
    await saveContext(chatId, result.context);

    console.log(`[DB] Saved context for chat: ${chatId}`);

    // 6. Prepare response
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
      placesOfInterest: result.context.summary?.placesOfInterests || []
    });

  } catch (error) {
    console.error('[DB] Error:', error);
    next(error);
  }
});

// ============================================================================
// POST /api/chat-db/stream - Streaming with Database Integration
// ============================================================================
router.post('/stream', async (req, res, next) => {
  try {
    const { chatId, message, userId } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({
        error: 'chatId and message are required'
      });
    }

    // Setup SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // 1. Get context and history from database
    const { context, conversationHistory } = await getConversationData(chatId, userId);

    console.log(`[DB] Loaded context for chat: ${chatId}`);

    // 2. Add user message to history in DB
    await addMessage(chatId, {
      role: 'user',
      content: message
    });

    try {
      // 3. Run multi-agent system with streaming
      const result = await runMultiAgentSystem(
        message,
        chatId,
        conversationHistory,
        true // streaming = true
      );

      // 4. Stream the response
      if (result.stream) {
        let assistantResponse = '';
        const textStream = result.stream.toTextStream({ compatibleWithNodeStreams: true });

        textStream.on("data", (chunk) => {
          const content = chunk.toString();
          assistantResponse += content;
          res.write(`data: ${JSON.stringify({ type: 'token', token: content })}\n\n`);
        });

        textStream.on("end", async () => {
          try {
            await result.stream.completed;

            // 5. Add assistant message to history in DB
            await addMessage(chatId, {
              role: 'assistant',
              content: assistantResponse,
              agentName: result.lastAgent
            });

            // 6. Save updated context to database
            await saveContext(chatId, result.context);

            console.log(`[DB] Saved context for chat: ${chatId}`);

            // 7. Send final data
            const itineraryToSend = result.context.itinerary?.days?.length > 0
              ? result.context.itinerary
              : null;

            res.write(`data: ${JSON.stringify({
              type: 'done',
              content: assistantResponse,
              itinerary: itineraryToSend,
              summary: result.context.summary || null,
              suggestedQuestions: result.context.summary?.suggestedQuestions || [],
              placesOfInterest: result.context.summary?.placesOfInterests || []
            })}\n\n`);
            res.end();
          } catch (completionError) {
            console.error('[DB] Stream completion error:', completionError);
            res.write(`data: ${JSON.stringify({ type: 'error', error: completionError.message })}\n\n`);
            res.end();
          }
        });

        textStream.on("error", (error) => {
          console.error('[DB] Stream error:', error);
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
          res.end();
        });
      } else {
        // Non-streaming fallback
        const assistantResponse = result.finalOutput;

        await addMessage(chatId, {
          role: 'assistant',
          content: assistantResponse,
          agentName: result.lastAgent
        });

        await saveContext(chatId, result.context);

        const itineraryToSend = result.context.itinerary?.days?.length > 0
          ? result.context.itinerary
          : null;

        res.write(`data: ${JSON.stringify({
          type: 'done',
          content: assistantResponse,
          itinerary: itineraryToSend,
          summary: result.context.summary || null,
          suggestedQuestions: result.context.summary?.suggestedQuestions || [],
          placesOfInterest: result.context.summary?.placesOfInterests || []
        })}\n\n`);
        res.end();
      }

    } catch (streamError) {
      console.error('[DB] Error in stream:', streamError);
      res.write(`data: ${JSON.stringify({ type: 'error', error: streamError.message })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('[DB] Route error:', error);
    if (!res.headersSent) {
      next(error);
    }
  }
});

// ============================================================================
// GET /api/chat-db/context/:chatId - Get context from database
// ============================================================================
router.get('/context/:chatId', async (req, res, next) => {
  try {
    const { chatId } = req.params;

    const { context, history } = await getConversationData(chatId);

    res.json({
      success: true,
      chatId,
      context,
      messageCount: history.length
    });

  } catch (error) {
    console.error('[DB] Error fetching context:', error);
    next(error);
  }
});

// ============================================================================
// GET /api/chat-db/history/:chatId - Get conversation history
// ============================================================================
router.get('/history/:chatId', async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const { history } = await getConversationData(chatId);

    res.json({
      success: true,
      chatId,
      messages: history,
      count: history.length
    });

  } catch (error) {
    console.error('[DB] Error fetching history:', error);
    next(error);
  }
});

// ============================================================================
// DELETE /api/chat-db/conversation/:chatId - Delete conversation
// ============================================================================
router.delete('/conversation/:chatId', async (req, res, next) => {
  try {
    const { chatId } = req.params;

    const { deleteConversation } = await import('../db/conversationDb.js');
    await deleteConversation(chatId);

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });

  } catch (error) {
    console.error('[DB] Error deleting conversation:', error);
    next(error);
  }
});

export default router;
