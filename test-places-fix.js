/**
 * Test to verify Places Intelligence Agent fixes:
 * 1. Places of Interest are always populated
 * 2. pax field is correctly used instead of passenger_count
 * 3. placesOfInterest field is correctly used instead of placesOfInterests
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api/chat';

async function testPlacesFix() {
  console.log('🧪 TESTING PLACES INTELLIGENCE AGENT FIXES\n');
  console.log('=' .repeat(80));

  const chatId = `test-places-${Date.now()}`;

  try {
    // Test 1: Initial trip request with destination
    console.log('\n📍 TEST 1: Initial trip planning with destination');
    console.log('-'.repeat(80));

    const response1 = await fetch(`${API_BASE}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: 'I want to plan a 5-day trip to Tokyo for 2 travelers starting May 10, 2026'
      })
    });

    const data1 = await response1.json();

    console.log('✅ Response received');
    console.log('\n📊 CONTEXT SUMMARY:');
    console.log(JSON.stringify(data1.summary, null, 2));

    console.log('\n🏛️ PLACES OF INTEREST:');
    if (data1.placesOfInterest && data1.placesOfInterest.length > 0) {
      console.log(`✅ Found ${data1.placesOfInterest.length} places`);
      data1.placesOfInterest.forEach((place, idx) => {
        console.log(`   ${idx + 1}. ${place.placeName}`);
        console.log(`      ${place.description}`);
      });
    } else {
      console.log('❌ NO PLACES OF INTEREST FOUND!');
    }

    console.log('\n👥 PAX (Passenger Count):');
    if (data1.summary?.pax) {
      console.log(`✅ pax = ${data1.summary.pax}`);
    } else {
      console.log('❌ pax field not found!');
    }

    // Verify no old field names exist
    console.log('\n🔍 CHECKING FOR OLD FIELD NAMES:');
    const contextStr = JSON.stringify(data1);
    if (contextStr.includes('passenger_count')) {
      console.log('❌ FOUND OLD FIELD: passenger_count');
    } else {
      console.log('✅ No passenger_count found (correct)');
    }

    if (contextStr.includes('placesOfInterests')) {
      console.log('❌ FOUND OLD FIELD: placesOfInterests');
    } else {
      console.log('✅ No placesOfInterests found (correct)');
    }

    // Test 2: Follow-up message to ensure places persist
    console.log('\n\n📍 TEST 2: Follow-up message');
    console.log('-'.repeat(80));

    const response2 = await fetch(`${API_BASE}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: 'Can you suggest activities for cultural exploration?'
      })
    });

    const data2 = await response2.json();

    console.log('✅ Response received');

    console.log('\n🏛️ PLACES OF INTEREST (After follow-up):');
    if (data2.placesOfInterest && data2.placesOfInterest.length > 0) {
      console.log(`✅ Found ${data2.placesOfInterest.length} places`);
      data2.placesOfInterest.forEach((place, idx) => {
        console.log(`   ${idx + 1}. ${place.placeName}`);
      });
    } else {
      console.log('❌ NO PLACES OF INTEREST FOUND!');
    }

    console.log('\n👥 PAX (After follow-up):');
    if (data2.summary?.pax) {
      console.log(`✅ pax = ${data2.summary.pax}`);
    } else {
      console.log('❌ pax field not found!');
    }

    // Test 3: Get context endpoint
    console.log('\n\n📍 TEST 3: Context endpoint');
    console.log('-'.repeat(80));

    const response3 = await fetch(`${API_BASE}/context/${chatId}`);
    const data3 = await response3.json();

    console.log('✅ Context retrieved');

    console.log('\n🏛️ PLACES OF INTEREST (From context endpoint):');
    if (data3.context?.summary?.placesOfInterest && data3.context.summary.placesOfInterest.length > 0) {
      console.log(`✅ Found ${data3.context.summary.placesOfInterest.length} places`);
    } else {
      console.log('❌ NO PLACES OF INTEREST FOUND!');
    }

    console.log('\n👥 PAX (From context endpoint):');
    if (data3.context?.summary?.pax) {
      console.log(`✅ pax = ${data3.context.summary.pax}`);
    } else {
      console.log('❌ pax field not found!');
    }

    // Final summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 FINAL SUMMARY');
    console.log('='.repeat(80));

    const placesTest1 = data1.placesOfInterest && data1.placesOfInterest.length > 0;
    const placesTest2 = data2.placesOfInterest && data2.placesOfInterest.length > 0;
    const placesTest3 = data3.context?.summary?.placesOfInterest && data3.context.summary.placesOfInterest.length > 0;
    const paxTest = data1.summary?.pax && data2.summary?.pax && data3.context?.summary?.pax;
    const noOldFields = !contextStr.includes('passenger_count') && !contextStr.includes('placesOfInterests');

    console.log(`\n✅ Places populated in initial message: ${placesTest1 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Places populated in follow-up message: ${placesTest2 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Places accessible via context endpoint: ${placesTest3 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ pax field working correctly: ${paxTest ? 'PASS' : 'FAIL'}`);
    console.log(`✅ No old field names present: ${noOldFields ? 'PASS' : 'FAIL'}`);

    const allPassed = placesTest1 && placesTest2 && placesTest3 && paxTest && noOldFields;

    console.log('\n' + '='.repeat(80));
    if (allPassed) {
      console.log('🎉 ALL TESTS PASSED! Places Intelligence Agent is working correctly.');
    } else {
      console.log('❌ SOME TESTS FAILED. Review the output above.');
    }
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ TEST FAILED WITH ERROR:');
    console.error(error.message);
    console.error(error.stack);
  }
}

// Run the test
testPlacesFix();
