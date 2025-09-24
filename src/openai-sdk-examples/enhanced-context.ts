/**
 * Enhanced Context Management with Summary and Itinerary Support
 *
 * Features:
 * - summary: Complete trip summary with origin, destination, dates, budget, etc.
 * - itinerary: Detailed day-wise itinerary with morning/afternoon/evening segments
 * - Agent tools to update both objects
 */

import { Agent, RunContext, run, tool, user } from '@openai/agents';
import { z } from 'zod';
import { RECOMMENDED_PROMPT_PREFIX } from '@openai/agents-core/extensions';
import 'dotenv/config';

// Enhanced App Context with Summary and Itinerary
export interface EnhancedAppContext {
  userInfo: {
    name: string;
    uid: number;
  };
  summary: {
    origin: {
      city: string | null;
      iata: string | null;
    };
    destination: {
      city: string | null;
      iata: string | null;
    };
    outbound_date: string | null;
    return_date: string | null;
    duration_days: number | null;
    passenger_count: number | null;
    budget: {
      amount: number | null;
      currency: string;
      per_person: boolean;
    };
    tripTypes: string[];
    placesOfInterests: Array<{
      placeName: string;
      description: string;
    }>;
  };
  itinerary: {
    days: Array<{
      title: string;
      date: string;
      segments: {
        morning: Array<{
          places: string;
          duration_hours: number;
          descriptor: string;
        }>;
        afternoon: Array<{
          places: string;
          duration_hours: number;
          descriptor: string;
        }>;
        evening: Array<{
          places: string;
          duration_hours: number;
          descriptor: string;
        }>;
      };
    }>;
    computed: {
      duration_days: number | null;
      itinerary_length: number | null;
      matches_duration: boolean;
    };
  };
  logger: {
    log: (...args: any[]) => void;
  };
}

// Zod Schemas
const summarySchema = z.object({
  origin: z.object({
    city: z.string().nullable().optional(),
    iata: z.string().nullable().optional()
  }).default({ city: null, iata: null }),
  destination: z.object({
    city: z.string().nullable().optional(),
    iata: z.string().nullable().optional()
  }).default({ city: null, iata: null }),
  outbound_date: z.string().nullable().optional(),
  return_date: z.string().nullable().optional(),
  duration_days: z.number().nullable().optional(),
  passenger_count: z.number().nullable().optional().describe('Number of passengers (pax)'),
  budget: z.object({
    amount: z.number().nullable().optional(),
    currency: z.string().default('INR'),
    per_person: z.boolean().default(true)
  }).default({}),
  tripTypes: z.array(z.string()).default([]),
  placesOfInterests: z.array(z.object({
    placeName: z.string(),
    description: z.string()
  })).default([])
}).default({});

const itinerarySchema = z.object({
  days: z.array(z.object({
    title: z.string(),
    date: z.string(),
    segments: z.object({
      morning: z.array(z.object({
        places: z.string(),
        duration_hours: z.number(),
        descriptor: z.string()
      })).default([]),
      afternoon: z.array(z.object({
        places: z.string(),
        duration_hours: z.number(),
        descriptor: z.string()
      })).default([]),
      evening: z.array(z.object({
        places: z.string(),
        duration_hours: z.number(),
        descriptor: z.string()
      })).default([])
    })
  })).default([]),
  computed: z.object({
    duration_days: z.number().nullable().optional(),
    itinerary_length: z.number().nullable().optional(),
    matches_duration: z.boolean().default(true)
  }).default({})
}).default({ days: [], computed: {} });

// Utility function to provide context snapshot
function contextSnapshot(runContext?: RunContext<EnhancedAppContext>): string {
  const ctx = runContext?.context;
  if (!ctx) return '';
  const snapshot = {
    user: ctx.userInfo,
    summary: ctx.summary,
    itinerary: ctx.itinerary
  };
  return `\n\n[Enhanced Context Snapshot]\n${JSON.stringify(snapshot, null, 2)}\n`;
}

