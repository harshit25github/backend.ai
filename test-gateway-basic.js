import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log('='.repeat(80));
console.log('TEST 1: BASIC TRIP PLANNING REQUEST');
console.log('='.repeat(80));

const chatId = 'test-gateway-' + Date.now();

// Test 1: Basic trip planning request
console.log('\n[TEST 1] User: "Plan a 5-day trip to Paris for 2 people"');
console.log('Expected: Trip Planner Agent should handle this\n');

try {
  const result1 = await runMultiAgentSystem(
    "Plan a 5-day trip to Paris for 2 people",
    chatId,
    [{ role: 'user', content: 'Plan a 5-day trip to Paris for 2 people' }]
  );

  console.log('\n--- RESULT 1 ---');
  console.log('Agent:', result1.lastAgent);
  console.log('\nResponse Preview:', result1.finalOutput.substring(0, 500));
  console.log('\nContext Summary:', JSON.stringify(result1.context.summary, null, 2));
  console.log('\nItinerary Days:', result1.context.itinerary?.days?.length || 0);
  console.log('\nPlaces of Interest:', result1.context.summary.placesOfInterests?.length || 0);

  // Analyze issues
  console.log('\n--- ANALYSIS ---');
  console.log('✓ Agent routing:', result1.lastAgent === 'Trip Planner Agent' ? '✅' : '❌');
  console.log('✓ Destination captured:', result1.context.summary.destination ? '✅' : '❌');
  console.log('✓ Duration captured:', result1.context.summary.duration_days ? '✅' : '❌');
  console.log('✓ Passenger count captured:', result1.context.summary.passenger_count ? '✅' : '❌');
  console.log('✓ Places of interest populated:', result1.context.summary.placesOfInterests?.length > 0 ? '✅' : '❌');

  // Test 2: Follow-up with origin and dates
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: FOLLOW-UP WITH MORE INFO');
  console.log('='.repeat(80));
  console.log('\n[TEST 2] User: "From Delhi, January 15-20, 2026, budget 150000 INR total"');

  const result2 = await runMultiAgentSystem(
    "From Delhi, January 15-20, 2026, budget 150000 INR total",
    chatId,
    [
      { role: 'user', content: 'Plan a 5-day trip to Paris for 2 people' },
      { role: 'assistant', content: result1.finalOutput },
      { role: 'user', content: 'From Delhi, January 15-20, 2026, budget 150000 INR total' }
    ]
  );

  console.log('\n--- RESULT 2 ---');
  console.log('Agent:', result2.lastAgent);
  console.log('\nResponse Preview:', result2.finalOutput.substring(0, 500));
  console.log('\nContext Summary:', JSON.stringify(result2.context.summary, null, 2));
  console.log('\nItinerary Days:', result2.context.itinerary?.days?.length || 0);

  // Analyze date calculation
  console.log('\n--- DATE ANALYSIS ---');
  console.log('Outbound date:', result2.context.summary.outbound_date);
  console.log('Duration days:', result2.context.summary.duration_days);
  console.log('Return date:', result2.context.summary.return_date);

  // Check if return_date is auto-calculated
  if (result2.context.summary.outbound_date && result2.context.summary.duration_days) {
    const expected = new Date(result2.context.summary.outbound_date);
    expected.setDate(expected.getDate() + result2.context.summary.duration_days);
    const expectedReturn = expected.toISOString().split('T')[0];
    console.log('Expected return date:', expectedReturn);
    console.log('Auto-calculation working:', result2.context.summary.return_date === expectedReturn ? '✅ YES' : '❌ NO');
  }

  // Test 3: Booking request
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: BOOKING REQUEST');
  console.log('='.repeat(80));
  console.log('\n[TEST 3] User: "Book me a flight to Paris"');

  const chatId3 = 'test-gateway-booking-' + Date.now();
  const result3 = await runMultiAgentSystem(
    "Book me a flight to Paris",
    chatId3,
    [{ role: 'user', content: 'Book me a flight to Paris' }]
  );

  console.log('\n--- RESULT 3 ---');
  console.log('Agent:', result3.lastAgent);
  console.log('\nResponse Preview:', result3.finalOutput.substring(0, 300));
  console.log('✓ Routing to Booking Agent:', result3.lastAgent === 'Booking Agent' ? '✅' : '❌');

} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  console.error('Stack:', error.stack);
}

console.log('\n' + '='.repeat(80));
console.log('TESTS COMPLETE');
console.log('='.repeat(80));
