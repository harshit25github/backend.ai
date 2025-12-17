import '../src/config/env.js';
import { MemorySession, run, user } from '@openai/agents';
import { gatewayAgent, loadContext, saveContext } from '../src/ai/multiAgentSystem.js';
import { getTokenUsageSummary } from '../src/ai/token-usage.js';

function sumTokenDetail(list, key) {
  if (!Array.isArray(list)) return 0;
  let total = 0;
  for (const entry of list) total += typeof entry?.[key] === 'number' ? entry[key] : 0;
  return total;
}

function summarizeRawResponse(response, agentByResponseId) {
  const usage = response?.usage;
  const outputItems = Array.isArray(response?.output) ? response.output : [];
  const toolCalls = outputItems.filter((o) => o?.type === 'function_call').map((o) => o?.name).filter(Boolean);
  const cachedInputTokens = sumTokenDetail(usage?.inputTokensDetails, 'cached_tokens');
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;

  return {
    responseId: response?.responseId ?? null,
    agent: agentByResponseId.get(response?.responseId) ?? null,
    inputTokens,
    cachedInputTokens,
    totalInputTokens: inputTokens + cachedInputTokens,
    outputTokens,
    totalTokens: usage?.totalTokens ?? 0,
    totalTokensIncludingCached: inputTokens + cachedInputTokens + outputTokens,
    reasoningTokens: sumTokenDetail(usage?.outputTokensDetails, 'reasoning_tokens'),
    outputTypes: outputItems.map((o) => o?.type).filter(Boolean),
    toolCalls,
  };
}

async function runTurn({ chatId, session, sessionInputCallback, message }) {
  const context = await loadContext(chatId);

  const stream = await run(gatewayAgent, [user(message)], {
    context,
    stream: true,
    session,
    sessionInputCallback,
  });

  let currentAgentName = stream.currentAgent?.name ?? null;
  const agentByResponseId = new Map();
  const responseOrder = [];

  let streamedText = '';

  for await (const evt of stream) {
    if (evt?.type === 'agent_updated_stream_event') {
      currentAgentName = evt.agent?.name ?? null;
      continue;
    }

    if (evt?.type !== 'raw_model_stream_event') continue;
    const data = evt.data;

    if (data?.type === 'output_text_delta') {
      streamedText += data.delta ?? '';
      continue;
    }

    if (data?.type === 'response_done') {
      const responseId = data.response?.id ?? null;
      if (responseId) {
        agentByResponseId.set(responseId, currentAgentName);
        responseOrder.push({ responseId, agent: currentAgentName });
      }
    }
  }

  await stream.completed;

  const before = {
    requests: stream.state.usage.requests,
    inputTokens: stream.state.usage.inputTokens,
    outputTokens: stream.state.usage.outputTokens,
    totalTokens: stream.state.usage.totalTokens,
  };

  const usage = getTokenUsageSummary(stream);

  const after = {
    requests: stream.state.usage.requests,
    inputTokens: stream.state.usage.inputTokens,
    outputTokens: stream.state.usage.outputTokens,
    totalTokens: stream.state.usage.totalTokens,
  };

  const rawResponses = stream.rawResponses.map((r) => summarizeRawResponse(r, agentByResponseId));

  await saveContext(chatId, context);

  return {
    streamedText,
    responseOrder,
    rawResponses,
    usage,
    stateUsageBefore: before,
    stateUsageAfter: after,
  };
}

async function main() {
  const chatId = process.env.TOKEN_USAGE_CHAT_ID || `usage-debug-${Date.now()}`;
  const session = new MemorySession({ sessionId: `chat-${chatId}` });
  const sessionInputCallback = (historyItems, newItems) => [...historyItems, ...newItems];

  const turns = [
    'Plan a 3-day trip to Paris in May. 2 adults, relaxed pace. I like museums and cafes.',
    'Make it more budget-friendly and include one kid-friendly museum or activity.',
    'Shift the itinerary to avoid too much walking (max 12k steps/day) and add a small day trip nearby.',
    'I also need flights BOS -> CDG, depart 2026-05-10, return 2026-05-13, 2 adults, economy. Prefer morning departures.',
    'Before booking, summarize the full plan + flight details and list any missing info you still need.',
  ];

  console.log(`chatId=${chatId}`);

  for (let i = 0; i < turns.length; i += 1) {
    const message = turns[i];
    console.log(`\n--- TURN ${i + 1} ---`);
    console.log(`user: ${message}`);

    const result = await runTurn({ chatId, session, sessionInputCallback, message });

    console.log('response_order:', result.responseOrder);
    console.log('rawResponses:', result.rawResponses);
    console.log('usage_summary:', result.usage);
    console.log('state_usage_before_helper:', result.stateUsageBefore);
    console.log('state_usage_after_helper:', result.stateUsageAfter);
    console.log('streamed_text_length:', result.streamedText.length);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
