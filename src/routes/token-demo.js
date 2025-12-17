import express from 'express';
import { OpenAIProvider, Runner, user, MemorySession } from '@openai/agents';
import { tokenDemoRouterAgent } from '../ai/token-demo-agents.js';
import { getTokenUsageSummary } from '../ai/token-usage.js';

const router = express.Router();

// In-memory sessions to let the token-demo endpoint run multi-turn using a stable chatId.
const memorySessions = new Map();
const sessionInputCallback = (historyItems, newItems) => [...historyItems, ...newItems];

function getSessionForChat(chatId) {
  const key = String(chatId ?? '').trim() || 'unknown';
  let session = memorySessions.get(key);
  if (!session) {
    session = new MemorySession({ sessionId: `token-demo-${key}` });
    memorySessions.set(key, session);
  }
  return session;
}

const safeInput = (message) => {
  try {
    return user(message);
  } catch {
    return { role: 'user', content: [{ type: 'input_text', text: String(message) }] };
  }
};

function getAgentTrace(runResult) {
  const trace = [];
  const items = runResult?.newItems ?? [];
  for (const item of items) {
    const name = item?.agent?.name;
    if (!name) continue;
    if (trace.length === 0 || trace[trace.length - 1] !== name) trace.push(name);
  }
  return trace;
}

function getToolTrace(runResult) {
  const trace = [];
  const items = runResult?.newItems ?? [];
  for (const item of items) {
    if (item?.type !== 'tool_call_item') continue;
    const name = item?.rawItem?.name;
    if (!name) continue;
    if (trace.length === 0 || trace[trace.length - 1] !== name) trace.push(name);
  }
  return trace;
}

router.options('/stream', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Connection');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

function normalizeApiMode(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'chat' || v === 'chat_completions' || v === 'chatcompletions') return 'chat_completions';
  return 'responses';
}

function normalizeCacheRetention(value) {
  const v = String(value ?? '').trim();
  if (!v) return undefined;
  if (v === 'in-memory') return 'in_memory';
  if (v === 'in_memory' || v === '24h') return v;
  return undefined;
}

function buildRunner({ apiMode, promptCacheRetention }) {
  const useResponses = apiMode !== 'chat_completions';
  const modelProvider = new OpenAIProvider({ useResponses });

  const modelSettings = {};
  if (promptCacheRetention) modelSettings.promptCacheRetention = promptCacheRetention;

  // Chat Completions streaming only includes token usage if stream_options.include_usage is set.
  if (!useResponses) {
    modelSettings.providerData = { stream_options: { include_usage: true } };
  }

  return new Runner({ modelProvider, modelSettings });
}

router.post('/stream', async (req, res) => {
  const message = String(req.body?.message ?? '').trim();
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const chatId = String(req.body?.chatId ?? req.query?.chatId ?? '').trim() || `token-demo-${Date.now()}`;
  const turnTag = String(req.body?.turnTag ?? req.query?.turnTag ?? '').trim() || undefined;

  const apiMode = normalizeApiMode(req.body?.api ?? req.query?.api);
  const promptCacheRetention = normalizeCacheRetention(
    req.body?.promptCacheRetention ?? req.query?.promptCacheRetention,
  );

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
  });

  const runner = buildRunner({ apiMode, promptCacheRetention });
  const session = getSessionForChat(chatId);

  let assistantResponse = '';
  const abortController = new AbortController();

  try {
    const stream = await runner.run(tokenDemoRouterAgent, [safeInput(message)], {
      stream: true,
      context: { demo: true },
      session,
      sessionInputCallback,
      signal: abortController.signal,
    });

    const textStream = stream.toTextStream({ compatibleWithNodeStreams: true });

    textStream.on('data', (chunk) => {
      const token = chunk.toString();
      assistantResponse += token;
      res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
    });

    textStream.on('end', async () => {
      try {
        await stream.completed;

        const usage = getTokenUsageSummary(stream, { traceChatId: chatId, traceTag: turnTag });
        const agentTrace = getAgentTrace(stream);
        const toolTrace = getToolTrace(stream);
        res.write(
          `data: ${JSON.stringify({
            type: 'usage',
            apiMode,
            chatId,
            usage,
            dumpPath: stream.state.__tokenUsageModelResponsesDumpPath ?? null,
            rollupPath: stream.state.__tokenUsageRollupPath ?? null,
          })}\n\n`,
        );

        res.write(
          `data: ${JSON.stringify({
            type: 'done',
            apiMode,
            chatId,
            content: assistantResponse,
            lastAgent: stream.lastAgent?.name ?? null,
            agentTrace,
            toolTrace,
            lastResponseId: stream.lastResponseId ?? null,
            usage,
            dumpPath: stream.state.__tokenUsageModelResponsesDumpPath ?? null,
            rollupPath: stream.state.__tokenUsageRollupPath ?? null,
          })}\n\n`,
        );
        res.end();
      } catch (err) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: String(err?.message ?? err) })}\n\n`);
        res.end();
      }
    });

    textStream.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ type: 'error', error: String(err?.message ?? err) })}\n\n`);
      res.end();
    });

    req.on('close', () => {
      // Client disconnected; stop writing.
      try {
        abortController.abort();
        res.end();
      } catch {
        // ignore
      }
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: String(err?.message ?? err) })}\n\n`);
    res.end();
  }
});

export default router;
