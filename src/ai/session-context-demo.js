import 'dotenv/config';

import { Agent, OpenAIConversationsSession, assistant, run, system, tool, user } from '@openai/agents';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const DEMO_MODEL = process.env.SESSION_CONTEXT_DEMO_MODEL || 'gpt-4.1-2025-04-14';
const DEMO_CONVERSATION_ID =
  process.env.SESSION_CONTEXT_DEMO_CONVERSATION_ID || process.env.SESSION_CONTEXT_DEMO_SESSION_ID || '';

const CONTEXT_TAG = '[User Context Snapshot]';

function makeContextSnapshot(context) {
  return assistant(`${CONTEXT_TAG}\n${JSON.stringify(context)}`);
}

function isContextMessage(item) {
  if (item?.type !== 'message' || item?.role !== 'assistant') return false;
  const content = Array.isArray(item.content) ? item.content : [];
  const first = content[0];
  if (first?.type !== 'output_text') return false;
  return String(first.text ?? '').startsWith(CONTEXT_TAG);
}

function getContextSnapshotText(item) {
  if (!isContextMessage(item)) return null;
  const content = Array.isArray(item.content) ? item.content : [];
  const first = content[0];
  return String(first.text ?? '');
}

const sessionInputCallback = (historyItems, newItems) => {
  const latestContextItem = [...historyItems].reverse().find(isContextMessage);
  const trimmedHistory = historyItems.filter((item) => !isContextMessage(item));
  const snapshotText = latestContextItem ? getContextSnapshotText(latestContextItem) : null;
  const snapshotMessage = snapshotText ? system(snapshotText) : null;
  return [...trimmedHistory, ...(snapshotMessage ? [snapshotMessage] : []), ...newItems];
};

const budgetSchema = z
  .object({
    amount: z.number().nullable(),
    currency: z.string().nullable(),
    perPerson: z.boolean().nullable(),
  })
  .strict();

const preferencesSchema = z
  .object({
    focus: z.string().nullable(),
    walking: z.string().nullable(),
    pace: z.string().nullable(),
  })
  .strict();

const tripSchema = z
  .object({
    originCity: z.string().nullable(),
    destinationCity: z.string().nullable(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    durationDays: z.number().int().nullable(),
    partySize: z.number().int().nullable(),
    budget: budgetSchema,
    preferences: preferencesSchema,
  })
  .strict();

const userContextSchema = z
  .object({
    trip: tripSchema,
    notes: z.array(z.string()),
  })
  .strict();

const saveUserContext = tool({
  name: 'save_user_context',
  description: 'Persist the full user context snapshot for the next turn.',
  parameters: z
    .object({
      context: userContextSchema,
    })
    .strict(),
  execute: async (args, runContext) => {
    const ctx = runContext?.context;
    if (!ctx?.session) return 'No session available';
    const nextContext = args?.context ?? {};
    ctx.userContext = nextContext;
    await ctx.session.addItems([makeContextSnapshot(nextContext)]);
    return 'Saved user context.';
  },
});

const agent = new Agent({
  name: 'Session Context Demo Agent',
  model: DEMO_MODEL,
  instructions: [
    'You are a demo travel assistant.',
    'Keep answers concise and ask only for missing essentials.',
    'You may receive a system message starting with "[User Context Snapshot]" that contains JSON context.',
    'Treat only the most recent snapshot as the current state; older snapshots are historical.',
    'On every turn, update the context and call save_user_context with the FULL updated context before replying.',
    'Context schema:',
    '- context.trip.originCity, context.trip.destinationCity',
    '- context.trip.startDate (YYYY-MM-DD), context.trip.endDate (YYYY-MM-DD)',
    '- context.trip.durationDays, context.trip.partySize',
    '- context.trip.budget.amount, context.trip.budget.currency, context.trip.budget.perPerson',
    '- context.trip.preferences.focus, context.trip.preferences.walking, context.trip.preferences.pace',
    '- context.notes (array of short strings)',
    'Always include ALL fields; use null for unknown values (avoid empty strings) and [] for empty notes.',
    'Never mention the snapshot tag or internal context to the user.',
  ].join('\n'),
  tools: [saveUserContext],
  modelSettings: { toolChoice: 'required' },
});

function createSession() {
  if (DEMO_CONVERSATION_ID) {
    return new OpenAIConversationsSession({ conversationId: DEMO_CONVERSATION_ID });
  }
  return new OpenAIConversationsSession();
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY. Add it to the root .env file or your shell environment.');
  }

  const session = createSession();
  const appContext = {
    userContext: {
      trip: {
        originCity: null,
        destinationCity: null,
        startDate: null,
        endDate: null,
        durationDays: null,
        partySize: null,
        budget: { amount: null, currency: null, perPerson: null },
        preferences: { focus: null, walking: null, pace: null },
      },
      notes: [],
    },
    session,
  };
  const sessionId = await session.getSessionId();
  console.log('Conversation ID:', sessionId);
  console.log('Model:', DEMO_MODEL);

  const runOptions = { session, context: appContext, sessionInputCallback };

  const first = await run(agent, [user('Plan a 3-day trip to LA. Ask only for missing essentials.')], runOptions);
  console.log('\n[turn-1] assistant:', first.finalOutput);
  console.log('[turn-1] userContext:', appContext.userContext);

  const second = await run(agent, [user('Make it more food-focused and keep walking minimal.')], runOptions);
  console.log('\n[turn-2] assistant:', second.finalOutput);
  console.log('[turn-2] userContext:', appContext.userContext);
}

const isMain = path.resolve(process.argv[1] ?? '') === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
