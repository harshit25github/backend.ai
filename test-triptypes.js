/**
 * Test tripTypes inference by Places Intelligence Agent
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api/chat';

async function testTripTypes() {
  console.log('🧪 TRIP TYPES INFERENCE TEST\n');
  console.log('='.repeat(80));

  const tests = [
    { destination: 'Paris', expectedTypes: ['cultural', 'food', 'art'] },
    { destination: 'Bali', expectedTypes: ['beach', 'wellness', 'adventure'] },
    { destination: 'Tokyo', expectedTypes: ['cultural', 'food', 'modern'] },
    { destination: 'Dubai', expectedTypes: ['luxury', 'shopping', 'modern'] }
  ];

  for (const test of tests) {
    const chatId = `triptype-test-${test.destination.toLowerCase()}-${Date.now()}`;

    console.log(`\n📍 Testing: ${test.destination}`);
    console.log('-'.repeat(80));

    try {
      const response = await fetch(`${API_BASE}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          message: `Plan a 5-day trip to ${test.destination} for 2 people`
        })
      });

      const data = await response.json();

      console.log(`Destination: ${data.summary?.destination?.city || 'NOT SET'}`);
      console.log(`tripTypes: ${JSON.stringify(data.summary?.tripTypes || [])}`);
      console.log(`placesOfInterest: ${data.summary?.placesOfInterest?.length || 0} places`);

      const hasTripTypes = data.summary?.tripTypes && data.summary.tripTypes.length > 0;
      const hasExpectedType = test.expectedTypes.some(type =>
        data.summary?.tripTypes?.includes(type)
      );

      console.log(`\n✅ Results:`);
      console.log(`  - tripTypes populated: ${hasTripTypes ? '✅ YES' : '❌ NO'}`);
      console.log(`  - Count: ${data.summary?.tripTypes?.length || 0} types (expected 2-4)`);
      console.log(`  - Has expected type: ${hasExpectedType ? '✅ YES' : '❌ NO'}`);

      if (hasTripTypes) {
        console.log(`  - Generated: ${data.summary.tripTypes.join(', ')}`);
      }

    } catch (error) {
      console.error(`❌ Error testing ${test.destination}:`, error.message);
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎯 TEST COMPLETE');
  console.log('='.repeat(80));
}

testTripTypes();
