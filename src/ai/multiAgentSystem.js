import { Agent, run, tool, user, webSearchTool } from '@openai/agents';
import { AGENT_PROMPTS} from './prompts.js';
// import { AGENT_PROMPTS } from './handoff-prompt.js'
import { RECOMMENDED_PROMPT_PREFIX } from '@openai/agents-core/extensions';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { FLIGHT } from './flight.prompt.js';

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
    upcomingEvents: z.array(z.object({
      eventName: z.string(),
      description: z.string(),
      eventTime: z.string(),
      eventPlace: z.string()
    })).default([]).describe('Upcoming events at the destination (concerts, festivals, conferences, etc.)'),
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
  }).default({}),
  flight: z.object({
    tripType: z.enum(['oneway', 'roundtrip']).default('roundtrip'),
    cabinClass: z.enum(['economy', 'premium_economy', 'business', 'first']).default('economy'),
    resolvedOrigin: z.object({
      userCity: z.string().nullable().optional(),
      airportIATA: z.string().nullable().optional(),
      airportName: z.string().nullable().optional(),
      distance_km: z.number().nullable().optional()
    }).default({}),
    resolvedDestination: z.object({
      userCity: z.string().nullable().optional(),
      airportIATA: z.string().nullable().optional(),
      airportName: z.string().nullable().optional(),
      distance_km: z.number().nullable().optional()
    }).default({}),
    searchResults: z.array(z.object({
      flightId: z.string(),
      airline: z.object({
        code: z.string(),
        name: z.string()
      }),
      departure: z.object({
        airport: z.string(),
        time: z.string(),
        terminal: z.string().nullable().optional()
      }),
      arrival: z.object({
        airport: z.string(),
        time: z.string(),
        terminal: z.string().nullable().optional()
      }),
      duration_minutes: z.number(),
      stops: z.number(),
      price: z.object({
        amount: z.number(),
        currency: z.string()
      }),
      baggage: z.object({
        checkin: z.string().nullable().optional(),
        cabin: z.string().nullable().optional()
      }).nullable().optional(),
      refundable: z.boolean().default(false)
    })).default([]),
    deeplink: z.string().nullable().optional(),
    selectedFlight: z.object({
      outbound: z.string().nullable().optional(),
      return: z.string().nullable().optional()
    }).default({}),
    bookingStatus: z.enum(['pending', 'searching', 'results_shown', 'selected', 'confirmed']).default('pending')
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

    // Add flight field if missing
    if (!parsed.flight) {
      parsed.flight = {
        tripType: 'roundtrip',
        cabinClass: 'economy',
        resolvedOrigin: {},
        resolvedDestination: {},
        searchResults: [],
        deeplink: null,
        selectedFlight: {},
        bookingStatus: 'pending'
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
// Local context snapshot helper - OPTIMIZED (90% size reduction)
// -----------------------------------------------------------------------------
function contextSnapshot(runContext) {
  const ctx = runContext?.context;
  if (!ctx) return '';

  // ✅ OPTIMIZATION: Compressed context - only essential info
  // Before: ~1500-2500 tokens | After: ~150-250 tokens (90% reduction!)
  const snapshot = {
    // Compressed trip info
    trip: ctx.summary.origin?.city && ctx.summary.destination?.city
      ? `${ctx.summary.origin.city} → ${ctx.summary.destination.city}`
      : "Not set",

    // Date range (compressed)
    when: ctx.summary.outbound_date
      ? `${ctx.summary.outbound_date}${ctx.summary.return_date ? ' to ' + ctx.summary.return_date : ''}`
      : null,

    // Simple values
    days: ctx.summary.duration_days || null,
    pax: ctx.summary.pax || null,
    budget: ctx.summary.budget?.amount
      ? `${ctx.summary.budget.currency} ${ctx.summary.budget.amount}${ctx.summary.budget.per_person ? '/person' : ' total'}`
      : null,

    // Boolean flags instead of full arrays (saves tokens!)
    hasItinerary: (ctx.itinerary.days?.length || 0) > 0,
    itineraryDays: ctx.itinerary.days?.length || 0,

    // Trip types as comma-separated string instead of array
    interests: ctx.summary.tripTypes?.length > 0
      ? ctx.summary.tripTypes.join(', ')
      : null
  };

  return `\n\n[Context]\n${JSON.stringify(snapshot)}\n`;  // No pretty print (saves tokens)
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
    upcomingEvents: z.array(z.object({
      eventName: z.string(),
      description: z.string(),
      eventTime: z.string(),
      eventPlace: z.string()
    })).nullable().optional().describe('Upcoming events at the destination (concerts, festivals, conferences, etc.)'),
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

    // Update upcoming events
    if (args.upcomingEvents !== undefined) currentSummary.upcomingEvents = args.upcomingEvents;

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

// Removed update_flight_airports tool - now flight_search accepts IATA codes directly

// Flight search tool - REQUIRES IATA CODES FROM WEB_SEARCH FIRST
export const flight_search = tool({
  name: 'flight_search',
  description: `Search flights and update flight context. ONLY call this AFTER using web_search to get IATA codes.

🚨 CRITICAL WORKFLOW - ALWAYS USE WEB_SEARCH FIRST:
1. User provides cities (e.g., "Delhi to Mumbai")
2. YOU MUST use web_search to find IATA codes FIRST
3. THEN call this tool with IATA codes + flight details

REQUIRED FIELDS FOR SUCCESSFUL FLIGHT SEARCH:
- origin: City name (e.g., "Delhi")
- origin_iata: IATA code from web_search (e.g., "DEL") - MANDATORY
- destination: City name (e.g., "Mumbai")
- destination_iata: IATA code from web_search (e.g., "BOM") - MANDATORY
- outbound_date: YYYY-MM-DD format
- pax: Number of passengers
- cabin_class: economy/premium_economy/business/first
- trip_type: oneway/roundtrip
- return_date: YYYY-MM-DD (required if roundtrip)

CORRECT EXAMPLE (PROACTIVE APPROACH):
User: "Find flights from Delhi to Mumbai on Jan 10"
Step 1: web_search("Delhi airport IATA code") → Extract: DEL
Step 2: web_search("Mumbai airport IATA code") → Extract: BOM
Step 3: flight_search(origin="Delhi", origin_iata="DEL", destination="Mumbai", destination_iata="BOM", outbound_date="2025-01-10", ...)
        → ✅ SUCCESS: Finds flights immediately

❌ WRONG - DO NOT DO THIS (will be blocked):
Step 1: flight_search(origin="Delhi", destination="Mumbai") [NO IATAs]
        → ❌ BLOCKED: Tool will throw error, forcing you to use web_search first

Note: If you call this without IATA codes, the tool will block you and force web_search usage.`,

  parameters: z.object({
    origin: z.string().nullable().optional().describe('Origin city name (e.g., "Nellore", "Delhi")'),
    origin_iata: z.string().nullable().optional().describe('Origin airport IATA code found via web_search (e.g., "TIR", "DEL")'),
    origin_airport_name: z.string().nullable().optional().describe('Origin airport name (e.g., "Tirupati Airport")'),
    origin_distance_km: z.number().nullable().optional().describe('Distance from origin city to airport in km'),
    destination: z.string().nullable().optional().describe('Destination city name (e.g., "Goa", "Mumbai")'),
    destination_iata: z.string().nullable().optional().describe('Destination airport IATA code found via web_search (e.g., "GOI", "BOM")'),
    destination_airport_name: z.string().nullable().optional().describe('Destination airport name'),
    destination_distance_km: z.number().nullable().optional().describe('Distance from destination city to airport in km'),
    outbound_date: z.string().nullable().optional().describe('Departure date in YYYY-MM-DD format'),
    return_date: z.string().nullable().optional().describe('Return date in YYYY-MM-DD format (null for oneway trips)'),
    pax: z.number().min(1).nullable().optional().describe('Number of passengers'),
    cabin_class: z.enum(['economy', 'premium_economy', 'business', 'first']).nullable().optional().describe('Cabin class preference'),
    trip_type: z.enum(['oneway', 'roundtrip']).nullable().optional().describe('Trip type - oneway or roundtrip')
  }),

  async execute(args, runContext) {
    const ctx = runContext?.context;
    if (!ctx) return 'No context available';

    console.log('[flight_search] Tool called with args:', args);

    // STEP 1: Update summary context with city names
    if (args.origin) {
      ctx.summary.origin = { 
        city: args.origin, 
        iata: args.origin_iata || ctx.summary.origin?.iata || null 
      };
      console.log(`[flight_search] Updated summary.origin: ${args.origin}`);
    }
    if (args.destination) {
      ctx.summary.destination = { 
        city: args.destination, 
        iata: args.destination_iata || ctx.summary.destination?.iata || null 
      };
      console.log(`[flight_search] Updated summary.destination: ${args.destination}`);
    }
    if (args.outbound_date) {
      ctx.summary.outbound_date = args.outbound_date;
      console.log(`[flight_search] Updated summary.outbound_date: ${args.outbound_date}`);
    }
    if (args.return_date) {
      ctx.summary.return_date = args.return_date;
      console.log(`[flight_search] Updated summary.return_date: ${args.return_date}`);
    }
    if (args.pax) {
      ctx.summary.pax = args.pax;
      console.log(`[flight_search] Updated summary.pax: ${args.pax}`);
    }

    // STEP 2: Update flight-specific context
    if (args.cabin_class) ctx.flight.cabinClass = args.cabin_class;
    if (args.trip_type) ctx.flight.tripType = args.trip_type;

    // STEP 3: Update airport resolution details if IATA codes provided
    const originCity = args.origin || ctx.summary.origin?.city;
    const destCity = args.destination || ctx.summary.destination?.city;

    // Initialize or update origin airport details
    if (originCity || args.origin_iata) {
      ctx.flight.resolvedOrigin = ctx.flight.resolvedOrigin || {};
      if (originCity) ctx.flight.resolvedOrigin.userCity = originCity;
      if (args.origin_iata) {
        ctx.flight.resolvedOrigin.airportIATA = args.origin_iata;
        ctx.summary.origin = ctx.summary.origin || {};
        ctx.summary.origin.iata = args.origin_iata; // Sync to summary
        console.log(`[flight_search] Stored origin IATA: ${args.origin_iata}`);
      }
      if (args.origin_airport_name) ctx.flight.resolvedOrigin.airportName = args.origin_airport_name;
      if (args.origin_distance_km !== undefined) ctx.flight.resolvedOrigin.distance_km = args.origin_distance_km;
    }

    // Initialize or update destination airport details
    if (destCity || args.destination_iata) {
      ctx.flight.resolvedDestination = ctx.flight.resolvedDestination || {};
      if (destCity) ctx.flight.resolvedDestination.userCity = destCity;
      if (args.destination_iata) {
        ctx.flight.resolvedDestination.airportIATA = args.destination_iata;
        ctx.summary.destination = ctx.summary.destination || {};
        ctx.summary.destination.iata = args.destination_iata; // Sync to summary
        console.log(`[flight_search] Stored destination IATA: ${args.destination_iata}`);
      }
      if (args.destination_airport_name) ctx.flight.resolvedDestination.airportName = args.destination_airport_name;
      if (args.destination_distance_km !== undefined) ctx.flight.resolvedDestination.distance_km = args.destination_distance_km;
    }

    // STEP 4: Validate ALL required fields before calling API
    // Helper function to treat empty strings as falsy
    const getValue = (arg, contextValue) => (arg && arg !== '') ? arg : contextValue;

    const requiredFields = {
      origin_iata: getValue(args.origin_iata, ctx.flight.resolvedOrigin?.airportIATA),
      dest_iata: getValue(args.destination_iata, ctx.flight.resolvedDestination?.airportIATA),
      outbound_date: getValue(args.outbound_date, ctx.summary.outbound_date),
      pax: args.pax || ctx.summary.pax,
      cabin_class: getValue(args.cabin_class, ctx.flight.cabinClass),
      trip_type: getValue(args.trip_type, ctx.flight.tripType)
    };

    // For roundtrip, also need return_date
    if (requiredFields.trip_type === 'roundtrip') {
      requiredFields.return_date = args.return_date || ctx.summary.return_date;
    }

    // Check for missing fields
    const missingFields = Object.entries(requiredFields)
      .filter(([, val]) => !val)
      .map(([key]) => key);

    // CRITICAL: Only call API if ALL fields are present
    if (missingFields.length > 0) {
      const needsIATA = missingFields.includes('origin_iata') || missingFields.includes('dest_iata');

      console.log(`[flight_search] Missing fields: ${missingFields.join(', ')}`);

      if (needsIATA) {
        // Check if this is a repeat call without IATAs (loop detection)
        // We use a flag to track if we already instructed the agent to use web_search
        const wasAlreadyInstructed = ctx.flight._awaitingWebSearch === true;
        const originAlreadyStored = ctx.flight.resolvedOrigin?.userCity;
        const destAlreadyStored = ctx.flight.resolvedDestination?.userCity;

        // Loop detection: agent was already instructed but called flight_search again without IATAs
        if (wasAlreadyInstructed && originAlreadyStored && destAlreadyStored) {
          // This is a REPEAT call - agent ignored our instructions - BLOCK IT
          console.log('[flight_search] ⚠️ LOOP DETECTED - Agent already instructed but called again without IATAs');
          console.log(`[flight_search] Stored cities: ${originAlreadyStored} → ${destAlreadyStored}`);
          console.log('[flight_search] 🚫 BLOCKING repeated call. Agent MUST use web_search first.');

          throw new Error(`🚫 BLOCKED: You already called flight_search for "${originAlreadyStored}" → "${destAlreadyStored}" but didn't provide IATA codes.

⚠️ YOU MUST USE WEB_SEARCH NOW - DO NOT CALL flight_search AGAIN WITHOUT IATA CODES!

MANDATORY NEXT STEPS:
1. web_search("${originAlreadyStored} airport IATA code, if no airport then nearest airport with IATA and distance")
2. web_search("${destAlreadyStored} airport IATA code")
3. Extract IATA codes from search results (3-letter codes like DEL, BOM, GOI, TIR)
4. Then call flight_search with origin_iata="[code]" and destination_iata="[code]"

DO NOT skip step 1-2. DO NOT call flight_search without completing web_search first.`);
        }

        // First call - provide helpful instructions
        const cities = [];
        const searchQueries = [];

        if (missingFields.includes('origin_iata') && originCity) {
          cities.push(`"${originCity}"`);
          searchQueries.push(`web_search("${originCity} airport IATA code, if no airport then nearest airport with IATA and distance")`);
        }
        if (missingFields.includes('dest_iata') && destCity) {
          cities.push(`"${destCity}"`);
          searchQueries.push(`web_search("${destCity} airport IATA code")`);
        }

        if (cities.length > 0) {
          console.log(`[flight_search] First call - instructing agent to use web_search for: ${cities.join(', ')}`);

          // Set a flag to track that we've instructed the agent
          ctx.flight._awaitingWebSearch = true;

          return `✅ Flight context updated with cities: ${cities.join(' → ')}

⚠️ Missing IATA codes. You MUST use web_search to find airport codes.

NEXT STEPS (MANDATORY):
${searchQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}
${searchQueries.length + 1}. Extract 3-letter IATA codes from search results
${searchQueries.length + 2}. Call flight_search again with origin_iata and destination_iata filled in

DO NOT call flight_search again until you complete web_search.`;
        } else {
          return 'Missing IATA codes. Ask user for origin and destination cities.';
        }
      } else {
        // Missing non-IATA fields (dates, pax, etc.)
        const missingInfo = missingFields.filter(f => !f.includes('iata')).join(', ');
        console.log(`[flight_search] Missing non-IATA fields: ${missingInfo}`);
        return `Flight context updated. Missing required information: ${missingInfo}. Ask user to provide these details.`;
      }
    }

    // STEP 5: ALL fields present → Call API
    console.log('[flight_search] ✅ All required fields present. Calling flight API...');
    console.log(`[flight_search] API params: ${requiredFields.origin_iata} → ${requiredFields.dest_iata}, Date: ${requiredFields.outbound_date}, Pax: ${requiredFields.pax}, Class: ${requiredFields.cabin_class}`);

    // Clear the awaiting flag since we have IATAs now
    ctx.flight._awaitingWebSearch = false;

    ctx.flight.bookingStatus = 'searching';

    try {
      // Call your flight search API
      const apiResponse = await callFlightSearchAPI({
        origin: requiredFields.origin_iata,
        destination: requiredFields.dest_iata,
        departureDate: requiredFields.outbound_date,
        returnDate: requiredFields.trip_type === 'roundtrip' ? requiredFields.return_date : null,
        passengers: requiredFields.pax,
        cabinClass: requiredFields.cabin_class
      });

      // STEP 6: Store API response in context
      ctx.flight.searchResults = apiResponse.searchResults;
      ctx.flight.deeplink = apiResponse.deeplink;
      ctx.flight.bookingStatus = 'results_shown';

      const message = `✅ Successfully found ${apiResponse.searchResults.length} flight options from ${requiredFields.origin_iata} to ${requiredFields.dest_iata}. Results and booking link stored in context. Present the top 3-5 options to the user with the CheapOair booking link.`;
      console.log(`[flight_search] ${message}`);
      return message;

    } catch (error) {
      ctx.flight.bookingStatus = 'pending';
      const errorMsg = `❌ Error searching flights: ${error.message}. Inform the user that the flight search failed and ask if they want to try with different criteria.`;
      console.error(`[flight_search] ${errorMsg}`);
      return errorMsg;
    }
  }
});

// Placeholder API function - you'll replace this with your actual API
async function callFlightSearchAPI(params) {
  // Convert dates from YYYY-MM-DD to mm/dd/yyyy format for API
  const formatDateForAPI = (dateStr) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  };

  const formattedParams = {
    ...params,
    departureDate: formatDateForAPI(params.departureDate),
    returnDate: params.returnDate ? formatDateForAPI(params.returnDate) : null
  };

  console.log('[callFlightSearchAPI] Called with params (dates formatted to mm/dd/yyyy):', formattedParams);

  // TODO: Replace this with your actual flight search API call
  // For now, returning dummy data structure
  return {
    searchResults: [
      {
        flightId: 'FL001',
        airline: { code: '6E', name: 'IndiGo' },
        departure: { airport: params.origin, time: `${params.departureDate}T06:30:00`, terminal: '1' },
        arrival: { airport: params.destination, time: `${params.departureDate}T09:45:00`, terminal: '2' },
        duration_minutes: 195,
        stops: 0,
        price: { amount: 4500, currency: 'INR' },
        baggage: { checkin: '15 kg', cabin: '7 kg' },
        refundable: false
      },
      {
        flightId: 'FL002',
        airline: { code: 'AI', name: 'Air India' },
        departure: { airport: params.origin, time: `${params.departureDate}T08:00:00`, terminal: '3' },
        arrival: { airport: params.destination, time: `${params.departureDate}T11:30:00`, terminal: '1' },
        duration_minutes: 210,
        stops: 0,
        price: { amount: 5200, currency: 'INR' },
        baggage: { checkin: '25 kg', cabin: '7 kg' },
        refundable: true
      },
      {
        flightId: 'FL003',
        airline: { code: 'UK', name: 'Vistara' },
        departure: { airport: params.origin, time: `${params.departureDate}T14:15:00`, terminal: '3' },
        arrival: { airport: params.destination, time: `${params.departureDate}T17:45:00`, terminal: '2' },
        duration_minutes: 210,
        stops: 0,
        price: { amount: 5800, currency: 'INR' },
        baggage: { checkin: '20 kg', cabin: '7 kg' },
        refundable: true
      }
    ],
    deeplink: 'https://www.cheapoair.com/flights/results?origin=' + params.origin + '&destination=' + params.destination
  };
}

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

// Trip Planner Agent - OPTIMIZED FOR SPEED (minimal tools - async extraction approach)
export const tripPlannerAgent = new Agent({
  name: 'Trip Planner Agent',
  model: 'gpt-4.1',
  instructions: (rc) => [
    AGENT_PROMPTS.TRIP_PLANNER, // Using optimized GPT-4.1 prompt
    contextSnapshot(rc)
  ].join('\n'),
  tools: [webSearchTool()],  // ✅ ONLY web_search for real-time info - Context extraction happens async via extractor agent
  modelSettings: {
    // ✅ OPTIMIZATION: Set max_tokens to prevent over-generation
    max_tokens: 3000,  // Enough for detailed 7-day itinerary

    // ✅ OPTIMIZATION: Add stop sequences
    stop: [
      "\n---END---",
      "\n\n\n\n"  // 4 consecutive newlines indicate end
    ]
  }
  // Note: Minimal tools (only web_search) = faster response, context updated by extractor agent after streaming
  // Handoffs added after all agents are defined (see bottom of file)
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

// Define structured output schema for Context Extractor
const contextExtractionSchema = z.object({
  summary: z.object({
    origin: z.object({
      city: z.string(),
      iata: z.string().nullable()
    }).nullable().optional().describe('Departure city with IATA code'),
    destination: z.object({
      city: z.string(),
      iata: z.string().nullable()
    }).nullable().optional().describe('Arrival city with IATA code'),
    outbound_date: z.string().nullable().optional().describe('Departure date in YYYY-MM-DD format'),
    return_date: z.string().nullable().optional().describe('Return date in YYYY-MM-DD format (auto-calculated from outbound_date + duration_days)'),
    duration_days: z.number().nullable().optional().describe('Trip duration in days'),
    pax: z.number().nullable().optional().describe('Number of passengers'),
    budget: z.object({
      amount: z.number().nullable().optional(),
      currency: z.string().nullable().optional(),
      per_person: z.boolean().nullable().optional()
    }).nullable().optional().describe('Budget information'),
    tripTypes: z.array(z.string()).nullable().optional().describe('Trip interests/types'),
    placesOfInterest: z.array(z.object({
      placeName: z.string(),
      description: z.string()
    })).nullable().optional().describe('Places mentioned in itinerary'),
    upcomingEvents: z.array(z.object({
      eventName: z.string(),
      description: z.string(),
      eventTime: z.string(),
      eventPlace: z.string()
    })).nullable().optional().describe('Events mentioned'),
    suggestedQuestions: z.array(z.string()).nullable().optional().describe('Follow-up questions from assistant')
  }).describe('Trip summary updates - include ONLY fields that changed'),
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
  }).nullable().optional().describe('Full day-by-day itinerary if assistant provided one')
});

// Context Extractor Agent - ASYNC EXTRACTION (called after Trip Planner streaming completes)
// Uses structured output instead of tools for direct input/output transformation
export const contextExtractorAgent = new Agent({
  name: 'Context Extractor Agent',
  model: 'gpt-4.1', // Using GPT-4.1 optimized for instruction following
  outputType: contextExtractionSchema, // Zod schema for structured output
  instructions: AGENT_PROMPTS.EXTRACTOR_AGENT
});

// Flight Specialist Agent - ONLY 2 TOOLS: flight_search + web_search
export const flightSpecialistAgent = new Agent({
  name: 'Flight Specialist Agent',
  model: 'gpt-4.1',
  instructions: (rc) => [
    AGENT_PROMPTS.FLIGHT_SPECIALIST,
    contextSnapshot(rc)
  ].join('\n'),
  tools: [flight_search, webSearchTool()],
  modelSettings:{
    parallelToolCalls: true // Enable parallel tool calls for efficiency
  }
});

// Flight Specialist Agent - event handler for logging
flightSpecialistAgent.on('agent_end', async (ctx) => {
  console.log('Flight Specialist Agent ended.');

  // Log flight search status
  console.log(`Flight booking status: ${ctx.context.flight.bookingStatus}`);
  console.log(`Flight results: ${ctx.context.flight.searchResults.length} options`);
  console.log(`Origin: ${ctx.context.flight.resolvedOrigin?.userCity || 'NOT SET'} (${ctx.context.flight.resolvedOrigin?.airportIATA || 'N/A'})`);
  console.log(`Destination: ${ctx.context.flight.resolvedDestination?.userCity || 'NOT SET'} (${ctx.context.flight.resolvedDestination?.airportIATA || 'N/A'})`);
  console.log(`Cabin class: ${ctx.context.flight.cabinClass}`);
  console.log(`Trip type: ${ctx.context.flight.tripType}`);
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

// Gateway Agent (Orchestrator) - GPT-4.1 Optimized
export const gatewayAgent = new Agent({
  name: 'Gateway Agent',
  model: 'gpt-4.1', // Upgraded to GPT-4.1 for better routing accuracy
  instructions: (rc) => [
    `${RECOMMENDED_PROMPT_PREFIX}\n\n`, // OpenAI SDK recommended prefix for handoff agents
   AGENT_PROMPTS.ORCHESTRATOR, // Using GPT-4.1 optimized prompt
    contextSnapshot(rc)
  ].join('\n'),
  handoffs: [tripPlannerAgent, flightSpecialistAgent],
  modelSettings: { toolChoice: 'required' },
  tools:[]
});

// Configure handoffs for Trip Planner Agent (must be done after all agents are defined)
tripPlannerAgent.handoffs = [flightSpecialistAgent, bookingAgent];

// Main execution function with context management - OPTIMIZED
export const runMultiAgentSystem = async (message, chatId, conversationHistory = [], enableStreaming = true) => {  // ✅ OPTIMIZATION: Default streaming = true
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
    console.log(`✅ Streaming enabled: ${enableStreaming}`);  // Log streaming status

    // Run the gateway agent with handoffs, passing the actual local context object
    const result = await run(gatewayAgent, input, {
      context,
      stream: enableStreaming  // ✅ OPTIMIZATION: Streaming for better perceived performance
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
  flightSpecialistAgent,
  bookingAgent,
  loadContext,
  saveContext
};