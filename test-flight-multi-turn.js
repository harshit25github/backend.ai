import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';
import fs from 'fs';

console.log('🧪 MULTI-TURN FLIGHT SEARCH TEST\n');
console.log('='.repeat(80));
console.log('Testing progressive information gathering across multiple turns\n');

const chatId = 'test-flight-multi-turn';

async function runTurn(turnNumber, userMessage, conversationHistory) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔹 TURN ${turnNumber}: "${userMessage}"`);
  console.log('='.repeat(80));

  const startTime = Date.now();

  try {
    // Add user message to history
    conversationHistory.push({ role: 'user', content: userMessage });

    const result = await runMultiAgentSystem(
      userMessage,
      chatId,
      conversationHistory,
      false
    );

    const duration = Date.now() - startTime;
    const output = Array.isArray(result.finalOutput)
      ? result.finalOutput.map(String).join('\n')
      : String(result.finalOutput ?? '');

    // Add assistant response to history
    conversationHistory.push({ role: 'assistant', content: output });

    // Load and analyze context
    const contextPath = `data/agent-context-${chatId}.json`;
    let context = null;
    if (fs.existsSync(contextPath)) {
      context = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));
    }

    console.log(`\n⏱️  Response Time: ${(duration / 1000).toFixed(2)}s`);
    console.log(`👤 Last Agent: ${result.lastAgent}\n`);

    console.log('📝 Agent Response:');
    console.log('-'.repeat(80));
    console.log(output);
    console.log('-'.repeat(80));

    if (context) {
      console.log('\n📊 CONTEXT STATE AFTER THIS TURN:');
      console.log('-'.repeat(80));

      console.log('\n🗂️ Summary:');
      console.log('  Origin:', JSON.stringify(context.summary.origin));
      console.log('  Destination:', JSON.stringify(context.summary.destination));
      console.log('  Outbound Date:', context.summary.outbound_date || 'NOT SET');
      console.log('  Return Date:', context.summary.return_date || 'NOT SET');
      console.log('  Passengers:', context.summary.pax || 'NOT SET');

      console.log('\n✈️ Flights Context:');
      console.log('  Trip Type:', context.flights.tripType);
      console.log('  Cabin Class:', context.flights.cabinClass);
      console.log('  Origin IATA:', context.flights.resolvedOrigin?.airportIATA || 'NOT RESOLVED');
      console.log('  Origin Airport:', context.flights.resolvedOrigin?.airportName || 'N/A');
      console.log('  Dest IATA:', context.flights.resolvedDestination?.airportIATA || 'NOT RESOLVED');
      console.log('  Dest Airport:', context.flights.resolvedDestination?.airportName || 'N/A');
      console.log('  Booking Status:', context.flights.bookingStatus);
      console.log('  Search Results:', context.flights.searchResults?.length || 0, 'flights');

      // Check if all required fields are present
      const requiredFields = {
        'Origin IATA': context.flights.resolvedOrigin?.airportIATA,
        'Dest IATA': context.flights.resolvedDestination?.airportIATA,
        'Outbound Date': context.summary.outbound_date,
        'Passengers': context.summary.pax,
        'Cabin Class': context.flights.cabinClass,
        'Trip Type': context.flights.tripType
      };

      console.log('\n🎯 REQUIRED FIELDS CHECK:');
      const allPresent = Object.entries(requiredFields).every(([key, val]) => val);
      Object.entries(requiredFields).forEach(([key, val]) => {
        console.log(`  ${val ? '✅' : '❌'} ${key}: ${val || 'MISSING'}`);
      });

      if (allPresent) {
        console.log('\n  🎉 ALL REQUIRED FIELDS PRESENT!');
        if (context.flights.searchResults?.length > 0) {
          console.log(`  ✅ API WAS CALLED! Found ${context.flights.searchResults.length} flights`);
          console.log(`  🔗 Deeplink: ${context.flights.deeplink || 'N/A'}`);
        } else {
          console.log('  ⚠️  All fields present but API not called yet (should be called next turn)');
        }
      } else {
        console.log('\n  ⏳ Waiting for more information...');
      }
    }

    return { output, context, conversationHistory };

  } catch (error) {
    console.error('\n❌ ERROR in turn:', error.message);
    throw error;
  }
}

async function testMultiTurnFlow() {
  console.log('\n📋 TEST SCENARIO:');
  console.log('User provides information progressively over multiple turns');
  console.log('Expected: Agent should gather info, resolve airports, then call API\n');

  let conversationHistory = [];

  try {
    // Turn 1: User mentions destination only
    await runTurn(1, 'I need flights to Goa', conversationHistory);

    // Turn 2: User provides origin and passenger count
    await runTurn(2, 'From Jabalpur, for 2 passengers', conversationHistory);

    // Turn 3: User provides dates
    await runTurn(3, 'September 15 to September 20', conversationHistory);

    // Turn 4: User confirms cabin class
    await runTurn(4, 'Economy class is fine', conversationHistory);

    console.log('\n\n' + '='.repeat(80));
    console.log('✨ MULTI-TURN TEST COMPLETED');
    console.log('='.repeat(80));

    // Final summary
    const contextPath = `data/agent-context-${chatId}.json`;
    if (fs.existsSync(contextPath)) {
      const finalContext = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));

      console.log('\n📊 FINAL TEST SUMMARY:');
      console.log('-'.repeat(80));
      console.log('✈️ Route:',
        `${finalContext.flights.resolvedOrigin?.airportIATA || 'N/A'} → ${finalContext.flights.resolvedDestination?.airportIATA || 'N/A'}`);
      console.log('📅 Dates:',
        `${finalContext.summary.outbound_date || 'N/A'} to ${finalContext.summary.return_date || 'N/A'}`);
      console.log('👥 Passengers:', finalContext.summary.pax || 'N/A');
      console.log('💺 Class:', finalContext.flights.cabinClass);
      console.log('🔄 Type:', finalContext.flights.tripType);
      console.log('📍 Status:', finalContext.flights.bookingStatus);
      console.log('🎫 Results:', finalContext.flights.searchResults?.length || 0, 'flights found');

      if (finalContext.flights.searchResults?.length > 0) {
        console.log('\n✅ SUCCESS: API was called and flights were returned!');
        console.log('\n🎫 Flight Results:');
        finalContext.flights.searchResults.forEach((flight, idx) => {
          console.log(`\n  Flight ${idx + 1}:`);
          console.log(`    Airline: ${flight.airline.name} (${flight.airline.code})`);
          console.log(`    Price: ${flight.price.currency} ${flight.price.amount}`);
          console.log(`    Departure: ${flight.departure.time}`);
          console.log(`    Arrival: ${flight.arrival.time}`);
          console.log(`    Duration: ${flight.duration_minutes} minutes`);
          console.log(`    Stops: ${flight.stops}`);
        });

        console.log(`\n🔗 Booking Link: ${finalContext.flights.deeplink}`);
      } else {
        console.log('\n❌ FAILURE: API was not called despite having all information');
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
  }
}

// Run the test
testMultiTurnFlow();
