import express from 'express';
import { readConversation, appendMessage, clearConversation } from '../utils/fileStore.js';
import { runChatAgent, chatAgent } from '../ai/agent.js';
import { runMultiAgentSystem, loadContext, saveContext, contextExtractorAgent } from '../ai/multiAgentSystem.js';
import { user, run } from '@openai/agents';

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

    // Use the new runMultiAgentSystem function (non-streaming for /message endpoint)
    const result = await runMultiAgentSystem(message, chatId, conversationHistory, false);

    const responseContent = result?.finalOutput || 'Sorry, I could not generate a response.';

    await appendMessage(chatId, {
      role: 'assistant',
      content: responseContent
    });

    // Run context extraction
    console.log('🔄 Starting context extraction for /message endpoint...');
    const oldContext = result.context;

    const extractionPrompt = `
EXTRACTION TASK:

**Old Context:**
${JSON.stringify(oldContext, null, 2)}

**User Message:**
${message}

**Assistant Response:**
${responseContent}

Analyze the conversation and extract trip information. Merge old context with any changes, then output COMPLETE updated context.
`;

    try {
      // Run extractor agent
      const extractionResult = await run(contextExtractorAgent, [user(extractionPrompt)]);

      // Extractor outputs COMPLETE merged context
      let updatedContext = extractionResult.finalOutput;

      // Parse if it's a string with markdown formatting
      if (typeof updatedContext === 'string') {
        const jsonMatch = updatedContext.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
          updatedContext = JSON.parse(jsonMatch[1]);
        } else {
          updatedContext = JSON.parse(updatedContext);
        }
      }

      console.log('📦 Extracted complete context:', JSON.stringify(updatedContext, null, 2));

      // Save complete updated context directly
      await saveContext(chatId, updatedContext);
      console.log('✅ Context extraction completed for /message endpoint');

      // Itinerary is now directly in context (captured via extraction)
      const itineraryToSend = updatedContext.itinerary?.days?.length > 0
        ? updatedContext.itinerary
        : null;

      res.json({
        success: true,
        chatId,
        response: responseContent,
        lastAgent: result.lastAgent,
        context: updatedContext,
        summary: updatedContext.summary,
        itinerary: itineraryToSend,
        flight: oldContext.flight || null,
        suggestedQuestions: updatedContext.summary?.suggestedQuestions || [],
        placesOfInterest: updatedContext.summary?.placesOfInterest || []
      });

    } catch (extractionError) {
      console.error('⚠️ Context extraction failed, sending old context:', extractionError.message);

      // Fallback: send old context if extraction fails
      const itineraryToSend = oldContext.itinerary?.days?.length > 0
        ? oldContext.itinerary
        : null;

      res.json({
        success: true,
        chatId,
        response: responseContent,
        lastAgent: result.lastAgent,
        context: oldContext,
        summary: oldContext.summary,
        itinerary: itineraryToSend,
        flight: oldContext.flight || null,
        suggestedQuestions: oldContext.summary?.suggestedQuestions || [],
        placesOfInterest: oldContext.summary?.placesOfInterest || []
      });
    }

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
    const streamStartTime = Date.now();
    console.log(`⏱️  [TIMING] Stream started at: ${new Date(streamStartTime).toISOString()}`);

    try {
      // Use the new runMultiAgentSystem function with streaming
      const result = await runMultiAgentSystem(message, chatId, conversationHistory, true);

      // Stream the response
      if (result.stream) {
        let assistantResponse = '';
        let chunkCount = 0;
        const textStream = result.stream.toTextStream({ compatibleWithNodeStreams: true });

        textStream.on("data", (chunk) => {
          const content = chunk.toString();
          assistantResponse += content;
          chunkCount++;
          if (chunkCount === 1) {
            const firstChunkTime = Date.now();
            console.log(`⏱️  [TIMING] First chunk received at: ${new Date(firstChunkTime).toISOString()} (${firstChunkTime - streamStartTime}ms from start)`);
          }
          res.write(`data: ${JSON.stringify({ token: content, type: 'token' })}\n\n`);
        });

        textStream.on("end", async () => {
          try {
            const streamEndTime = Date.now();
            console.log(`⏱️  [TIMING] Stream ended at: ${new Date(streamEndTime).toISOString()} (Total chunks: ${chunkCount}, Duration: ${streamEndTime - streamStartTime}ms)`);

            await result.stream.completed;

            await appendMessage(chatId, {
              role: 'assistant',
              content: assistantResponse
            });

            // ✅ WAIT FOR EXTRACTION to complete before sending "done" event
            const extractionStartTime = Date.now();
            console.log(`⏱️  [TIMING] Context extraction started at: ${new Date(extractionStartTime).toISOString()}`);
            console.log('🔄 Starting context extraction...');
            const oldContext = result.context;
            console.log('📂 Old context:', JSON.stringify(oldContext, null, 2));

            const extractionPrompt = `
EXTRACTION TASK:

**Old Context:**
${JSON.stringify(oldContext, null, 2)}

**User Message:**
${message}

**Assistant Response:**
${assistantResponse}

Analyze the conversation and extract trip information. Merge old context with any changes, then output COMPLETE updated context.
`;

            try {
              // Run extractor agent and WAIT for result
              const extractionResult = await run(contextExtractorAgent, [user(extractionPrompt)]);

              // ✅ Extractor outputs COMPLETE merged context (with return_date calculated)
              let updatedContext = extractionResult.finalOutput;

              // Parse if it's a string with markdown formatting
              if (typeof updatedContext === 'string') {
                // Remove markdown code blocks if present
                const jsonMatch = updatedContext.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
                if (jsonMatch) {
                  updatedContext = JSON.parse(jsonMatch[1]);
                } else {
                  updatedContext = JSON.parse(updatedContext);
                }
              }

              const extractionEndTime = Date.now();
              console.log(`⏱️  [TIMING] Context extraction completed at: ${new Date(extractionEndTime).toISOString()} (Duration: ${extractionEndTime - extractionStartTime}ms)`);
              console.log('📦 Extracted complete context:', JSON.stringify(updatedContext, null, 2));


              // Save complete updated context directly
              await saveContext(chatId, updatedContext);
              console.log('✅ Context extraction completed');

              // ✅ SEND "done" EVENT WITH UPDATED CONTEXT
              const itineraryToSend = updatedContext.itinerary?.days?.length > 0
                ? updatedContext.itinerary
                : null;

              const doneChunkTime = Date.now();
              console.log(`⏱️  [TIMING] Sending "done" chunk at: ${new Date(doneChunkTime).toISOString()}`);
              res.write(`data: ${JSON.stringify({
                type: 'done',
                content: assistantResponse,
                itinerary: itineraryToSend,
                summary: updatedContext.summary || null,
                flight: oldContext.flight || null,  // ✅ Flight from original context (managed by Flight Agent)
                suggestedQuestions: updatedContext.summary?.suggestedQuestions || [],
                placesOfInterest: updatedContext.summary?.placesOfInterest || []
              })}\n\n`);
              res.end();

              const totalEndTime = Date.now();
              console.log(`⏱️  [TIMING] Total request completed at: ${new Date(totalEndTime).toISOString()} (Total duration: ${totalEndTime - streamStartTime}ms)`);
              console.log(`⏱️  [TIMING SUMMARY] Stream: ${streamEndTime - streamStartTime}ms | Extraction: ${extractionEndTime - extractionStartTime}ms | Total: ${totalEndTime - streamStartTime}ms`);

            } catch (extractionError) {
              console.error('⚠️ Context extraction failed, sending old context:', extractionError.message);

              // Fallback: send old context if extraction fails
              const itineraryToSend = oldContext.itinerary?.days?.length > 0
                ? oldContext.itinerary
                : null;

              res.write(`data: ${JSON.stringify({
                type: 'done',
                content: assistantResponse,
                itinerary: itineraryToSend,
                summary: oldContext.summary || null,
                flight: oldContext.flight || null,
                suggestedQuestions: oldContext.summary?.suggestedQuestions || [],
                placesOfInterest: oldContext.summary?.placesOfInterest || []
              })}\n\n`);
              res.end();
            }

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