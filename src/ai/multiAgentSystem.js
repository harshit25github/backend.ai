import { Agent, run, tool, user } from '@openai/agents';
import PROMPTS from './prompts.js';
import { RECOMMENDED_PROMPT_PREFIX } from '@openai/agents-core/extensions';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

// Context schema for our travel planning system
export const AppContext = z.object({
  userInfo: z.object({
    name: z.string().optional(),
    preferences: z.array(z.string()).default([])
  }).default({}),
  trip: z.object({
    originCity: z.string().optional(),
    destinationCity: z.string().optional(),
    startDate: z.string().optional(), // YYYY-MM-DD
    endDate: z.string().optional(),   // YYYY-MM-DD
    adults: z.number().int().positive().optional(),
    budgetAmount: z.number().positive().optional(),
    currency: z.string().default('USD'),
    tripType: z.enum(['leisure', 'business', 'adventure', 'cultural', 'romantic']).optional(),
    accommodationType: z.enum(['hotel', 'hostel', 'apartment', 'resort']).optional(),
    itinerary: z.array(z.object({
      day: z.number(),
      date: z.string(),
      activities: z.array(z.string()).default([])
    })).default([]),
    // Extended fields for robust context management
    segmentedItinerary: z.array(z.object({
      day: z.number().optional(),
      date: z.string().optional(),
      morning: z.array(z.string()).default([]).optional(),
      afternoon: z.array(z.string()).default([]).optional(),
      evening: z.array(z.string()).default([]).optional()
    })).optional().default([]),
    bookingStatus: z.enum(['planning', 'ready_to_book', 'booked']).default('planning'),
    bookingConfirmed: z.boolean().optional(),
    itineraryStatus: z.enum(['fresh', 'stale']).optional(),
    lastItinerarySignature: z.string().nullable().optional()
  }).default({}),
  conversationState: z.object({
    currentAgent: z.string().optional(),
    lastIntent: z.string().optional(),
    awaitingConfirmation: z.boolean().default(false)
  }).default({}),
  debugLog: z.array(z.object({
    timestamp: z.string(),
    input: z.string().optional(),
    role: z.string().optional(),
    lastAgent: z.string().optional(),
    before: z.any(),
    after: z.any(),
    note: z.string().optional()
  })).optional().default([])
});

// Context management utilities
const CONTEXT_DIR = path.resolve('data/contexts');

export const getContextPath = (chatId) => path.join(CONTEXT_DIR, `${chatId}_context.json`);

export const loadContext = async (chatId) => {
  try {
    await fs.mkdir(CONTEXT_DIR, { recursive: true });
    const contextPath = getContextPath(chatId);
    const contextData = await fs.readFile(contextPath, 'utf8');
    const parsed = JSON.parse(contextData);
    return AppContext.parse(parsed);
  } catch (error) {
    console.log(`Creating new context for chat: ${chatId}`);
    return AppContext.parse({});
  }
};

export const saveContext = async (chatId, context) => {
  try {
    await fs.mkdir(CONTEXT_DIR, { recursive: true });
    const contextPath = getContextPath(chatId);
    await fs.writeFile(contextPath, JSON.stringify(context, null, 2), 'utf8');
    console.log(`Context saved for chat: ${chatId}`);
  } catch (error) {
    console.error(`Error saving context for chat ${chatId}:`, error);
    throw error;
  }
};

// -----------------------------------------------------------------------------
// Local context snapshot helper
// -----------------------------------------------------------------------------
function contextSnapshot(runContext) {
  const ctx = runContext?.context;
  if (!ctx) return '';
  const snapshot = {
    user: ctx.userInfo,
    trip: {
      originCity: ctx.trip.originCity,
      destinationCity: ctx.trip.destinationCity,
      startDate: ctx.trip.startDate,
      endDate: ctx.trip.endDate,
      adults: ctx.trip.adults,
      budgetAmount: ctx.trip.budgetAmount,
      currency: ctx.trip.currency,
      bookingConfirmed: ctx.trip.bookingConfirmed,
      itineraryStatus: ctx.trip.itineraryStatus
    }
  };
  return `\n\n[Local Context Snapshot]\n${JSON.stringify(snapshot, null, 2)}\n`;
}

