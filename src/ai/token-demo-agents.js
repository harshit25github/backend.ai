import { Agent } from '@openai/agents';
import { RECOMMENDED_PROMPT_PREFIX } from '@openai/agents-core/extensions';

const TOKEN_DEMO_MODEL = process.env.TOKEN_DEMO_MODEL || 'gpt-4.1';

const SHARED_MODEL_SETTINGS = {
  promptCacheRetention: '24h',
};

const flightAgent = new Agent({
  name: 'Demo Flight Agent',
  model: TOKEN_DEMO_MODEL,
  handoffDescription: 'Helps with flights (routes, dates, airlines, baggage, airports).',
  instructions: [
    RECOMMENDED_PROMPT_PREFIX,
    '',
    'You are a flight helper for a demo.',
    'Keep answers short (2-5 sentences).',
    'If dates or route are missing, ask only for the missing details.',
  ].join('\n'),
  modelSettings: SHARED_MODEL_SETTINGS,
});

const hotelAgent = new Agent({
  name: 'Demo Hotel Agent',
  model: TOKEN_DEMO_MODEL,
  handoffDescription: 'Helps with hotels (location, dates, budget, amenities).',
  instructions: [
    RECOMMENDED_PROMPT_PREFIX,
    '',
    'You are a hotel helper for a demo.',
    'Keep answers short (2-5 sentences).',
    'If check-in/check-out or city are missing, ask only for the missing details.',
  ].join('\n'),
  modelSettings: SHARED_MODEL_SETTINGS,
});

const itineraryAgent = new Agent({
  name: 'Demo Itinerary Agent',
  model: TOKEN_DEMO_MODEL,
  handoffDescription: 'Helps with simple itineraries (day plan, pacing, must-sees).',
  instructions: [
    RECOMMENDED_PROMPT_PREFIX,
    '',
    'You are an itinerary helper for a demo.',
    'Keep answers short (bulleted is fine).',
    'If destination or trip length is missing, ask only for the missing details.',
  ].join('\n'),
  modelSettings: SHARED_MODEL_SETTINGS,
});

const flightTool = flightAgent.asTool({
  toolName: 'transfer_to_flight_agent',
  toolDescription: 'Route the user to the flight agent.',
});

const hotelTool = hotelAgent.asTool({
  toolName: 'transfer_to_hotel_agent',
  toolDescription: 'Route the user to the hotel agent.',
});

const itineraryTool = itineraryAgent.asTool({
  toolName: 'transfer_to_itinerary_agent',
  toolDescription: 'Route the user to the itinerary agent.',
});

export const tokenDemoRouterAgent = new Agent({
  name: 'Demo Router Agent',
  model: TOKEN_DEMO_MODEL,
  instructions: [
    RECOMMENDED_PROMPT_PREFIX,
    '',
    'You are a router. You MUST call exactly one transfer tool and never answer directly.',
    '',
    'Routing rules:',
    '- If user asks about flights, airlines, baggage, airports, fares -> transfer_to_flight_agent',
    '- If user asks about hotels, rooms, check-in/out, amenities -> transfer_to_hotel_agent',
    '- Otherwise -> transfer_to_itinerary_agent',
  ].join('\n'),
  tools: [flightTool, hotelTool, itineraryTool],
  modelSettings: { ...SHARED_MODEL_SETTINGS, toolChoice: 'required' },
});

export const tokenDemoAgents = {
  tokenDemoRouterAgent,
  flightAgent,
  hotelAgent,
  itineraryAgent,
};
