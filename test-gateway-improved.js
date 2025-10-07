import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log('='.repeat(80));
console.log('TESTING IMPROVED GATEWAY AGENT');
console.log('='.repeat(80));

const chatId = 'test-improved-' + Date.now();

async function test() {
  try {
    // Test 1: Basic request
    console.log('\n[TEST 1] User: "Plan a 5-day trip to Paris for 2 people"');

    const result1 = await runMultiAgentSystem(
      "Plan a 5-day trip to Paris for 2 people",
      chatId,
      [{ role: 'user', content: 'Plan a 5-day trip to Paris for 2 people' }]
    );

    console.log('\n✅ Response received');
    console.log('Agent:', result1.lastAgent);
    console.log('\nSummary captured:');
    console.log('  - Destination:', result1.context.summary.destination?.city);
    console.log('  - Duration:', result1.context.summary.duration_days, 'days');
    console.log('  - Passengers:', result1.context.summary.passenger_count);
    console.log('  - Suggested Questions:', result1.context.summary.suggestedQuestions?.length || 0);

    if (result1.context.summary.suggestedQuestions?.length > 0) {
      console.log('\n📝 Suggested Questions:');
      result1.context.summary.suggestedQuestions.forEach((q, i) => {
        console.log(`  ${i+1}. ${q}`);
      });
    }

    // Test 2: Add more details
    console.log('\n' + '='.repeat(80));
    console.log('[TEST 2] User: "From Delhi, January 15-20, 2026, budget 150000 INR total"');

    const result2 = await runMultiAgentSystem(
      "From Delhi, January 15-20, 2026, budget 150000 INR total",
      chatId,
      [
        { role: 'user', content: 'Plan a 5-day trip to Paris for 2 people' },
        { role: 'assistant', content: result1.finalOutput },
        { role: 'user', content: 'From Delhi, January 15-20, 2026, budget 150000 INR total' }
      ]
    );

    console.log('\n✅ Response received');
    console.log('\nComplete Summary:');
    console.log(JSON.stringify(result2.context.summary, null, 2));

    // Validate return_date auto-calculation
    console.log('\n📅 Date Validation:');
    console.log('  Outbound:', result2.context.summary.outbound_date);
    console.log('  Duration:', result2.context.summary.duration_days, 'days');
    console.log('  Return:', result2.context.summary.return_date);

    if (result2.context.summary.outbound_date && result2.context.summary.duration_days) {
      const expected = new Date(result2.context.summary.outbound_date);
      expected.setDate(expected.getDate() + result2.context.summary.duration_days);
      const expectedReturn = expected.toISOString().split('T')[0];
      console.log('  Expected return:', expectedReturn);
      console.log('  Auto-calculation:', result2.context.summary.return_date === expectedReturn ? '✅ PASS' : '❌ FAIL');
    }

    // Test 3: User confirms and gets itinerary
    console.log('\n' + '='.repeat(80));
    console.log('[TEST 3] User confirms: "Yes, proceed"');

    const result3 = await runMultiAgentSystem(
      "Yes, proceed with the plan",
      chatId,
      [
        { role: 'user', content: 'Plan a 5-day trip to Paris for 2 people' },
        { role: 'assistant', content: result1.finalOutput },
        { role: 'user', content: 'From Delhi, January 15-20, 2026, budget 150000 INR total' },
        { role: 'assistant', content: result2.finalOutput },
        { role: 'user', content: 'Yes, proceed with the plan' }
      ]
    );

    console.log('\n✅ Response received');
    console.log('\n📋 Itinerary:');
    console.log('  Days created:', result3.context.itinerary?.days?.length || 0);
    console.log('  Matches duration:', result3.context.itinerary?.computed?.matches_duration);

    if (result3.context.itinerary?.days?.length > 0) {
      const day1 = result3.context.itinerary.days[0];
      console.log('\n  Day 1 structure:');
      console.log('    Title:', day1.title);
      console.log('    Date:', day1.date);
      console.log('    Morning segments:', day1.segments.morning.length);
      console.log('    Afternoon segments:', day1.segments.afternoon.length);
      console.log('    Evening segments:', day1.segments.evening.length);

      if (day1.segments.morning.length > 0) {
        const seg = day1.segments.morning[0];
        console.log('\n    Morning segment example:');
        console.log('      Place:', seg.place || 'N/A');
        console.log('      Places:', seg.places);
        console.log('      Duration:', seg.duration_hours, 'hours');
        console.log('      Descriptor:', seg.descriptor);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL TESTS COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

test();
