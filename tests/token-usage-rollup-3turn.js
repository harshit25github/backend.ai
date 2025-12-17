import '../src/config/env.js';
import fs from 'fs/promises';
import { OpenAIProvider, Runner, user, MemorySession } from '@openai/agents';
import { getTokenUsageSummary } from '../src/ai/token-usage.js';

process.env.TOKEN_USAGE_TRACE_MODEL_RESPONSES ||= '1';
process.env.TOKEN_DEMO_MODEL ||= 'gpt-4.1';

async function fileExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const chatId = process.env.TOKEN_USAGE_CHAT_ID || `rollup-demo-${Date.now()}`;
  const model = process.env.TOKEN_DEMO_MODEL || 'gpt-4.1';

  const { tokenDemoRouterAgent } = await import('../src/ai/token-demo-agents.js');

  const session = new MemorySession({ sessionId: `chat-${chatId}` });
  const sessionInputCallback = (historyItems, newItems) => [...historyItems, ...newItems];

  const runner = new Runner({ modelProvider: new OpenAIProvider({ useResponses: true }) });

  const sharedPrefix = Array.from({ length: 140 }, (_unused, i) => {
    return `\n- shared_constraint_${i + 1}: keep answer short; ask only missing details; do not hallucinate prices.`;
  }).join('');

  const turns = [
    `Need flights from NYC to LAX tomorrow morning.${sharedPrefix}`,
    `Actually make it next Friday morning; 1 checked bag; prefer Delta or United.${sharedPrefix}`,
    `Give me 2 options: cheapest vs fastest, and list what info is still missing.${sharedPrefix}`,
  ];

  console.log('chatId', chatId);
  console.log('model', model);

  for (let i = 0; i < turns.length; i += 1) {
    const message = turns[i];
    const tag = `turn${i + 1}`;

    const stream = await runner.run(tokenDemoRouterAgent, [user(message)], {
      stream: true,
      session,
      sessionInputCallback,
    });

    for await (const _evt of stream) {
      // drain stream
    }
    await stream.completed;

    const summary = getTokenUsageSummary(stream, { traceChatId: chatId, traceTag: tag });
    console.log(`\n=== ${tag} ===`);
    console.log('dumpPath', stream.state.__tokenUsageModelResponsesDumpPath);
    console.log('rollupPath', stream.state.__tokenUsageRollupPath);
    console.log('usage', {
      requests: summary.requests,
      inputTokens: summary.inputTokens,
      cachedInputTokens: summary.cachedInputTokens,
      totalInputTokens: summary.totalInputTokens,
      outputTokens: summary.outputTokens,
      totalTokens: summary.totalTokens,
      totalTokensIncludingCached: summary.totalTokensIncludingCached,
    });
  }

  // Wait briefly for async trace writes (best-effort).
  const rollupPath = `data/token-usage-traces/${chatId}/turn-usage-rollup.json`;
  let rollupText = null;
  for (let i = 0; i < 80; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await fileExists(rollupPath))) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 100));
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const text = await fs.readFile(rollupPath, 'utf8');
    rollupText = text;

    try {
      const parsed = JSON.parse(text);
      const turnsList = Array.isArray(parsed?.turns) ? parsed.turns : [];
      const lastTag = turnsList[turnsList.length - 1]?.tag ?? null;
      if (turnsList.length >= 3 && lastTag === 'turn3') break;
    } catch {
      // ignore parse errors briefly while file is being written
    }

    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log('\nrollupFile', rollupPath);
  console.log('rollupPreview', rollupText ? rollupText.slice(0, 1100) : 'NOT FOUND');

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