// -----------------------------------------------------------------------------
// Tools that directly mutate local context
// -----------------------------------------------------------------------------
export const captureTripParams = tool({
  name: 'capture_trip_params',
  description: 'Update local context with any provided trip details (origin, destination, dates, pax, budget, currency).',
  parameters: z.object({
    originCity: z.string().nullable().optional(),
    destinationCity: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    adults: z.number().int().positive().nullable().optional(),
    budgetAmount: z.number().positive().nullable().optional(),
    currency: z.string().nullable().optional()
  }),
  async execute(args, runContext) {
    const ctx = runContext?.context;
    if (!ctx) return 'No context available';

    const prevSig = ctx.trip.lastItinerarySignature ?? null;

    const updates = {};
    if (args.originCity != null) updates.originCity = args.originCity ?? undefined;
    if (args.destinationCity != null) updates.destinationCity = args.destinationCity ?? undefined;
    if (args.startDate != null) updates.startDate = args.startDate ?? undefined;
    if (args.endDate != null) updates.endDate = args.endDate ?? undefined;
    if (typeof args.adults === 'number') updates.adults = args.adults;
    if (typeof args.budgetAmount === 'number') updates.budgetAmount = args.budgetAmount;
    if (args.currency != null) updates.currency = args.currency ?? undefined;

    ctx.trip = { ...ctx.trip, ...updates };

    const critical = {
      destinationCity: ctx.trip.destinationCity ?? null,
      startDate: ctx.trip.startDate ?? null,
      endDate: ctx.trip.endDate ?? null,
      adults: ctx.trip.adults ?? null,
      budgetAmount: ctx.trip.budgetAmount ?? null
    };
    const newSig = JSON.stringify(critical);
    ctx.trip.lastItinerarySignature = newSig;
    if (newSig !== prevSig) {
      ctx.trip.itineraryStatus = 'stale';
    }

    return 'Trip parameters captured in local context.';
  }
});

export const confirmBooking = tool({
  name: 'confirm_booking',
  description: 'Mark the booking as confirmed in local context once user agrees.',
  parameters: z.object({
    confirm: z.boolean()
  }),
  async execute(args, runContext) {
    const ctx = runContext?.context;
    if (!ctx) return 'No context available';
    if (!args.confirm) return 'Booking not confirmed by user.';
    ctx.trip.bookingConfirmed = true;
    ctx.trip.bookingStatus = 'booked';
    return 'Booking has been confirmed in local context.';
  }
});

export const captureItineraryDays = tool({
  name: 'capture_itinerary_days',
  description: 'Persist a day-wise itinerary into local context with morning/afternoon/evening segments.',
  parameters: z.object({
    days: z.array(z.object({
      day: z.number().int().positive().nullable().optional(),
      date: z.string().nullable().optional(),
      morning: z.array(z.string()).nullable().optional(),
      afternoon: z.array(z.string()).nullable().optional(),
      evening: z.array(z.string()).nullable().optional()
    }))
  }),
  async execute(args, runContext) {
    const ctx = runContext?.context;
    if (!ctx) return 'No context available';
    const normalized = (args.days || []).map(d => ({
      day: d.day ?? undefined,
      date: d.date ?? undefined,
      morning: d.morning ?? [],
      afternoon: d.afternoon ?? [],
      evening: d.evening ?? []
    }));
    ctx.trip.segmentedItinerary = normalized;
    ctx.trip.itineraryStatus = 'fresh';
    return `Saved ${normalized.length} itinerary day(s).`;
  }
});

// -----------------------------------------------------------------------------
// Safety net: parse itinerary text and persist if model forgot to call tool
// -----------------------------------------------------------------------------
export function parseItineraryFromText(text) {
  const lines = text.split(/\r?\n/);
  const days = [];
  let current = null;
  let currentSegment = null; // 'morning' | 'afternoon' | 'evening'
  const dayHeader = /^\s*Day\s*(\d+)?(?:\s*\(([^)]+)\))?\s*[:\-]?/i;
  const segHeader = /^\s*(?:[-•]\s*)?(Morning|Afternoon|Evening)\s*:\s*(.*)$/i;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const mDay = line.match(dayHeader);
    if (mDay) {
      if (current) days.push(current);
      const dayNum = mDay[1] ? Number(mDay[1]) : undefined;
      const dateText = mDay[2];
      const dateIso = dateText && /\d{4}-\d{2}-\d{2}/.test(dateText) ? (dateText.match(/\d{4}-\d{2}-\d{2}/)[0]) : undefined;
      current = { day: dayNum, date: dateIso, morning: [], afternoon: [], evening: [] };
      currentSegment = null;
      continue;
    }
    const mSeg = line.match(segHeader);
    if (mSeg) {
      if (!current) current = { morning: [], afternoon: [], evening: [] };
      const seg = mSeg[1].toLowerCase();
      currentSegment = seg;
      const rest = mSeg[2]?.trim();
      if (rest) current[seg].push(rest);
      continue;
    }
    if (current && currentSegment && /^[-•]/.test(line)) {
      const content = line.replace(/^[-•]\s*/, '').trim();
      if (content) current[currentSegment].push(content);
      continue;
    }
  }
  if (current) days.push(current);
  return days.filter(d => (d.morning.length + d.afternoon.length + d.evening.length) > 0);
}

