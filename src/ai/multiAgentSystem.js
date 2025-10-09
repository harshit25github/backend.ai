import { Agent, run, tool, user, webSearchTool } from '@openai/agents';
import PROMPTS from './prompts.js';
import { RECOMMENDED_PROMPT_PREFIX } from '@openai/agents-core/extensions';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
// import { nullable } from 'zod'; // Not needed - use .nullable() method on schemas

// Context schema for our travel planning system (new DB-like format)
export const AppContext = z.object({
  userInfo: z.object({
    name: z.string().nullable().optional(),
    preferences: z.array(z.string()).default([])
  }).default({}),
  summary: z.object({
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
    pax: z.number().nullable().optional().describe('Number of passengers (pax)'),
    budget: z.object({
      amount: z.number().nullable().optional(),
      currency: z.string().default('INR'),
      per_person: z.boolean().default(true)
    }).default({}),
    tripTypes: z.array(z.string()).default([]),
    placesOfInterest: z.array(z.object({
      placeName: z.string(),
      description: z.string()
    })).default([]),
    suggestedQuestions: z.array(z.string()).default([]).describe('3-6 questions user might ask agent to enhance their trip')
  }).default({}),
  itinerary: z.object({
    days: z.array(z.object({
      title: z.string(),
      date: z.string(),
      segments: z.object({
        morning: z.array(z.object({
          place: z.string().describe('Brief description of place/activity, maximum 4 words (e.g., "Colosseum Area Tour", "Vatican City Visit", "Montmartre Walk")'),
          duration_hours: z.number().describe('Total duration in hours for this time segment'),
          descriptor: z.string().describe('Brief description of activities, maximum 4 words (e.g., "Ancient Rome Exploration")')
        })).describe('Array containing exactly 1 object combining all morning activities'),
        afternoon: z.array(z.object({
          place: z.string().describe('Brief description of place/activity, maximum 4 words (e.g., "Vatican Museums Tour", "Latin Quarter Lunch", "Central Park Picnic")'),
          duration_hours: z.number().describe('Total duration in hours for this time segment'),
          descriptor: z.string().describe('Brief description of activities, maximum 4 words (e.g., "Vatican Art Experience")')
        })).describe('Array containing exactly 1 object combining all afternoon activities'),
        evening: z.array(z.object({
          place: z.string().describe('Brief description of place/activity, maximum 4 words (e.g., "Trastevere Dinner Walk", "Seine River Cruise", "Times Square Evening")'),
          duration_hours: z.number().describe('Total duration in hours for this time segment'),
          descriptor: z.string().describe('Brief description of activities, maximum 4 words (e.g., "Evening Neighborhood Experience")')
        })).describe('Array containing exactly 1 object combining all evening activities')
      })
    })).default([]),
    computed: z.object({
      duration_days: z.number().nullable().optional(),
      itinerary_length: z.number().nullable().optional(),
      matches_duration: z.boolean().default(true)
    }).default({})
  }).default({ days: [], computed: {} }),
  conversationState: z.object({
    currentAgent: z.string().nullable().optional(),
    lastIntent: z.string().nullable().optional(),
    awaitingConfirmation: z.boolean().default(false)
  }).default({}),
  trip: z.object({
    bookingStatus: z.enum(['pending', 'confirmed', 'booked', 'cancelled']).default('pending'),
    bookingConfirmed: z.boolean().default(false),
    bookingDetails: z.object({
      flights: z.array(z.object({
        from: z.string(),
        to: z.string(),
        date: z.string(),
        airline: z.string().nullable().optional(),
        price: z.number().nullable().optional()
      })).default([]),
      hotels: z.array(z.object({
        name: z.string(),
        location: z.string(),
        checkIn: z.string(),
        checkOut: z.string(),
        price: z.number().nullable().optional()
      })).default([]),
      activities: z.array(z.object({
        name: z.string(),
        date: z.string(),
        price: z.number().nullable().optional()
      })).default([])
    }).default({})
  }).default({})
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

    // Migrate old format to new format if needed
    if (Array.isArray(parsed.itinerary)) {
      console.log(`Migrating context ${chatId} from old format to new format`);
      parsed.itinerary = {
        days: parsed.itinerary,
        computed: {
          duration_days: parsed.itinerary.length,
          itinerary_length: parsed.itinerary.length,
          matches_duration: true
        }
      };
    }

    // Add trip field if missing
    if (!parsed.trip) {
      parsed.trip = {
        bookingStatus: 'pending',
        bookingConfirmed: false,
        bookingDetails: {
          flights: [],
          hotels: [],
          activities: []
        }
      };
    }

    // Ensure summary.origin and summary.destination are objects
    if (parsed.summary && parsed.summary.origin && typeof parsed.summary.origin === 'string') {
      parsed.summary.origin = { city: parsed.summary.origin, iata: null };
    }
    if (parsed.summary && parsed.summary.destination && typeof parsed.summary.destination === 'string') {
      parsed.summary.destination = { city: parsed.summary.destination, iata: null };
    }

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
// Utility functions
// -----------------------------------------------------------------------------

// Convert places array to natural language string (for backward compatibility)
export function formatPlacesArray(places) {
  if (!places || places.length === 0) return '';
  if (places.length === 1) return places[0];
  if (places.length === 2) return `${places[0]} and ${places[1]}`;
  return `${places.slice(0, -1).join(', ')}, and ${places[places.length - 1]}`;
}

// -----------------------------------------------------------------------------
// Local context snapshot helper
// -----------------------------------------------------------------------------
function contextSnapshot(runContext) {
  const ctx = runContext?.context;
  if (!ctx) return '';

  // Places are now generated as natural language strings from the beginning
  // No formatting needed - the context already contains the natural language format

  const snapshot = {
    user: ctx.userInfo,
    summary: {
      origin: ctx.summary.origin,
      destination: ctx.summary.destination,
      outbound_date: ctx.summary.outbound_date,
      return_date: ctx.summary.return_date,
      duration_days: ctx.summary.duration_days,
      pax: ctx.summary.pax,
      budget: ctx.summary.budget,
      tripTypes: ctx.summary.tripTypes,
      placesOfInterest: ctx.summary.placesOfInterest
    },
    itinerary: ctx.itinerary
  };
  return `\n\n[Local Context Snapshot]\n${JSON.stringify(snapshot, null, 2)}\n`;
}

// -----------------------------------------------------------------------------
// Tools that directly mutate local context
// -----------------------------------------------------------------------------
// Legacy tool - kept for backward compatibility
export const captureTripParams = tool({
  name: 'capture_trip_params',
  description: 'Update local context with any provided trip details (origin, destination, dates, passesnger count , budget, currency, trip types, places of interest).',
  parameters: z.object({
    origin: z.string().nullable().optional(),
    destination: z.string().nullable().optional(),
    outbound_date: z.string().nullable().optional(),
    return_date: z.string().nullable().optional(),
    duration_days: z.number().nullable().optional(),
    budget_amount: z.number().positive().nullable().optional(),
    budget_currency: z.string().nullable().optional(),
    budget_per_person: z.boolean().nullable().optional(),
    tripTypes: z.array(z.string()).nullable().optional(),
    placesOfInterest: z.array(z.object({
      placeName: z.string(),
      description: z.string()
    })).nullable().optional(),
    itinerary: z.object({
      days: z.array(z.object({
        title: z.string(),
        date: z.string(),
        segments: z.object({
          morning: z.array(z.object({
            place: z.string(),
            duration_hours: z.number(),
            descriptor: z.string()
          })),
          afternoon: z.array(z.object({
            place: z.string(),
            duration_hours: z.number(),
            descriptor: z.string()
          })),
          evening: z.array(z.object({
            place: z.string(),
            duration_hours: z.number(),
            descriptor: z.string()
          }))
        })
      }))
    }).nullable().optional()
  }),
  async execute(args, runContext) {
    const ctx = runContext?.context;
    if (!ctx) return 'No context available';

    // Update summary fields
    if (args.origin != null) ctx.summary.origin = args.origin ?? undefined;
    if (args.destination != null) ctx.summary.destination = args.destination ?? undefined;
    if (args.outbound_date != null) ctx.summary.outbound_date = args.outbound_date ?? undefined;
    if (args.return_date != null) ctx.summary.return_date = args.return_date ?? undefined;
    if (args.duration_days != null) ctx.summary.duration_days = args.duration_days ?? undefined;

    // Update budget
    if (args.budget_amount != null) ctx.summary.budget.amount = args.budget_amount;
    if (args.budget_currency != null) ctx.summary.budget.currency = args.budget_currency;
    if (args.budget_per_person != null) ctx.summary.budget.per_person = args.budget_per_person;

    // Update trip types and places of interest
    if (args.tripTypes != null) ctx.summary.tripTypes = args.tripTypes;
    if (args.placesOfInterest != null) ctx.summary.placesOfInterest = args.placesOfInterest;

    return 'Trip parameters captured in local context.';
  }
});

// Enhanced update_summary tool (like enhanced-manager.js)
export const update_summary = tool({
  name: 'update_summary',
  description: 'CRITICAL: Update trip summary with any provided details. You MUST call this tool EVERY time user mentions trip information (origin, destination, dates, pax, budget, preferences, modifications). This is MANDATORY - do not skip.',
  parameters: z.object({
    origin: z.string().nullable().optional().describe('Origin city name'),
    origin_iata: z.string().nullable().optional().describe('Origin airport IATA code'),
    destination: z.string().nullable().optional().describe('Destination city name'),
    destination_iata: z.string().nullable().optional().describe('Destination airport IATA code'),
    outbound_date: z.string().nullable().optional().describe('Departure date (YYYY-MM-DD)'),
    return_date: z.string().nullable().optional().describe('Return date (YYYY-MM-DD) - will be auto-calculated if not provided'),
    duration_days: z.number().nullable().optional().describe('Trip duration in days'),
    pax: z.number().min(1).nullable().optional().describe('Number of passengers (pax)'),
    budget_amount: z.number().positive().nullable().optional().describe('Budget amount'),
    budget_currency: z.string().nullable().optional().describe('Budget currency (INR, USD, EUR, etc.)'),
    budget_per_person: z.boolean().nullable().optional().describe('Whether budget is per person or total'),
    tripTypes: z.array(z.string()).nullable().optional().describe('Trip types/interests (e.g., ["adventure", "cultural", "food"])'),
    placesOfInterest: z.array(z.object({
      placeName: z.string(),
      description: z.string()
    })).nullable().optional().describe('5 popular places of interest at the destination with name and description'),
    suggestedQuestions: z.array(z.string()).nullable().optional().describe('3-6 questions USER might ask AGENT to enhance trip (e.g., "What are the best hotels near Eiffel Tower?")')
  }),
  async execute(args, runContext) {
    const ctx = runContext?.context;
    if (!ctx) return 'No context available';

    const currentSummary = ctx.summary;

    // Update origin (support both string and object format)
    if (args.origin != null) {
      currentSummary.origin = {
        city: args.origin,
        iata: args.origin_iata || currentSummary.origin?.iata || null
      };
    }
    if (args.origin_iata != null && currentSummary.origin) {
      currentSummary.origin.iata = args.origin_iata;
    }

    // Update destination (support both string and object format)
    if (args.destination != null) {
      currentSummary.destination = {
        city: args.destination,
        iata: args.destination_iata || currentSummary.destination?.iata || null
      };
    }
    if (args.destination_iata != null && currentSummary.destination) {
      currentSummary.destination.iata = args.destination_iata;
    }

    // Update other fields
    if (args.outbound_date !== undefined) currentSummary.outbound_date = args.outbound_date;
    if (args.duration_days !== undefined) currentSummary.duration_days = args.duration_days;
    if (args.pax !== undefined) currentSummary.pax = args.pax;

    // Update budget
    if (args.budget_amount !== undefined) currentSummary.budget.amount = args.budget_amount;
    if (args.budget_currency !== undefined) currentSummary.budget.currency = args.budget_currency;
    if (args.budget_per_person !== undefined) currentSummary.budget.per_person = args.budget_per_person;

    // Update trip types
    if (args.tripTypes !== undefined) currentSummary.tripTypes = args.tripTypes;

    // Update places of interest
    if (args.placesOfInterest !== undefined) currentSummary.placesOfInterest = args.placesOfInterest;

    // Update suggested questions
    if (args.suggestedQuestions !== undefined) currentSummary.suggestedQuestions = args.suggestedQuestions;

    // Auto-calculate return_date if outbound_date and duration_days are provided
    // IMPORTANT: Calculate BEFORE potentially overwriting with args.return_date
    // This ensures correct calculation even if agent provides wrong return_date
    if (currentSummary.outbound_date && currentSummary.duration_days) {
      try {
        const outboundDate = new Date(currentSummary.outbound_date);
        if (!isNaN(outboundDate.getTime())) {
          const returnDate = new Date(outboundDate);
          returnDate.setDate(returnDate.getDate() + currentSummary.duration_days);
          const calculatedReturn = returnDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD

          // Use calculated return date (override any provided return_date to ensure accuracy)
          currentSummary.return_date = calculatedReturn;
          console.log('[update_summary] Auto-calculated return_date:', calculatedReturn);
        }
      } catch (err) {
        console.log('[update_summary] Could not auto-calculate return_date:', err.message);
        // Fallback to provided return_date if calculation fails
        if (args.return_date !== undefined) currentSummary.return_date = args.return_date;
      }
    } else if (args.return_date !== undefined) {
      // Only use provided return_date if we can't calculate it
      currentSummary.return_date = args.return_date;
    }

    return 'Trip summary updated successfully.';
  }
});

// New update_itinerary tool (like enhanced-manager.js)
export const update_itinerary = tool({
  name: 'update_itinerary',
  description: 'Update or create the day-by-day itinerary. Call this when presenting a detailed itinerary to the user.',
  parameters: z.object({
    days: z.array(z.object({
      title: z.string().describe('Day title (e.g., "Day 1: Arrival in Paris")'),
      date: z.string().describe('Date in YYYY-MM-DD format'),
      segments: z.object({
        morning: z.array(z.object({
          place: z.string().describe('Brief description of place/activity, maximum 4 words (e.g., "Colosseum Area Tour", "Vatican City Visit", "Montmartre Walk")'),
          duration_hours: z.number().describe('Total duration in hours for this time segment'),
          descriptor: z.string().describe('Brief description of activities, maximum 4 words (e.g., "Ancient Rome Exploration")')
        })).describe('Array containing exactly 1 object combining all morning activities'),
        afternoon: z.array(z.object({
          place: z.string().describe('Brief description of place/activity, maximum 4 words (e.g., "Vatican Museums Tour", "Latin Quarter Lunch", "Central Park Picnic")'),
          duration_hours: z.number().describe('Total duration in hours for this time segment'),
          descriptor: z.string().describe('Brief description of activities, maximum 4 words (e.g., "Vatican Art Experience")')
        })).describe('Array containing exactly 1 object combining all afternoon activities'),
        evening: z.array(z.object({
          place: z.string().describe('Brief description of place/activity, maximum 4 words (e.g., "Trastevere Dinner Walk", "Seine River Cruise", "Times Square Evening")'),
          duration_hours: z.number().describe('Total duration in hours for this time segment'),
          descriptor: z.string().describe('Brief description of activities, maximum 4 words (e.g., "Evening Neighborhood Experience")')
        })).describe('Array containing exactly 1 object combining all evening activities')
      })
    })).describe('Array of day-by-day itinerary')
  }),
  async execute(args, runContext) {
    const ctx = runContext?.context;
    if (!ctx) return 'No context available';

    // Update itinerary
    ctx.itinerary.days = args.days;

    // Auto-compute if not provided
    if (args.days) {
      ctx.itinerary.computed.itinerary_length = args.days.length;
      ctx.itinerary.computed.duration_days = args.days.length;

      // IMPORTANT: Sync duration_days back to summary when itinerary changes
      // This ensures when user asks to change itinerary length (e.g., 15 days → 8 days),
      // the trip duration in summary is automatically updated to match
      if (ctx.summary.duration_days !== args.days.length) {
        ctx.summary.duration_days = args.days.length;
        console.log('[update_itinerary] Auto-synced summary.duration_days to match itinerary length:', args.days.length);

        // Also recalculate return_date if outbound_date exists
        if (ctx.summary.outbound_date) {
          try {
            const outboundDate = new Date(ctx.summary.outbound_date);
            if (!isNaN(outboundDate.getTime())) {
              const returnDate = new Date(outboundDate);
              returnDate.setDate(returnDate.getDate() + args.days.length);
              ctx.summary.return_date = returnDate.toISOString().split('T')[0];
              console.log('[update_itinerary] Auto-recalculated return_date:', ctx.summary.return_date);
            }
          } catch (err) {
            console.log('[update_itinerary] Could not recalculate return_date:', err.message);
          }
        }
      }

      // Update matches_duration flag
      ctx.itinerary.computed.matches_duration = (ctx.summary.duration_days === args.days.length);
    }

    return `Itinerary with ${args.days.length} days has been saved successfully.`;
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

// Legacy tools removed - now using update_summary and update_itinerary instead

// Check if all critical slots are filled for itinerary generation
export function hasAllCriticalSlots(context) {
  const summary = context?.summary || {};
  return !!(
    summary.origin &&
    summary.destination &&
    summary.duration_days &&
    summary.pax &&
    summary.budget?.amount &&
    summary.budget?.currency
  );
}

// Check if itinerary-related tools were called in the response
export function wasItineraryToolCalled(response) {
  if (!response?.generatedItems) return false;

  return response.generatedItems.some(item =>
    item.type === 'tool_call_item' &&
    (item.rawItem?.name === 'capture_itinerary_days' || item.rawItem?.name === 'emit_itinerary')
  );
}

// All extraction logic removed - using direct tool calls instead

// Trip Planner Agent - With enhanced tools
export const tripPlannerAgent = new Agent({
  name: 'Trip Planner Agent',
  model: 'gpt-4.1',
  instructions: (rc) => [
    PROMPTS.TRIP_PLANNER_MODIFIED, // Using optimized GPT-4.1 prompt
    contextSnapshot(rc)
  ].join('\n'),
  tools: [update_summary, update_itinerary,webSearchTool()] // Enhanced tools for summary and itinerary
  // Note: toolChoice set to 'auto' (default) - agent decides when to use tools vs provide text response
})

// Trip Planner Agent - event handler for logging
tripPlannerAgent.on('agent_end', async (ctx, output) => {
  console.log('Trip Planner Agent ended.');
  
  // Handle both string and object formats for destination
  const destinationObj = ctx.context?.summary?.destination;
  const destinationName = typeof destinationObj === 'object' ? destinationObj?.city : destinationObj;

  // Log current context state
  console.log(`Destination: ${destinationName || 'NOT SET'}`);
  console.log(`Passenger count: ${ctx.context.summary.pax || 'NOT SET'}`);
  console.log(`Trip types: ${ctx.context.summary.tripTypes?.length > 0 ? ctx.context.summary.tripTypes.join(', ') : 'NOT SET'}`);
  console.log(`Places of interest: ${ctx.context.summary.placesOfInterest?.length || 0} places`);
  console.log(`Suggested questions: ${ctx.context.summary.suggestedQuestions?.length || 0} questions`);
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
    'Tool usage: Call confirm_booking when user confirms they want to proceed with booking.',
    contextSnapshot(rc)
  ].join('\n'),
  tools: [confirmBooking]
  // Note: toolChoice set to 'auto' (default) - agent decides when to use tools
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
  modelSettings: { toolChoice: 'required' },
  tools:[]
});

// Main execution function with context management
export const runMultiAgentSystem = async (message, chatId, conversationHistory = [], enableStreaming = false) => {
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
      context,
      stream: enableStreaming
    });

    console.log('Multi-agent result:', result);

    // Optional: update conversation state metadata
    context.conversationState.currentAgent = result.lastAgent?.name;
    context.conversationState.lastIntent = extractIntent(message);

    // Save context - all data captured via tools
    await saveContext(chatId, context);

    return {
      finalOutput: result.finalOutput,
      lastAgent: result.lastAgent?.name,
      context,
      stream: enableStreaming ? result : null,
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