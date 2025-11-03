/**
 * Test script for Flight Agent modification detection
 * Tests the GPT-4.1 optimized prompt with modification scenarios
 */

import { runMultiAgentSystem, loadContext, saveContext } from './multiAgentSystem.js';
import { randomBytes } from 'crypto';

const testChatId = `test-flight-${randomBytes(8).toString('hex')}`;

console.log('='.repeat(70));
console.log('FLIGHT AGENT MODIFICATION DETECTION TEST');
console.log('='.repeat(70));
console.log(`Test Chat ID: ${testChatId}\n`);

// Test scenarios
const scenarios = [
  {
    name: 'Initial Search - Roundtrip',
    message: 'Find flights from Delhi to Mumbai on January 20, 2026, returning January 25, 2026, 2 passengers, economy class',
    expectedBehavior: 'Should call flight_search with roundtrip parameters'
  },
  {
    name: 'Modification - Change to One-Way',
    message: 'Change it to one-way instead',
    expectedBehavior: 'Should detect modification, call flight_search with trip_type=oneway'
  },
  {
    name: 'Modification - Change Cabin Class',
    message: 'Show business class instead',
    expectedBehavior: 'Should detect modification, call flight_search with cabin_class=business'
  },
  {
    name: 'Modification - Change Date',
    message: 'What about January 22 instead?',
    expectedBehavior: 'Should detect modification, call flight_search with new outbound_date'
  },
  {
    name: 'Modification - Change Passengers',
    message: 'Make it 3 passengers',
    expectedBehavior: 'Should detect modification, call flight_search with pax=3'
  },
  {
    name: 'Information Request (No Modification)',
    message: 'Which flight is the fastest?',
    expectedBehavior: 'Should NOT call flight_search, answer from existing results'
  }
];

async function runTest() {
  console.log('🚀 Starting test sequence...\n');

  const conversationHistory = [];

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`TEST ${i + 1}: ${scenario.name}`);
    console.log(`${'─'.repeat(70)}`);
    console.log(`📝 User message: "${scenario.message}"`);
    console.log(`📋 Expected behavior: ${scenario.expectedBehavior}\n`);

    try {
      // Add current message to history
      conversationHistory.push({
        role: 'user',
        content: scenario.message
      });

      // Run the agent
      const result = await runMultiAgentSystem(
        scenario.message,
        testChatId,
        conversationHistory,
        false // No streaming
      );

      // Add assistant response to history
      conversationHistory.push({
        role: 'assistant',
        content: result.finalOutput
      });

      console.log(`✅ Agent Response:`);
      console.log(`   Last Agent: ${result.lastAgent}`);
      console.log(`   Output: ${result.finalOutput.substring(0, 200)}...`);

      // Show context snapshot
      console.log(`\n📊 Context After Response:`);
      const ctx = await loadContext(testChatId);
      console.log(`   Trip Type: ${ctx.flight.tripType}`);
      console.log(`   Cabin Class: ${ctx.flight.cabinClass}`);
      console.log(`   Passengers: ${ctx.summary.pax}`);
      console.log(`   Outbound Date: ${ctx.summary.outbound_date}`);
      console.log(`   Origin: ${ctx.flight.resolvedOrigin?.userCity} (${ctx.flight.resolvedOrigin?.airportIATA || 'N/A'})`);
      console.log(`   Destination: ${ctx.flight.resolvedDestination?.userCity} (${ctx.flight.resolvedDestination?.airportIATA || 'N/A'})`);
      console.log(`   Booking Status: ${ctx.flight.bookingStatus}`);
      console.log(`   Search Results: ${ctx.flight.searchResults.length} flights`);

      // Wait a bit before next test
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`❌ Test failed with error:`, error.message);
      console.error(error.stack);
      break;
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('TEST SEQUENCE COMPLETE');
  console.log(`${'='.repeat(70)}`);
  console.log(`\n📝 Review the outputs above to verify:`);
  console.log(`   1. Initial search called flight_search`);
  console.log(`   2. Modifications triggered NEW flight_search calls`);
  console.log(`   3. Info requests did NOT trigger flight_search`);
  console.log(`   4. Context was updated correctly after each modification`);
  console.log(`\n💡 Check the console logs for flight_search tool calls`);
}

// Run the test
runTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