export async function ensureItinerarySavedIfMissing(outputText, appContext) {
  const hasPlanText = /\bDay\b/i.test(outputText) && /(Morning|Afternoon|Evening)\s*:/i.test(outputText);
  const hasItin = Array.isArray(appContext.trip.segmentedItinerary) && appContext.trip.segmentedItinerary.length > 0;
  if (!hasPlanText || hasItin) return;
  const parsed = parseItineraryFromText(outputText);
  if (parsed.length === 0) return;
  appContext.trip.segmentedItinerary = parsed;
  appContext.trip.itineraryStatus = 'fresh';
}

// -----------------------------------------------------------------------------
// Extractor Agent: run post-turn to persist itinerary if model forgot the tool
// -----------------------------------------------------------------------------
export const itineraryExtractorAgent = new Agent({
  name: 'Itinerary Extractor Agent',
  model: 'gpt-4o-mini',
  instructions: `You receive exactly one assistant reply in plain text. If it contains a day-wise itinerary (lines like "Day 1" and segments "Morning:", "Afternoon:", "Evening:"), extract those into a structured JSON days array and IMMEDIATELY call the tool capture_itinerary_days with that payload. Do not include anything else.

Required tool payload shape:
{ "days": [ { "day": number|null, "date": string|null, "morning": string[], "afternoon": string[], "evening": string[] } ] }

Guidelines:
- Infer day numbers in sequence if missing.
- Preserve short activity strings; omit empty segments.
- Normalize date to YYYY-MM-DD when present; if only month/day words appear and a trip.startDate exists in context, infer the year from it.
- If the text does not look like an itinerary, do nothing.
`,
  tools: [captureItineraryDays],
  modelSettings: { toolChoice: 'required' }
});

export async function maybeExtractItineraryFromText(text, context) {
  try {
    const looksLikeItinerary = /\bDay\b/i.test(text) && /(Morning|Afternoon|Evening)\s*:/i.test(text);
    if (!looksLikeItinerary) return;
    const beforeLen = Array.isArray(context.trip.segmentedItinerary) ? context.trip.segmentedItinerary.length : 0;
    // Attempt extractor agent first so it can persist via tool
    await run(itineraryExtractorAgent, [user(text)], { context });
    const afterLen = Array.isArray(context.trip.segmentedItinerary) ? context.trip.segmentedItinerary.length : 0;
    if (afterLen > 0) {
      context.trip.itineraryStatus = 'fresh';
      return;
    }
    // Fallback safety-net parse
    await ensureItinerarySavedIfMissing(text, context);
  } catch (e) {
    // Final fallback: best-effort parse
    await ensureItinerarySavedIfMissing(text, context);
  }
}

// Trip Planner Agent
export const tripPlannerAgent = new Agent({
  name: 'Trip Planner Agent',
  model: 'gpt-4o-mini',
  instructions: (rc) => [PROMPTS.TRIP_PLANNER, contextSnapshot(rc)].join('\n'),
  tools: [captureTripParams, captureItineraryDays],
  modelSettings: { toolChoice: 'required' }
});