// Tool to update summary information
const updateSummary = tool<z.infer<typeof summarySchema>, EnhancedAppContext>({
  name: 'update_summary',
  description: 'Update the trip summary with origin, destination, dates, budget, and other trip details.',
  parameters: summarySchema,
  execute: async (
    args: z.infer<typeof summarySchema>,
    runContext?: RunContext<EnhancedAppContext>
  ): Promise<string> => {
    const ctx = runContext?.context;
    if (!ctx) return 'No context available';

    // Deep merge the summary updates
    const currentSummary = ctx.summary;

    // Update origin
    if (args.origin) {
      currentSummary.origin = {
        city: args.origin.city ?? currentSummary.origin.city,
        iata: args.origin.iata ?? currentSummary.origin.iata
      };
    }

    // Update destination
    if (args.destination) {
      currentSummary.destination = {
        city: args.destination.city ?? currentSummary.destination.city,
        iata: args.destination.iata ?? currentSummary.destination.iata
      };
    }

    // Update other fields
    if (args.outbound_date !== undefined) currentSummary.outbound_date = args.outbound_date;
    if (args.return_date !== undefined) currentSummary.return_date = args.return_date;
    if (args.duration_days !== undefined) currentSummary.duration_days = args.duration_days;
    if (args.passenger_count !== undefined) currentSummary.passenger_count = args.passenger_count;

    // Update budget
    if (args.budget) {
      if (args.budget.amount !== undefined) currentSummary.budget.amount = args.budget.amount;
      if (args.budget.currency !== undefined) currentSummary.budget.currency = args.budget.currency;
      if (args.budget.per_person !== undefined) currentSummary.budget.per_person = args.budget.per_person;
    }

    // Update arrays
    if (args.tripTypes && args.tripTypes.length > 0) {
      currentSummary.tripTypes = args.tripTypes;
    }
    if (args.placesOfInterests && args.placesOfInterests.length > 0) {
      currentSummary.placesOfInterests = args.placesOfInterests;
    }

    ctx.logger.log('[update_summary] Summary updated:', currentSummary);
    return 'Trip summary has been updated successfully.';
  },
});

// Tool to update itinerary information
const updateItinerary = tool<z.infer<typeof itinerarySchema>, EnhancedAppContext>({
  name: 'update_itinerary',
  description: 'Update the detailed day-wise itinerary with morning, afternoon, and evening activities.',
  parameters: itinerarySchema,
  execute: async (
    args: z.infer<typeof itinerarySchema>,
    runContext?: RunContext<EnhancedAppContext>
  ): Promise<string> => {
    const ctx = runContext?.context;
    if (!ctx) return 'No context available';

    // Update the itinerary
    ctx.itinerary.days = args.days || [];

    // Update computed fields
    if (args.computed) {
      ctx.itinerary.computed = {
        duration_days: args.computed.duration_days ?? ctx.itinerary.computed.duration_days,
        itinerary_length: args.computed.itinerary_length ?? args.days?.length ?? ctx.itinerary.computed.itinerary_length,
        matches_duration: args.computed.matches_duration ?? ctx.itinerary.computed.matches_duration
      };
    } else {
      // Auto-compute if not provided
      ctx.itinerary.computed.itinerary_length = args.days?.length ?? 0;
    }

    ctx.logger.log('[update_itinerary] Itinerary updated with', ctx.itinerary.days.length, 'days');
    return `Itinerary updated successfully with ${ctx.itinerary.days.length} days.`;
  },
});

// Enhanced Trip Planner Agent with new tools
const enhancedTripPlannerAgent = new Agent<EnhancedAppContext>({
  name: 'Enhanced Trip Planner Agent',
  instructions: (rc?: RunContext<EnhancedAppContext>) => {
    return [
      'You are the Enhanced Trip Planner Agent. You create detailed trip summaries and day-wise itineraries.',
      '',
      'Your responsibilities:',
      '- Extract trip details and update the summary using update_summary tool',
      '- Create detailed day-wise itineraries and update using update_itinerary tool',
      '- Ensure all trip information is captured accurately',
      '',
      'Tool Usage Policy:',
      '1. Always call update_summary first to capture basic trip details',
      '2. Then call update_itinerary when creating day-wise plans',
      '3. Include only confirmed information in your tool calls',
      '',
      'Summary fields to extract:',
      '- origin.city, destination.city (and iata codes if mentioned)',
      '- outbound_date, return_date (YYYY-MM-DD format)',
      '- passenger_count, duration_days',
      '- budget.amount, budget.currency, budget.per_person',
      '- tripTypes (e.g., ["adventure", "cultural", "relaxation"])',
      '- placesOfInterests with placeName and description',
      '',
      'Itinerary structure:',
      '- Each day has title, date, and segments (morning/afternoon/evening)',
      '- Each segment has places (as natural language string), duration_hours, and descriptor',
      '- Compute duration_days, itinerary_length, and matches_duration',
      contextSnapshot(rc),
    ].join('\n');
  },
  tools: [updateSummary, updateItinerary],
  modelSettings: { toolChoice: 'required' }
});

