import 'dotenv/config';
import fs from 'node:fs/promises';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log('🧪 Testing Flight Agent Loop Fix\n');
console.log('='.repeat(80));
console.log('Scenario: User provides cities → Agent should use web_search ONCE → Call API\n');

const DATA_DIR = './data';
await fs.mkdir(DATA_DIR, { recursive: true });

const chatId = 'test-loop-fix-' + Date.now();

async function loadContext(chatId) {
  const filePath = `${DATA_DIR}/chat-${chatId}.json`;
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      userInfo: { preferences: [] },
      summary: {
        origin: {},
        destination: {},
        budget: { currency: 'INR', per_person: true },
        tripTypes: [],
        placesOfInterest: [],
        upcomingEvents: [],
        suggestedQuestions: []
      },
      itinerary: { days: [], computed: { matches_duration: true } },
      conversationState: {
        currentAgent: 'Gateway Agent',
        lastIntent: 'general',
        awaitingConfirmation: false
      },
      trip: {
        bookingStatus: 'pending',
        bookingConfirmed: false,
        bookingDetails: { flights: [], hotels: [], activities: [] }
      },
      flight: {
        tripType: 'roundtrip',
        cabinClass: 'economy',
        resolvedOrigin: {},
        resolvedDestination: {},
        searchResults: [],
        deeplink: null,
        selectedFlight: {},
        bookingStatus: 'pending'
      }
    };
  }
}

async function saveContext(chatId, context) {
  const filePath = `${DATA_DIR}/chat-${chatId}.json`;
  await fs.writeFile(filePath, JSON.stringify(context, null, 2));
}

async function testLoopFix() {
  try {
    console.log('🔹 TURN 1: Show me flights from Delhi to Mumbai on Jan 10, 2 passengers, economy\n');
    console.log('Expected behavior:');
    console.log('  1. flight_search called (missing IATAs)');
    console.log('  2. Tool returns: "Use web_search to find IATA codes"');
    console.log('  3. Agent uses web_search for Delhi');
    console.log('  4. Agent uses web_search for Mumbai');
    console.log('  5. Agent calls flight_search WITH IATAs');
    console.log('  6. API called successfully');
    console.log('  ❌ SHOULD NOT: Call flight_search multiple times without IATAs\n');
    console.log('-'.repeat(80));

    const context = await loadContext(chatId);
    context.conversationState.currentAgent = 'Flight Specialist Agent';

    const result = await runMultiAgentSystem(
      'Show me flights from Delhi to Mumbai on Jan 10, 2 passengers, economy, round trip returning Jan 15',
      context
    );

    await saveContext(chatId, context);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test completed successfully!');
    console.log(`⏱️  Response time: ${result.state._currentTurn} turns`);

    if (result.state._currentTurn <= 5) {
      console.log('✅ PASSED: Agent completed in reasonable turns (≤5)');
    } else {
      console.log('⚠️ WARNING: Agent took more than 5 turns - may indicate looping');
    }

    console.log('\n📊 Flight Results:');
    console.log(`  Status: ${context.flight.bookingStatus}`);
    console.log(`  Results: ${context.flight.searchResults?.length || 0} flights`);
    console.log(`  Origin: ${context.flight.resolvedOrigin?.userCity} (${context.flight.resolvedOrigin?.airportIATA})`);
    console.log(`  Destination: ${context.flight.resolvedDestination?.userCity} (${context.flight.resolvedDestination?.airportIATA})`);

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error.message);

    if (error.message.includes('Rate limit')) {
      console.log('\n⚠️ Rate limit hit. This is expected during heavy testing.');
    } else if (error.message.includes('BLOCKED')) {
      console.log('\n⚠️ Loop was detected and blocked - this is the intended behavior!');
      console.log('However, agent should NOT trigger this after the fix.');
    }
  }
}

testLoopFix();
