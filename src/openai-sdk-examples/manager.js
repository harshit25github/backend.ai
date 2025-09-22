import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { Agent, run, tool, user } from '@openai/agents';
import { RECOMMENDED_PROMPT_PREFIX } from '@openai/agents-core/extensions';
import { z } from 'zod';

const MANAGER_PROMPT = `
You are the Manager Agent. Your only job is to route the user's request to the correct specialist by calling a tool.

Routing rules (deterministic):
- If the user is deciding where to go (interests, vibe, comparisons) → call transfer_to_destination_decider.
- If the user already has a destination and wants a plan/itinerary → call transfer_to_itinerary_planner.
- If the user asks to book flights/hotels or finalize reservations → call transfer_to_booking_agent.

Behavior:
- Keep your surface text short and warm (one-liners). Do not produce any travel content yourself.
- Immediately call exactly one tool once intent is clear. If intent is unclear, ask a single clarifying question.
`;

const DESTINATION_DECIDER_PROMPT = `
You are Destination Decider. Help the user choose a destination based on their vibe, interests, and constraints.
Do:
- Present 2–3 strong options with one-line rationale and seasonal note.
- If origin and rough dates are known, mention typical flight time band.
- End by asking if they want to proceed with the chosen option to build an itinerary.
Don't:
- Create day-wise itineraries or booking steps.
`;

const ITINERARY_PLANNER_PROMPT = `
You are Itinerary Planner. Create concise, day-wise schedules once the destination and basic trip details are known.
Rules:
- If any critical info is missing (origin, destination, dates or nights, travelers), ask once to fill gaps, then confirm before planning.
- Output days with Morning / Afternoon / Evening, plus brief commute notes and a budget snapshot.
- End with next steps (e.g., check flights/hotels) and ask if the user wants booking support.
`;

const BOOKING_AGENT_PROMPT = `
You are Booking Agent. Help with flights/hotels after an itinerary or clear dates/destination exist.
Do:
- Confirm missing essentials (names optional), destination, dates, pax, budget band, preferences (hotel area/class; flight class/airlines).
- Provide a ready-to-book checklist and a clear summary of selections to proceed.
Don't:
- Invent live prices. Keep instructions and structured info ready for execution.
`;

function contextSnapshot(runContext) {
  const ctx = runContext?.context;
  if (!ctx) return '';
  const snapshot = { user: ctx.userInfo, trip: ctx.trip };
  return `\n\n[Local Context Snapshot]\n${JSON.stringify(snapshot, null, 2)}\n`;
}

function captureTripParamsSchema() {
  return z.object({
    originCity: z.string().nullable().optional(),
    destinationCity: z.string().nullable().optional(),
    startDate: z.string().describe('YYYY-MM-DD').nullable().optional(),
    endDate: z.string().describe('YYYY-MM-DD').nullable().optional(),
    adults: z.number().int().positive().nullable().optional(),
    budgetAmount: z.number().positive().nullable().optional(),
    currency: z.string().nullable().optional(),
  });
}

const captureTripParams = tool({
  name: 'capture_trip_params',
  description: 'Update local context with trip details (origin, destination, dates, pax, budget, currency).',
  parameters: captureTripParamsSchema(),
  execute: async (args, runContext) => {
    const ctx = runContext?.context;
    if (!ctx) return 'No context';
    const updates = {};
    if (args.originCity ?? undefined) updates.originCity = args.originCity ?? undefined;
    if (args.destinationCity ?? undefined) updates.destinationCity = args.destinationCity ?? undefined;
    if (args.startDate ?? undefined) updates.startDate = args.startDate ?? undefined;
    if (args.endDate ?? undefined) updates.endDate = args.endDate ?? undefined;
    if (typeof args.adults === 'number') updates.adults = args.adults;
    if (typeof args.budgetAmount === 'number') updates.budgetAmount = args.budgetAmount;
    if (args.currency ?? undefined) updates.currency = args.currency ?? undefined;
    ctx.trip = { ...ctx.trip, ...updates };
    ctx.logger.log('[capture_trip_params] Trip context updated:', ctx.trip);
    return 'Trip parameters captured.';
  },
});

const destinationAgent = new Agent({
  name: 'Destination Decider Agent',
  instructions: (rc) => [
    DESTINATION_DECIDER_PROMPT,
    '',
    'Tool policy (required): On each user turn, extract any of originCity, destinationCity, startDate, endDate, adults, budgetAmount, currency,',
    'then call capture_trip_params to persist them to local context. Include only fields you can confidently extract; normalize ₹ → INR.',
    contextSnapshot(rc),
  ].join('\n'),
  tools: [captureTripParams],
  modelSettings: { toolChoice: 'required' }
});

const itineraryAgent = new Agent({
  name: 'Itinerary Planner Agent',
  instructions: (rc) => [
    ITINERARY_PLANNER_PROMPT,
    '',
    'Tool policy (required): Before planning/refining, extract any of originCity, destinationCity, startDate, endDate, adults, budgetAmount, currency,',
    'then call capture_trip_params to persist them. Include only known fields; normalize ₹ → INR.',
    contextSnapshot(rc),
  ].join('\n'),
  tools: [captureTripParams],
  modelSettings: { toolChoice: 'required' }
});

