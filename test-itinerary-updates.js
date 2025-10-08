/**
 * Test itinerary updates in multiple scenarios:
 * 1. Budget changes
 * 2. Trip duration changes
 * 3. Segment modifications
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api/chat';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendMessage(chatId, message) {
  const response = await fetch(`${API_BASE}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message })
  });
  return await response.json();
}

async function testItineraryUpdates() {
  console.log('🧪 ITINERARY UPDATE SCENARIOS TEST\n');
  console.log('=' .repeat(80));

  const chatId = `itinerary-updates-${Date.now()}`;

  try {
    // STEP 1: Create initial trip request
    console.log('\n📍 STEP 1: Initial trip request');
    console.log('-'.repeat(80));
    const data1 = await sendMessage(chatId, 'Plan a 5-day trip to Paris for 2 people');
    console.log(`Response: "${data1.response.substring(0, 150)}..."`);
    console.log(`Destination: ${data1.summary?.destination?.city || 'NOT SET'}`);
    console.log(`Duration: ${data1.summary?.duration_days || 'NOT SET'} days`);
    console.log(`Pax: ${data1.summary?.pax || 'NOT SET'}`);
    console.log(`Itinerary created: ${data1.itinerary?.days?.length > 0 ? 'YES' : 'NO'}`);

    await sleep(1500);

    // STEP 2: Provide complete details
    console.log('\n\n📍 STEP 2: Provide complete details');
    console.log('-'.repeat(80));
    const data2 = await sendMessage(chatId, 'From New York, June 10-15, 2026, budget $3000 total');
    console.log(`Response: "${data2.response.substring(0, 150)}..."`);
    console.log(`Origin: ${data2.summary?.origin?.city || 'NOT SET'}`);
    console.log(`Budget: ${data2.summary?.budget?.currency || ''} ${data2.summary?.budget?.amount || 'NOT SET'}`);
    console.log(`Budget per person: ${data2.summary?.budget?.per_person}`);
    console.log(`Itinerary created: ${data2.itinerary?.days?.length > 0 ? 'YES' : 'NO'}`);

    await sleep(1500);

    // STEP 3: Confirm and create itinerary
    console.log('\n\n📍 STEP 3: User confirms - create itinerary');
    console.log('-'.repeat(80));
    const data3 = await sendMessage(chatId, 'Yes, please create the detailed itinerary');
    console.log(`Response preview: "${data3.response.substring(0, 150)}..."`);
    const initialItinerary = data3.itinerary;
    console.log(`Itinerary created: ${initialItinerary?.days?.length > 0 ? '✅ YES' : '❌ NO'}`);
    console.log(`Number of days: ${initialItinerary?.days?.length || 0}`);
    console.log(`Budget in itinerary: ${data3.summary?.budget?.amount}`);

    if (!initialItinerary || initialItinerary.days.length === 0) {
      console.log('\n❌ FAILED: Initial itinerary not created. Cannot continue tests.');
      return;
    }

    await sleep(2000);

    // TEST 1: Budget change
    console.log('\n\n📍 TEST 1: Change budget');
    console.log('-'.repeat(80));
    const beforeBudget = data3.summary.budget.amount;
    const data4 = await sendMessage(chatId, 'Actually, increase the budget to $5000');
    console.log(`Response: "${data4.response.substring(0, 150)}..."`);
    console.log(`Budget before: $${beforeBudget}`);
    console.log(`Budget after: $${data4.summary?.budget?.amount || 'NOT SET'}`);
    console.log(`Budget updated: ${data4.summary?.budget?.amount === 5000 ? '✅ YES' : '❌ NO'}`);
    console.log(`Itinerary still present: ${data4.itinerary?.days?.length > 0 ? '✅ YES' : '❌ NO'}`);
    console.log(`Itinerary days count: ${data4.itinerary?.days?.length || 0}`);

    const budgetTestPassed = data4.summary?.budget?.amount === 5000 && data4.itinerary?.days?.length === 5;

    await sleep(2000);

    // TEST 2: Duration change
    console.log('\n\n📍 TEST 2: Change trip duration');
    console.log('-'.repeat(80));
    const data5 = await sendMessage(chatId, 'Change it to a 7-day trip instead');
    console.log(`Response: "${data5.response.substring(0, 150)}..."`);
    console.log(`Duration before: 5 days`);
    console.log(`Duration after: ${data5.summary?.duration_days || 'NOT SET'} days`);
    console.log(`Duration updated: ${data5.summary?.duration_days === 7 ? '✅ YES' : '❌ NO'}`);
    console.log(`Itinerary updated: ${data5.itinerary?.days?.length === 7 ? '✅ YES (7 days)' : `❌ NO (${data5.itinerary?.days?.length || 0} days)`}`);

    const durationTestPassed = data5.summary?.duration_days === 7 && data5.itinerary?.days?.length === 7;

    await sleep(2000);

    // TEST 3: Segment modification
    console.log('\n\n📍 TEST 3: Modify specific day segment');
    console.log('-'.repeat(80));
    const day3Before = data5.itinerary?.days?.[2];
    console.log(`Day 3 before: ${day3Before?.title || 'NOT FOUND'}`);

    const data6 = await sendMessage(chatId, 'For Day 3, change the morning activity to visit Versailles Palace');
    console.log(`Response: "${data6.response.substring(0, 150)}..."`);

    const day3After = data6.itinerary?.days?.[2];
    console.log(`Day 3 after: ${day3After?.title || 'NOT FOUND'}`);

    const day3Text = JSON.stringify(day3After || {}).toLowerCase();
    const hasVersailles = day3Text.includes('versailles');
    console.log(`Day 3 mentions Versailles: ${hasVersailles ? '✅ YES' : '❌ NO'}`);
    console.log(`Itinerary days count: ${data6.itinerary?.days?.length || 0}`);

    const segmentTestPassed = hasVersailles && data6.itinerary?.days?.length === 7;

    await sleep(2000);

    // TEST 4: Add activity to existing segment
    console.log('\n\n📍 TEST 4: Add activity to existing day');
    console.log('-'.repeat(80));
    const data7 = await sendMessage(chatId, 'Add a Seine River cruise in the evening of Day 2');
    console.log(`Response: "${data7.response.substring(0, 150)}..."`);

    const day2 = data7.itinerary?.days?.[1];
    const day2Text = JSON.stringify(day2 || {}).toLowerCase();
    const hasSeineCruise = day2Text.includes('seine') || day2Text.includes('cruise');
    console.log(`Day 2 mentions Seine/cruise: ${hasSeineCruise ? '✅ YES' : '❌ NO'}`);
    console.log(`Itinerary days count: ${data7.itinerary?.days?.length || 0}`);

    const addActivityTestPassed = hasSeineCruise && data7.itinerary?.days?.length === 7;

    // Final Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 FINAL RESULTS');
    console.log('='.repeat(80));

    const results = [
      { name: 'Initial itinerary creation', passed: initialItinerary.days.length === 5 },
      { name: 'Budget update', passed: budgetTestPassed },
      { name: 'Duration update (5→7 days)', passed: durationTestPassed },
      { name: 'Segment modification (Day 3)', passed: segmentTestPassed },
      { name: 'Add activity (Day 2)', passed: addActivityTestPassed }
    ];

    results.forEach((result, i) => {
      console.log(`\n${i + 1}. ${result.name}: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    });

    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`Overall: ${passedCount}/${totalCount} tests passed (${((passedCount / totalCount) * 100).toFixed(1)}%)`);
    console.log('='.repeat(80));

    if (passedCount === totalCount) {
      console.log('\n🎉 ALL ITINERARY UPDATE TESTS PASSED!\n');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED. Review above for details.\n');
    }

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testItineraryUpdates();
