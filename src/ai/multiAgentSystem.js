import { Agent, run, tool, user } from '@openai/agents';
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
    origin: z.string().nullable().optional(),
    destination: z.string().nullable().optional(),
    outbound_date: z.string().nullable().optional(),
    return_date: z.string().nullable().optional(),
    duration_days: z.number().nullable().optional(),
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
  }).default({}),
  itinerary: z.object({
    days: z.array(z.object({
      title: z.string(),
      date: z.string(),
      segments: z.object({
        morning: z.array(z.object({
          places: z.string(), // Now expects natural language string instead of array
          duration_hours: z.number(),
          descriptor: z.string()
        })).default([]),
        afternoon: z.array(z.object({
          places: z.string(), // Now expects natural language string instead of array
          duration_hours: z.number(),
          descriptor: z.string()
        })).default([]),
        evening: z.array(z.object({
          places: z.string(), // Now expects natural language string instead of array
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
      budget: ctx.summary.budget,
      tripTypes: ctx.summary.tripTypes,
      placesOfInterests: ctx.summary.placesOfInterests
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
  description: 'Update local context with any provided trip details (origin, destination, dates, pax, budget, currency, trip types, places of interest).',
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
    placesOfInterests: z.array(z.object({
      placeName: z.string(),
      description: z.string()
    })).nullable().optional(),
    itinerary: z.object({
      days: z.array(z.object({
        title: z.string(),
        date: z.string(),
        segments: z.object({
          morning: z.array(z.object({
            places: z.string(), // Now expects natural language string instead of array
            duration_hours: z.number(),
            descriptor: z.string()
          })).default([]),
          afternoon: z.array(z.object({
            places: z.string(), // Now expects natural language string instead of array
            duration_hours: z.number(),
            descriptor: z.string()
          })).default([]),
          evening: z.array(z.object({
            places: z.string(), // Now expects natural language string instead of array
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
    if (args.placesOfInterests != null) ctx.summary.placesOfInterests = args.placesOfInterests;

    return 'Trip parameters captured in local context.';
  }
});

// New tool - matches the new prompt requirements
export const captureTripContext = tool({
  name: 'capture_trip_context',
  description: 'Update local context with any provided trip details. Must be called on every assistant turn to upsert known fields.',
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
    placesOfInterests: z.array(z.object({
      placeName: z.string(),
      description: z.string()
    })).nullable().optional(),
    itinerary: z.object({
      days: z.array(z.object({
        title: z.string(),
        date: z.string(),
        segments: z.object({
          morning: z.array(z.object({
            places: z.string(), // Now expects natural language string instead of array
            duration_hours: z.number(),
            descriptor: z.string()
          })).default([]),
          afternoon: z.array(z.object({
            places: z.string(), // Now expects natural language string instead of array
            duration_hours: z.number(),
            descriptor: z.string()
          })).default([]),
          evening: z.array(z.object({
            places: z.string(), // Now expects natural language string instead of array
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
    if (args.placesOfInterests != null) ctx.summary.placesOfInterests = args.placesOfInterests;

    // Update itinerary if provided
    if (args.itinerary) {
      ctx.itinerary = args.itinerary;
    }

    return 'Trip context captured and updated.';
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

// Removed legacy capture_itinerary_days tool. Extraction now uses structured parsing.


// -----------------------------------------------------------------------------
// Safety net: parse itinerary text and persist if model forgot to call tool
// -----------------------------------------------------------------------------
export function parseItineraryFromText(text) {
  const lines = text.split(/\r?\n/);
  const days = [];
  let currentDay = null;
  let currentSegment = null;
  let currentSegmentData = null;

  const dayHeader = /^\s*(?:#{1,6}\s*)?(?:Day\s*\d+\s*[:\-]?\s*|Day\s*\d+\s*[:\-]?\s*-\s*[^:]*?\s*\(?(\d{4}-\d{2}-\d{2})\)?)/i;
  const segHeader = /^\s*(?:[-•*#]\s*)?(?:\*\*)?\s*(?:🌅|☀️|🌆)?\s*(Morning|Afternoon|Evening)\s*(?:\*\*)?\s*[:\-]?\s*(.*)$/i;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const mDay = line.match(dayHeader);
    if (mDay) {
      if (currentDay) days.push(currentDay);
      const dateMatch = mDay[1] || new Date().toISOString().split('T')[0]; // Extract date from capture group
      const title = line.replace(/^\s*(?:#{1,6}\s*)?(?:Day\s*\d+\s*[:\-]?\s*-\s*[^:]*?\s*\(?\d{4}-\d{2}-\d{2}\)?\s*|Day\s*\d+\s*[:\-]?\s*)/i, '').trim();
      currentDay = {
        title: title || `Day ${days.length + 1}`,
        date: dateMatch,
        segments: {
          morning: [],
          afternoon: [],
          evening: []
        }
      };
      currentSegment = null;
      currentSegmentData = null;
      continue;
    }

    const mSeg = line.match(segHeader);
    if (mSeg) {
      if (!currentDay) {
        currentDay = {
          title: `Day ${days.length + 1}`,
          date: new Date().toISOString().split('T')[0],
          segments: { morning: [], afternoon: [], evening: [] }
        };
      }
      const seg = mSeg[1].toLowerCase();
      currentSegment = seg;
      const descriptor = mSeg[2]?.trim() || 'planned activity';

      // Create segment data with natural language places string
      // Keep descriptor to 2-3 words maximum
      const shortDescriptor = descriptor.split(' ').slice(0, 3).join(' ');
      currentSegmentData = {
        places: descriptor, // Start with natural language string
        duration_hours: 2, // default duration
        descriptor: shortDescriptor
      };
      currentDay.segments[seg].push(currentSegmentData);
      continue;
    }

    // If we have a current segment and this looks like an activity line
    if (currentDay && currentSegment && /^[-•]/.test(line)) {
      const content = line.replace(/^[-•]\s*/, '').trim();
      if (content && currentSegmentData) {
        // Combine places into natural language string
        if (currentSegmentData.places.includes(' and ')) {
          // Already has multiple places, add to the end
          const basePlaces = currentSegmentData.places;
          const lastPart = basePlaces.split(', and ')[1] || basePlaces.split(' and ')[1];
          const newPlaces = basePlaces.replace(lastPart, `${lastPart}, ${content}`);
          currentSegmentData.places = newPlaces;
        } else {
          // Combine two places
          currentSegmentData.places = `${currentSegmentData.places} and ${content}`;
        }
      }
      continue;
    }
  }

  if (currentDay) days.push(currentDay);
  return days;
}

export async function ensureItinerarySavedIfMissing(outputText, appContext) {
  const hasPlanText = /\bDay\b/i.test(outputText) && /(Morning|Afternoon|Evening)/i.test(outputText);
  const hasItin = Array.isArray(appContext.itinerary?.days) && appContext.itinerary.days.length > 0;
  if (!hasPlanText || hasItin) return;
  const parsed = parseItineraryFromText(outputText);
  if (parsed.length === 0) return;

  // Convert places arrays to natural language strings
  const formatPlacesArray = (places) => {
    if (typeof places === 'string') return places; // Already a string
    if (!places || places.length === 0) return '';
    if (places.length === 1) return places[0];
    if (places.length === 2) return `${places[0]} and ${places[1]}`;
    return `${places.slice(0, -1).join(', ')}, and ${places[places.length - 1]}`;
  };

  // Process days and convert places arrays to strings
  const processedDays = parsed.map(day => ({
    ...day,
    segments: {
      morning: day.segments.morning.map(segment => ({
        ...segment,
        places: formatPlacesArray(segment.places)
      })),
      afternoon: day.segments.afternoon.map(segment => ({
        ...segment,
        places: formatPlacesArray(segment.places)
      })),
      evening: day.segments.evening.map(segment => ({
        ...segment,
        places: formatPlacesArray(segment.places)
      }))
    }
  }));

  appContext.itinerary = {
    days: processedDays,
    computed: {
      duration_days: processedDays.length,
      itinerary_length: processedDays.length,
      matches_duration: true
    }
  };
}

// Check if all critical slots are filled for itinerary generation
export function hasAllCriticalSlots(context) {
  const summary = context?.summary || {};
  return !!(
    summary.origin &&
    summary.destination &&
    summary.duration_days &&
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

// Check if trip parameters were updated (for triggering re-planning)
export function wereTripParamsUpdated(context, previousContext) {
  if (!previousContext?.summary) return false;

  const current = context?.summary || {};
  const previous = previousContext.summary;

  return (
    current.origin !== previous.origin ||
    current.destination !== previous.destination ||
    current.outbound_date !== previous.outbound_date ||
    current.return_date !== previous.return_date ||
    current.duration_days !== previous.duration_days ||
    current.budget?.amount !== previous.budget?.amount ||
    current.budget?.currency !== previous.budget?.currency ||
    JSON.stringify(current.tripTypes) !== JSON.stringify(previous.tripTypes)
  );
}

// Proactively trigger itinerary extraction when conditions are met
export async function triggerItineraryExtractionIfNeeded(response, context, previousContext) {
  try {
    // Condition 1: Check if all critical slots are filled
    const hasAllSlots = hasAllCriticalSlots(context);

    // Condition 2: Check if itinerary tool was NOT called
    const toolCalled = wasItineraryToolCalled(response);

    // Condition 3: Check if trip parameters were updated (requiring re-planning)
    const paramsUpdated = wereTripParamsUpdated(context, previousContext);

    console.log('=== ITINERARY EXTRACTION DEBUG ===');
    console.log('hasAllSlots:', hasAllSlots);
    console.log('toolCalled:', toolCalled);
    console.log('paramsUpdated:', paramsUpdated);
    console.log('hasItinerary:', context.itinerary?.days?.length > 0);
    console.log('Context summary:', {
      origin: context?.summary?.origin,
      destination: context?.summary?.destination,
      duration_days: context?.summary?.duration_days,
      budget_amount: context?.summary?.budget?.amount,
      budget_currency: context?.summary?.budget?.currency
    });
    console.log('Response text length:', response.finalOutput?.length || 0);
    console.log('Response contains Day patterns:', /\bDay\b/i.test(response.finalOutput || ''));
    console.log('Response contains time segments:', /(Morning|Afternoon|Evening)/i.test(response.finalOutput || ''));
    console.log('=== END DEBUG ===');

    // Trigger extraction if:
    // - All slots are filled AND no tool was called AND no existing itinerary
    // - OR trip parameters were updated AND we have all slots BUT no tool was called
    if ((hasAllSlots && !toolCalled && (!context.itinerary?.days || context.itinerary.days.length === 0)) ||
        (paramsUpdated && hasAllSlots && !toolCalled)) {

      console.log('Triggering proactive itinerary extraction (structured outputs)...');

      const text = String(response.output_text || response.finalOutput || '');
      const structured = await extractItineraryStructured(text, context);
      return structured;
    }

    return null;
  } catch (error) {
    console.error('Error in proactive itinerary extraction:', error);
    return null;
  }
}

// -----------------------------------------------------------------------------
// Structured Itinerary Extractor Agent: Perfect extraction with outType
// -----------------------------------------------------------------------------
const ItinerarySegmentSchema = z.object({
  places: z.string().describe("Natural language string describing places/activities (e.g., 'Airport pickup and hotel check-in', 'Beach visit and market exploration')"),
  duration_hours: z.number().min(1).max(12).describe("Estimated duration in hours (1-12)"),
  descriptor: z.string().max(20).describe("2-3 word descriptor (e.g., 'arrival activities', 'cultural visit', 'scenic views')")
});

const ItineraryDaySchema = z.object({
  title: z.string().describe("Day title (e.g., 'Day 1 - Arrival', 'Day 2 - Adventure')"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe("Date in YYYY-MM-DD format, if available"),
  segments: z.object({
    morning: z.array(ItinerarySegmentSchema).default([]).describe("Morning activities"),
    afternoon: z.array(ItinerarySegmentSchema).default([]).describe("Afternoon activities"),
    evening: z.array(ItinerarySegmentSchema).default([]).describe("Evening activities")
  })
});

const StructuredItinerarySchema = z.object({
  days: z.array(ItineraryDaySchema).min(1).describe("Array of itinerary days"),
  computed: z.object({
    duration_days: z.number().min(1).describe("Total number of days"),
    itinerary_length: z.number().min(1).describe("Number of itinerary days"),
    matches_duration: z.boolean().default(true).describe("Whether itinerary length matches duration")
  })
});

export const structuredItineraryExtractor = new Agent({
  name: 'Structured Itinerary Extractor',
  model: 'gpt-4o-mini',
  instructions: `You are a JSON-only itinerary extraction agent. Return ONLY raw JSON, no markdown formatting, no explanations.

CRITICAL: Return ONLY the JSON object, nothing else. No \`\`\`json blocks, no text before or after.

If you find a valid itinerary:
- Extract day structures and return structured JSON matching the schema
- Combine multiple activities into single natural language strings
- Use 2-3 word descriptors
- Estimate reasonable durations

If no valid itinerary found:
- Return exactly: {"days": []}

SCHEMA RULES:
- days: array of day objects with title, date, segments
- segments: object with morning/afternoon/evening arrays
- Each segment item: {places: "string", duration_hours: number, descriptor: "string"}
- places: ALWAYS a single natural language string, never array
- computed: {duration_days: number, itinerary_length: number, matches_duration: boolean}`,
  outType: StructuredItinerarySchema,
  tools: [],
  modelSettings: {}
});

async function extractItineraryStructured(text, context) {
  try {
    const looksLikeItinerary = /\bDay\b/i.test(text) && /(Morning|Afternoon|Evening)/i.test(text);
    if (!looksLikeItinerary) return null;

    console.log('🚀 Running structured itinerary extraction with outType...');
    console.log('📝 Input text length:', text.length);
    console.log('📝 Text preview:', text.substring(0, 200) + '...');

    try {
      const testResult = await run(structuredItineraryExtractor, [user('Test input')]);
      console.log('🧪 Agent test - output type:', typeof testResult.output);
      console.log('🧪 Agent test - output preview:', JSON.stringify(testResult.output).substring(0, 100));
    } catch (testError) {
      console.log('🧪 Agent test failed:', testError.message);
    }

    const extractionPrompt = `TRAVEL AGENT RESPONSE:
${text}

Extract structured itinerary data from the response above. Look for day-wise patterns and time segments to create the structured output.`;

    const extractorInput = user(extractionPrompt);
    const result = await run(structuredItineraryExtractor, [extractorInput]);

    // With outType, the result will be automatically structured according to our Zod schema
    let structured = result.output;

    // Handle potential markdown code block wrapping
    if (structured && typeof structured === 'string') {
      console.log('🔍 Raw string response detected, attempting to parse...');
      try {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = structured.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          structured = JSON.parse(jsonMatch[1]);
          console.log('✅ Successfully parsed JSON from markdown code block');
        } else {
          // Try direct JSON parsing
          structured = JSON.parse(structured);
          console.log('✅ Successfully parsed raw JSON string');
        }
      } catch (parseError) {
        console.log('❌ Failed to parse string response:', parseError.message);
        console.log('❌ Raw response:', structured);
        return null;
      }
    }

    console.log('📊 Parsed structured result:', structured);

    if (structured && structured.days && Array.isArray(structured.days) && structured.days.length > 0) {
      // Update context with the structured itinerary
      context.itinerary = structured;
      console.log(`✅ Successfully extracted ${structured.days.length} itinerary days using outType`);
      console.log('📋 Extracted days preview:', JSON.stringify(structured.days.slice(0, 2), null, 2));
      return structured;
    }

    console.log('❌ No valid itinerary structure found in response');
    console.log('❌ Final structured result:', structured);
    console.log('❌ Days array:', structured?.days);
    console.log('❌ Days is array:', Array.isArray(structured?.days));
    console.log('❌ Days length:', structured?.days?.length);
    return null;

  } catch (error) {
    console.error('Error in structured itinerary extraction:', error);
    return null;
  }
}

export async function maybeExtractItineraryFromText(text, context) {
  try {
    const looksLikeItinerary = /\bDay\b/i.test(text) && /(Morning|Afternoon|Evening)/i.test(text);
    if (!looksLikeItinerary) return;

    const beforeLen = Array.isArray(context.itinerary?.days) ? context.itinerary.days.length : 0;

    // Use the perfect structuredItineraryExtractor for consistent results
    const extractionPrompt = `FALLBACK EXTRACTION - Return ONLY raw JSON:

${text}

Extract structured itinerary data and return ONLY JSON object.`;
    const extractorInput = user(extractionPrompt);
    const result = await run(structuredItineraryExtractor, [extractorInput]);

    let structured = result.output;

    // Handle potential markdown code block wrapping in fallback
    if (structured && typeof structured === 'string') {
      console.log('🔍 Fallback: Raw string response detected');
      try {
        const jsonMatch = structured.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          structured = JSON.parse(jsonMatch[1]);
          console.log('✅ Fallback: Successfully parsed JSON from markdown code block');
        } else {
          structured = JSON.parse(structured);
          console.log('✅ Fallback: Successfully parsed raw JSON string');
        }
      } catch (parseError) {
        console.log('❌ Fallback: Failed to parse string response:', parseError.message);
        return;
      }
    }

    if (structured && structured.days && Array.isArray(structured.days) && structured.days.length > 0) {
      context.itinerary = structured;
      console.log(`✅ Fallback extraction successful: ${structured.days.length} days extracted`);
      console.log('📋 Fallback extracted days:', JSON.stringify(structured.days.slice(0, 1), null, 2));
      return;
    }

    // Final fallback: safety-net parse
    await ensureItinerarySavedIfMissing(text, context);
  } catch (e) {
    console.warn('Fallback extraction failed, trying safety-net parse');
    // Final fallback: best-effort parse
    await ensureItinerarySavedIfMissing(text, context);
  }
}

// Trip Planner Agent - With context capturing tool
export const tripPlannerAgent = new Agent({
  name: 'Trip Planner Agent',
  model: 'gpt-4o-mini',
  instructions: (rc) => [PROMPTS.TRIP_PLANNER, contextSnapshot(rc)].join('\n'),
  tools: [captureTripContext], // Context capturing tool
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
  modelSettings: { toolChoice: 'required' },
  tools:[]
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