const bookingAgent = new Agent({
  name: 'Booking Agent',
  instructions: (rc) => [
    BOOKING_AGENT_PROMPT,
    '',
    'Tool policy (required): On each user turn, extract any of originCity, destinationCity, startDate, endDate, adults, budgetAmount, currency,',
    'then call capture_trip_params to persist them to local context.',
    contextSnapshot(rc),
  ].join('\n'),
  tools: [captureTripParams],
  modelSettings: { toolChoice: 'required' }
});

const destinationTool = destinationAgent.asTool({
  toolName: 'transfer_to_destination_decider',
  toolDescription: 'Help the user choose a destination based on interests, vibe, and constraints.',
});

const itineraryTool = itineraryAgent.asTool({
  toolName: 'transfer_to_itinerary_planner',
  toolDescription: 'Create a day-wise itinerary once destination and basics are available.',
});

const bookingTool = bookingAgent.asTool({
  toolName: 'transfer_to_booking_agent',
  toolDescription: 'Assist with booking flights/hotels after plan and dates are set.',
});

export const managerAgent = new Agent({
  name: 'Manager Agent',
  instructions: `${RECOMMENDED_PROMPT_PREFIX}\n\n${MANAGER_PROMPT}`,
  tools: [destinationTool, itineraryTool, bookingTool],
  modelSettings: { toolChoice: 'required' }
});

destinationAgent.on('agent_start', (ctx, agent) => {
  console.log(`[${agent.name}] started`);
  console.log(`[${agent.name}] ctx.trip:`, ctx?.context?.trip);
});
destinationAgent.on('agent_end', (ctx, output) => {
  console.log('[agent] produced:', output);
  console.log('[agent] ctx.trip at end:', ctx?.context?.trip);
});

itineraryAgent.on('agent_start', (ctx, agent) => {
  console.log(`[${agent.name}] started`);
  console.log(`[${agent.name}] ctx.trip:`, ctx?.context?.trip);
});
itineraryAgent.on('agent_end', (ctx, output) => {
  console.log('[agent] produced:', output);
  console.log('[agent] ctx.trip at end:', ctx?.context?.trip);
});

bookingAgent.on('agent_start', (ctx, agent) => {
  console.log(`[${agent.name}] started`);
  console.log(`[${agent.name}] ctx.trip:`, ctx?.context?.trip);
});
bookingAgent.on('agent_end', (ctx, output) => {
  console.log('[agent] produced:', output);
  console.log('[agent] ctx.trip at end:', ctx?.context?.trip);
});

managerAgent.on('agent_start', (ctx, agent) => {
  console.log(`[${agent.name}] started`);
  console.log(`[${agent.name}] ctx.trip:`, ctx?.context?.trip);
});
managerAgent.on('agent_end', (ctx, output) => {
  console.log('[agent] produced:', output);
  console.log('[agent] ctx.trip at end:', ctx?.context?.trip);
});

const HISTORY_PATH = path.resolve('manager-thread.json');
let thread = [];

async function loadThread() {
  try {
    thread = JSON.parse(await fs.readFile(HISTORY_PATH, 'utf8'));
    console.log(`(loaded ${thread.length} items from ${HISTORY_PATH})`);
  } catch {
    thread = [];
  }
}

async function saveThread() {
  await fs.writeFile(HISTORY_PATH, JSON.stringify(thread, null, 2), 'utf8');
}

async function main() {
  await loadThread();

  const rl = readline.createInterface({ input, output });
  console.log('Manager Agent CLI — type "exit" to quit. Commands: /reset /save /load');

  process.on('SIGINT', async () => {
    console.log('\n(^C) Saving session…');
    await saveThread();
    rl.close();
    process.exit(0);
  });

  const appContext = {
    userInfo: { name: 'Harsh', uid: 1 },
    trip: {},
    logger: console,
  };

  while (true) {
    let q;
    try {
      q = await rl.question('you> ');
    } catch {
      break;
    }
    if (q == null) break;
    const qt = q.trim();
    if (!qt) continue;
    if (qt.toLowerCase() === 'exit') break;
    if (qt === '/reset') { thread = []; await saveThread(); console.log('(history reset)'); continue; }
    if (qt === '/save')  { await saveThread(); console.log(`(saved to ${HISTORY_PATH})`); continue; }
    if (qt === '/load')  { await loadThread(); continue; }

    try {
      const res = await run(managerAgent, thread.concat(user(qt)), { context: appContext });

      thread = res.history;

      console.log(`\n[last agent]: ${res.lastAgent?.name ?? 'Unknown Agent'}`);
      if (Array.isArray(res.finalOutput)) {
        console.log(res.finalOutput.map(String).join('\n'));
      } else {
        console.log(String(res.finalOutput ?? ''));
      }
      console.log('\n[ctx.trip]');
      console.log(JSON.stringify(appContext.trip, null, 2));
      console.log();

      await saveThread();
    } catch (err) {
      console.error('Error during run:', err?.message ?? err);
      await saveThread();
    }
  }

  await saveThread();
  rl.close();
  console.log('Session ended. Bye!');
}

const isDirectRun = (() => {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
    return thisFile === invoked;
  } catch {
    return true;
  }
})();

if (isDirectRun) {
  main().catch(async (err) => {
    console.error(err);
    await saveThread();
    process.exit(1);
  });
}