// Enhanced Booking Agent
const enhancedBookingAgent = new Agent<EnhancedAppContext>({
  name: 'Enhanced Booking Agent',
  instructions: (rc?: RunContext<EnhancedAppContext>) => {
    return [
      'You are the Enhanced Booking Agent. You handle booking confirmations and finalize travel arrangements.',
      '',
      'Your responsibilities:',
      '- Extract any missing trip details and update summary using update_summary tool',
      '- Confirm booking details based on existing summary and itinerary',
      '- Provide booking confirmations and next steps',
      '',
      'Tool Usage Policy:',
      '- Always call update_summary if you extract new trip information',
      '- Use existing context to provide accurate booking details',
      '',
      contextSnapshot(rc),
    ].join('\n');
  },
  tools: [updateSummary],
  modelSettings: { toolChoice: 'required' }
});

// Enhanced Gateway Agent for routing
const enhancedGatewayAgent = new Agent<EnhancedAppContext>({
  name: 'Enhanced Gateway Agent',
  instructions: (rc?: RunContext<EnhancedAppContext>) => {
    const base = [
      'You are the Enhanced Travel Gateway Agent (orchestrator).',
      'Route requests to the correct specialist:',
      '- Enhanced Trip Planner Agent → for creating/optimizing itineraries and trip summaries',
      '- Enhanced Booking Agent → for reservations/confirmations',
      '',
      'You NEVER create travel content yourself; keep responses short and route immediately.',
      contextSnapshot(rc),
    ].join('\n');
    return `${RECOMMENDED_PROMPT_PREFIX}${base}`;
  },
  tools: [],
  handoffs: [enhancedTripPlannerAgent, enhancedBookingAgent],
  modelSettings: { toolChoice: 'required' }
});

// Debug event handlers
[enhancedTripPlannerAgent, enhancedBookingAgent, enhancedGatewayAgent].forEach(agent => {
  agent.on('agent_start', (ctx, agentRef) => {
    console.log(`[${agentRef.name}] started`);
    const context = (ctx as any)?.context as EnhancedAppContext;
    if (context) {
      console.log(`[${agentRef.name}] summary:`, JSON.stringify(context.summary, null, 2));
      console.log(`[${agentRef.name}] itinerary days:`, context.itinerary.days.length);
    }
  });

  agent.on('agent_end', (ctx, output) => {
    console.log('[agent] produced:', output);
    const context = (ctx as any)?.context as EnhancedAppContext;
    if (context) {
      console.log('[agent] updated summary:', JSON.stringify(context.summary, null, 2));
      console.log('[agent] updated itinerary days:', context.itinerary.days.length);
    }
  });
});

// Initialize default enhanced context
export function createEnhancedContext(userInfo: { name: string; uid: number }): EnhancedAppContext {
  return {
    userInfo,
    summary: {
      origin: { city: null, iata: null },
      destination: { city: null, iata: null },
      outbound_date: null,
      return_date: null,
      duration_days: null,
      passenger_count: null,
      budget: {
        amount: null,
        currency: 'INR',
        per_person: true
      },
      tripTypes: [],
      placesOfInterests: []
    },
    itinerary: {
      days: [],
      computed: {
        duration_days: null,
        itinerary_length: null,
        matches_duration: true
      }
    },
    logger: console
  };
}

// Demo function to test the enhanced context
export async function demoEnhancedContext() {
  const appContext = createEnhancedContext({ name: 'Harsh', uid: 1 });

  const userMessage = 'I want to plan a 5-day trip from Mumbai to Rome for 2 people, departing 2024-12-15 and returning 2024-12-20. Budget is ₹200000 total. We are interested in historical sites and Italian cuisine.';

  console.log('\n[DEMO USER MESSAGE]\n', userMessage);

  const result = await run(enhancedGatewayAgent, [user(userMessage)], { context: appContext });

  console.log('\n[DEMO RESULT]\n', result.finalOutput);
  console.log('\n[FINAL CONTEXT SUMMARY]\n', JSON.stringify(appContext.summary, null, 2));
  console.log('\n[FINAL CONTEXT ITINERARY]\n', JSON.stringify(appContext.itinerary, null, 2));
}

// Export the main agents for use in other modules
export {
  enhancedTripPlannerAgent,
  enhancedBookingAgent,
  enhancedGatewayAgent,
  updateSummary,
  updateItinerary,
  summarySchema,
  itinerarySchema
};

// Allow running this file directly for testing
if (require.main === module) {
  demoEnhancedContext().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}