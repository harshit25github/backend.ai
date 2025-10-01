import { enhancedManagerAgent, createEnhancedContext } from './src/ai/enhanced-manager.js';
import { run, user } from '@openai/agents';

async function testItineraryStructure() {
  console.log('Testing Itinerary Structure...\n');

  const appContext = createEnhancedContext({ name: 'Test User', uid: 1 });
  let thread = [];

  // Direct itinerary request with all required fields
  const userMessage = "Create a 3-day Paris itinerary for 2 people";
  console.log('USER:', userMessage);
  console.log('\nWaiting for response...\n');

  try {
    const res = await run(enhancedManagerAgent, thread.concat(user(userMessage)), { context: appContext });
    thread = res.history;

    console.log('✅ Response received\n');
    console.log('Last Agent:', res.lastAgent?.name);
    console.log('\n' + '='.repeat(80));
    console.log('CONTEXT AFTER ITINERARY CREATION');
    console.log('='.repeat(80));

    console.log('\nSummary:');
    console.log('- Destination:', appContext.summary.destination.city);
    console.log('- Duration:', appContext.summary.duration_days, 'days');
    console.log('- Pax:', appContext.summary.pax);
    console.log('- Places of Interest Count:', appContext.summary.placesOfInterest.length);
    console.log('- Suggested Questions Count:', appContext.summary.suggestedQuestions.length);

    console.log('\nItinerary:');
    console.log('- Days Created:', appContext.itinerary.days.length);
    console.log('- Duration Days:', appContext.itinerary.computed.duration_days);
    console.log('- Itinerary Length:', appContext.itinerary.computed.itinerary_length);
    console.log('- Matches Duration:', appContext.itinerary.computed.matches_duration);

    if (appContext.itinerary.days.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('SAMPLE DAY STRUCTURE (Day 1)');
      console.log('='.repeat(80));
      const day1 = appContext.itinerary.days[0];
      console.log(JSON.stringify(day1, null, 2));

      // Validate structure
      console.log('\n' + '='.repeat(80));
      console.log('STRUCTURE VALIDATION');
      console.log('='.repeat(80));

      const morningLength = day1.segments.morning.length;
      const afternoonLength = day1.segments.afternoon.length;
      const eveningLength = day1.segments.evening.length;

      console.log('\n✓ Checking array lengths (should be 0 or 1):');
      console.log('  - Morning array length:', morningLength, morningLength <= 1 ? '✅' : '❌');
      console.log('  - Afternoon array length:', afternoonLength, afternoonLength <= 1 ? '✅' : '❌');
      console.log('  - Evening array length:', eveningLength, eveningLength <= 1 ? '✅' : '❌');

      if (day1.segments.morning.length > 0) {
        const morning = day1.segments.morning[0];
        console.log('\n✓ Morning segment:');
        console.log('  - Places:', morning.places);
        console.log('  - Duration (hours):', morning.duration_hours);
        console.log('  - Descriptor:', morning.descriptor);
        console.log('  - Descriptor word count:', morning.descriptor.split(' ').length,
                    morning.descriptor.split(' ').length <= 4 ? '✅' : '❌');
      }

      if (day1.segments.afternoon.length > 0) {
        const afternoon = day1.segments.afternoon[0];
        console.log('\n✓ Afternoon segment:');
        console.log('  - Places:', afternoon.places);
        console.log('  - Duration (hours):', afternoon.duration_hours);
        console.log('  - Descriptor:', afternoon.descriptor);
        console.log('  - Descriptor word count:', afternoon.descriptor.split(' ').length,
                    afternoon.descriptor.split(' ').length <= 4 ? '✅' : '❌');
      }

      if (day1.segments.evening.length > 0) {
        const evening = day1.segments.evening[0];
        console.log('\n✓ Evening segment:');
        console.log('  - Places:', evening.places);
        console.log('  - Duration (hours):', evening.duration_hours);
        console.log('  - Descriptor:', evening.descriptor);
        console.log('  - Descriptor word count:', evening.descriptor.split(' ').length,
                    evening.descriptor.split(' ').length <= 4 ? '✅' : '❌');
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(80));

  } catch (err) {
    console.error('❌ ERROR:', err.message);
    console.error(err.stack);
  }
}

testItineraryStructure().catch(console.error);