// Booking Agent
export const bookingAgent = new Agent({
  name: 'Booking Agent',
  model: 'gpt-4o-mini',
  instructions: (rc) => [
    `You are a specialized Booking Agent. Your role is to help users book flights, hotels, and other travel services.

RESPONSIBILITIES:
- Help book flights with optimal routes and pricing
- Assist with hotel reservations based on preferences and budget
- Coordinate booking timelines and provide booking checklists
- Offer booking tips and recommendations

BEHAVIOR:
- Confirm all critical booking details before proceeding
- Provide booking options with clear trade-offs (price vs convenience)
- Guide users through booking processes step-by-step
- Always mention refund policies and booking flexibility

REQUIREMENTS GATHERING:
For flights: departure/arrival cities, exact dates, passenger count, class preference, airline preferences
For hotels: location, check-in/out dates, room requirements, amenities needed, budget range

RESPONSE STYLE:
- Be precise and detail-oriented
- Provide clear booking instructions
- Include important booking deadlines and policies
- Offer alternatives if initial preferences aren't available`,
    '',
    'Tool policy (required): On each user message, first extract any of the following fields and then call capture_trip_params before responding:',
    'originCity, destinationCity, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), adults, budgetAmount, currency.',
    'Normalize inputs: If the user writes ₹120000, set currency="INR" and budgetAmount=120000.',
    'After user confirms, call confirm_booking to set bookingConfirmed.',
    contextSnapshot(rc)
  ].join('\n'),
  tools: [confirmBooking, captureTripParams],
  modelSettings: { toolChoice: 'required' }
});

// Gateway Agent (Orchestrator)
export const gatewayAgent = new Agent({
  name: 'Gateway Agent',
  model: 'gpt-4o-mini',
  instructions: (rc) => [
    `${RECOMMENDED_PROMPT_PREFIX}

You are the Gateway Agent for a travel planning system. Your role is to route user requests to the appropriate specialist agent.

ROUTING LOGIC:
- Trip Planning: destination suggestions, itinerary creation, activity recommendations, travel advice
  → Hand off to Trip Planner Agent
- Booking Services: flight bookings, hotel reservations, booking assistance, pricing questions
  → Hand off to Booking Agent

ROUTING EXAMPLES:
"Where should I go in Europe?" → Trip Planner Agent
"Plan a 5-day trip to Tokyo" → Trip Planner Agent
"Book me a flight to Paris" → Booking Agent
"Find hotels in Rome for next week" → Booking Agent

BEHAVIOR:
- Make routing decisions quickly based on the primary intent
- Provide a brief, friendly routing message to the user
- Do NOT attempt to answer travel questions yourself
- Always hand off to the appropriate specialist

RESPONSE STYLE:
- Keep responses short and warm
- Focus on connecting users to the right specialist
- Don't expose technical details about the routing process`,
    contextSnapshot(rc)
  ].join('\n'),
  handoffs: [tripPlannerAgent, bookingAgent],
  modelSettings: { toolChoice: 'required' }
});

// Main execution function with context management
export const runMultiAgentSystem = async (message, chatId, conversationHistory = []) => {
  try {
    // Load existing context
    const context = await loadContext(chatId);
    console.log(`Loaded context for chat ${chatId}:`, context);
    const beforeSnapshot = JSON.parse(JSON.stringify(context));

    // Prepare conversation input
    const input = conversationHistory
      .filter((msg) => msg.role === 'user')
      .map((msg) => user(String(msg.content ?? '')));

    console.log('Running multi-agent system with input:', input);

    // Run the gateway agent with handoffs, passing the actual local context object
    const result = await run(gatewayAgent, input, {
      context
    });

    console.log('Multi-agent result:', result);

    // Optional: update conversation state metadata
    context.conversationState.currentAgent = result.lastAgent?.name;
    context.conversationState.lastIntent = extractIntent(message);

    // If the model produced a plan text but forgot to call the itinerary tool, run extractor fallback
    if (typeof result.finalOutput === 'string') {
      const text = String(result.finalOutput || '');
      await maybeExtractItineraryFromText(text, context);
    }

    // Append debug log entry and save updated context
    context.debugLog.push({
      timestamp: new Date().toISOString(),
      input: String(message ?? ''),
      role: 'user',
      lastAgent: result.lastAgent?.name,
      before: beforeSnapshot,
      after: JSON.parse(JSON.stringify(context)),
      note: 'post-run context snapshot'
    });
    await saveContext(chatId, context);

    return {
      finalOutput: result.finalOutput,
      lastAgent: result.lastAgent?.name,
      context,
      fullResult: result
    };

  } catch (error) {
    console.error('Error in multi-agent system:', error);
    throw error;
  }
};

const extractIntent = (message) => {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('book') || lowerMessage.includes('reserve')) return 'booking';
  if (lowerMessage.includes('plan') || lowerMessage.includes('itinerary')) return 'planning';
  if (lowerMessage.includes('where') || lowerMessage.includes('destination')) return 'destination_search';
  return 'general';
};

export default {
  runMultiAgentSystem,
  gatewayAgent,
  tripPlannerAgent,
  bookingAgent,
  loadContext,
  saveContext
};