import express from 'express';
import { readConversation, appendMessage, clearConversation } from '../utils/fileStore.js';
import { runChatAgent, chatAgent } from '../ai/agent.js';
import { runMultiAgentSystem } from '../ai/multiAgentSystem.js';
import { runMultiAgentStreaming, extractContextFromStream } from '../ai/multiAgentStreaming.js';
import { run } from '@openai/agents';

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
    const conversationHistory = conversation.messages.slice(-10);

    // Use multi-agent system instead of single agent
    const result = await runMultiAgentSystem(message, chatId, conversationHistory);

    console.log('Multi-agent result:', result);

    const responseContent = result?.finalOutput || 'Sorry, I could not generate a response.';

    await appendMessage(chatId, {
      role: 'assistant',
      content: responseContent
    });

    res.json({
      success: true,
      chatId,
      response: responseContent,
      lastAgent: result.lastAgent,
      context: result.context,
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

    console.log('Starting multi-agent stream for message:', message);
    let assistantResponse = '';

    try {
      // Use multi-agent streaming system
      const { stream, context, chatId: contextChatId } = await runMultiAgentStreaming(message, chatId, conversationHistory);

      console.log('Multi-agent stream created, using toTextStream...');

      // Use the pattern from your example
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
          console.log('Multi-agent stream completed successfully');

          // Extract and update context from the completed conversation
          const updatedContext = await extractContextFromStream(chatId, context, message, assistantResponse);

          await appendMessage(chatId, {
            role: 'assistant',
            content: assistantResponse
          });

          res.write(`data: ${JSON.stringify({
            type: 'done',
            content: assistantResponse,
            lastAgent: stream.lastAgent?.name,
            context: updatedContext
          })}\n\n`);
          res.end();
        } catch (completionError) {
          console.error('Error during multi-agent stream completion:', completionError);
          res.write(`data: ${JSON.stringify({ type: 'error', error: completionError.message })}\n\n`);
          res.end();
        }
      });

      textStream.on("error", (error) => {
        console.error('Multi-agent stream error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      });

    } catch (streamError) {
      console.error('Error creating multi-agent stream:', streamError);
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
    const { loadContext } = await import('../ai/multiAgentSystem.js');
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