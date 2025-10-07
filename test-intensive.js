/**
 * Intensive test for Places Intelligence Agent and update_summary tool
 * Tests multiple scenarios to ensure placesOfInterest is always populated
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api/chat';

async function testIntensive() {
  console.log('🧪 INTENSIVE TEST: Places Intelligence Agent & update_summary\n');
  console.log('=' .repeat(80));

  const tests = [
    {
      name: 'Test 1: Simple destination mention',
      chatId: `intensive-1-${Date.now()}`,
      message: 'I want to visit London'
    },
    {
      name: 'Test 2: Full trip request',
      chatId: `intensive-2-${Date.now()}`,
      message: 'Plan a 7-day trip to Barcelona for 3 people starting June 1, 2026'
    },
    {
      name: 'Test 3: Budget-focused request',
      chatId: `intensive-3-${Date.now()}`,
      message: 'I have a budget of $2000 to visit New York for 4 days'
    },
    {
      name: 'Test 4: Activity-focused request',
      chatId: `intensive-4-${Date.now()}`,
      message: 'I want cultural experiences in Rome for 5 days'
    }
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const test of tests) {
    console.log(`\n📍 ${test.name}`);
    console.log('-'.repeat(80));
    console.log(`Message: "${test.message}"`);

    try {
      const response = await fetch(`${API_BASE}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: test.chatId,
          message: test.message
        })
      });

      const data = await response.json();

      // Check 1: placesOfInterest exists and has items
      const hasPlaces = data.placesOfInterest && data.placesOfInterest.length > 0;

      // Check 2: pax field is correctly named (not passenger_count)
      const hasPax = data.summary?.pax !== undefined;
      const hasOldField = JSON.stringify(data).includes('passenger_count');

      // Check 3: placesOfInterest field is correctly named (not placesOfInterests)
      const hasOldPlacesField = JSON.stringify(data).includes('placesOfInterests');

      console.log(`\n✓ Response received`);
      console.log(`  - Places populated: ${hasPlaces ? '✅ YES' : '❌ NO'}`);
      if (hasPlaces) {
        console.log(`  - Number of places: ${data.placesOfInterest.length}`);
        data.placesOfInterest.slice(0, 3).forEach((place, idx) => {
          console.log(`    ${idx + 1}. ${place.placeName}`);
        });
      }
      console.log(`  - pax field exists: ${hasPax ? '✅ YES' : '❌ NO'}`);
      console.log(`  - Old 'passenger_count' found: ${hasOldField ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);
      console.log(`  - Old 'placesOfInterests' found: ${hasOldPlacesField ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);

      if (hasPlaces && !hasOldField && !hasOldPlacesField) {
        console.log(`\n✅ ${test.name} PASSED`);
        passedTests++;
      } else {
        console.log(`\n❌ ${test.name} FAILED`);
        failedTests++;
      }

    } catch (error) {
      console.error(`\n❌ ${test.name} ERROR:`, error.message);
      failedTests++;
    }

    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Final summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(80));
  console.log(`\nTotal Tests: ${tests.length}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`\nSuccess Rate: ${((passedTests / tests.length) * 100).toFixed(1)}%`);

  if (passedTests === tests.length) {
    console.log('\n🎉 ALL TESTS PASSED! System is working correctly.\n');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED. Please review the results above.\n');
  }
  console.log('='.repeat(80));
}

// Run the intensive test
testIntensive();
