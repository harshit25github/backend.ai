import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';
import fs from 'fs';

console.log('🔍 DEBUG TEST: Flight Search from Jabalpur to Goa\n');
console.log('================================================================================');
console.log('Testing: Jabalpur → Goa, Sept 15, 1 pax, economy, one-way');
console.log('================================================================================\n');

const chatId = 'test-flight-debug-jabalpur';

async function testFlightSearch() {
  try {
    console.log('🔹 USER INPUT: "I need flights from Jabalpur to Goa on September 15, 1 passenger, economy class, one-way"\n');

    const userMessage = 'I need flights from Jabalpur to Goa on September 15, 1 passenger, economy class, one-way';
    const conversationHistory = [{ role: 'user', content: userMessage }];
    const result = await runMultiAgentSystem(
      userMessage,
      chatId,
      conversationHistory,
      false // no streaming
    );

    console.log('\n📊 FINAL CONTEXT STATE:');
    console.log('================================================================================');

    // Load the final context
    const contextPath = `data/agent-context-${chatId}.json`;
    if (fs.existsSync(contextPath)) {
      const context = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));

      console.log('\n📝 Summary Context:');
      console.log('  Origin:', JSON.stringify(context.summary.origin, null, 2));
      console.log('  Destination:', JSON.stringify(context.summary.destination, null, 2));
      console.log('  Outbound Date:', context.summary.outbound_date);
      console.log('  Passengers:', context.summary.pax);

      console.log('\n✈️ Flights Context:');
      console.log('  Trip Type:', context.flights.tripType);
      console.log('  Cabin Class:', context.flights.cabinClass);
      console.log('  Resolved Origin:', JSON.stringify(context.flights.resolvedOrigin, null, 2));
      console.log('  Resolved Destination:', JSON.stringify(context.flights.resolvedDestination, null, 2));
      console.log('  Booking Status:', context.flights.bookingStatus);
      console.log('  Search Results Count:', context.flights.searchResults?.length || 0);
      console.log('  Deeplink:', context.flights.deeplink || 'N/A');

      console.log('\n🔍 ANALYSIS:');
      const hasOriginIATA = context.flights.resolvedOrigin?.airportIATA;
      const hasDestIATA = context.flights.resolvedDestination?.airportIATA;
      const hasDate = context.summary.outbound_date;
      const hasPax = context.summary.pax;

      console.log('  ✓ Origin IATA code present?', hasOriginIATA ? `YES (${hasOriginIATA})` : '❌ NO');
      console.log('  ✓ Destination IATA code present?', hasDestIATA ? `YES (${hasDestIATA})` : '❌ NO');
      console.log('  ✓ Outbound date present?', hasDate ? `YES (${hasDate})` : '❌ NO');
      console.log('  ✓ Passengers present?', hasPax ? `YES (${hasPax})` : '❌ NO');
      console.log('  ✓ Cabin class present?', context.flights.cabinClass ? `YES (${context.flights.cabinClass})` : '❌ NO');
      console.log('  ✓ Trip type present?', context.flights.tripType ? `YES (${context.flights.tripType})` : '❌ NO');

      const allFieldsPresent = hasOriginIATA && hasDestIATA && hasDate && hasPax && context.flights.cabinClass && context.flights.tripType;

      console.log('\n🎯 RESULT:');
      if (allFieldsPresent) {
        console.log('  ✅ ALL required fields present - API SHOULD HAVE BEEN CALLED');
        if (context.flights.searchResults?.length > 0) {
          console.log('  ✅ API was called successfully! Found', context.flights.searchResults.length, 'flights');
        } else {
          console.log('  ❌ API was NOT called despite all fields being present!');
        }
      } else {
        console.log('  ❌ Missing required fields - API should NOT be called yet');
        console.log('  📋 Next step: Agent should use web_search to find IATA codes or ask user for missing info');
      }
    }

    console.log('\n📝 Agent Response:');
    console.log('================================================================================');
    const output = Array.isArray(result.finalOutput)
      ? result.finalOutput.map(String).join('\n')
      : String(result.finalOutput ?? '');
    console.log(output);

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

testFlightSearch();
