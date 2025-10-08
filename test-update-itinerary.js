/**
 * Focused test for itinerary updates
 * Tests updating budget, duration, and segments after initial creation
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api/chat';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendMessage(chatId, message) {
  console.log(`\n→ Sending: "${message}"`);
  const response = await fetch(`${API_BASE}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message })
  });
  const data = await response.json();
  console.log(`← Response preview: "${data.response.substring(0, 120)}..."`);
  return data;
}

async function testItineraryUpdates() {
  console.log('🧪 ITINERARY UPDATE TEST\n');
  console.log('='.repeat(80));

  const chatId = `update-test-${Date.now()}`;

  try {
    // Create initial itinerary quickly
    console.log('\n📍 SETUP: Creating initial itinerary');
    console.log('-'.repeat(80));

    await sendMessage(chatId, 'Plan a 5-day trip to Tokyo for 2 people');
    await sleep(1000);

    await sendMessage(chatId, 'From Mumbai, July 15-20 2026, budget 200000 INR total');
    await sleep(1000);

    const data3 = await sendMessage(chatId, 'Yes, create the detailed itinerary');

    // Verify initial itinerary
    if (!data3.itinerary || data3.itinerary.days.length === 0) {
      console.log('\n❌ FAILED: Initial itinerary not created');
      return;
    }

    console.log(`\n✅ Initial itinerary created:`);
    console.log(`   - Days: ${data3.itinerary.days.length}`);
    console.log(`   - Budget: ${data3.summary.budget.currency} ${data3.summary.budget.amount}`);
    console.log(`   - Duration: ${data3.summary.duration_days} days`);
    console.log(`   - Pax: ${data3.summary.pax}`);

    await sleep(2000);

    // TEST 1: Update budget
    console.log('\n\n📍 TEST 1: Update budget (200000 → 300000 INR)');
    console.log('-'.repeat(80));

    const data4 = await sendMessage(chatId, 'Actually, increase the budget to 300000 INR');

    console.log(`\nResults:`);
    console.log(`   Budget before: 200000 INR`);
    console.log(`   Budget after: ${data4.summary?.budget?.amount || 'NOT SET'} ${data4.summary?.budget?.currency || ''}`);
    console.log(`   Budget updated: ${data4.summary?.budget?.amount === 300000 ? '✅ YES' : '❌ NO'}`);
    console.log(`   Itinerary preserved: ${data4.itinerary?.days?.length === 5 ? '✅ YES (5 days)' : `❌ NO (${data4.itinerary?.days?.length || 0} days)`}`);

    const budgetTest = data4.summary?.budget?.amount === 300000 && data4.itinerary?.days?.length === 5;

    await sleep(2000);

    // TEST 2: Change trip duration
    console.log('\n\n📍 TEST 2: Change trip duration (5 → 7 days)');
    console.log('-'.repeat(80));

    const data5 = await sendMessage(chatId, 'Change it to a 7-day trip instead');

    console.log(`\nResults:`);
    console.log(`   Duration before: 5 days`);
    console.log(`   Duration after: ${data5.summary?.duration_days || 'NOT SET'} days`);
    console.log(`   Duration updated: ${data5.summary?.duration_days === 7 ? '✅ YES' : '❌ NO'}`);
    console.log(`   Itinerary updated: ${data5.itinerary?.days?.length === 7 ? '✅ YES (7 days)' : `❌ NO (${data5.itinerary?.days?.length || 0} days)`}`);

    const durationTest = data5.summary?.duration_days === 7 && data5.itinerary?.days?.length === 7;

    await sleep(2000);

    // TEST 3: Modify specific segment
    console.log('\n\n📍 TEST 3: Modify specific day segment');
    console.log('-'.repeat(80));

    const day3Before = data5.itinerary?.days?.[2];
    console.log(`   Day 3 before: ${day3Before?.title || 'NOT FOUND'}`);

    const data6 = await sendMessage(chatId, 'For Day 3, change the morning to visit TeamLab Borderless digital art museum');

    const day3After = data6.itinerary?.days?.[2];
    console.log(`   Day 3 after: ${day3After?.title || 'NOT FOUND'}`);

    const day3Text = JSON.stringify(day3After || {}).toLowerCase();
    const hasTeamLab = day3Text.includes('teamlab') || day3Text.includes('digital') || day3Text.includes('art museum');

    console.log(`\nResults:`);
    console.log(`   Day 3 mentions TeamLab/digital/art museum: ${hasTeamLab ? '✅ YES' : '❌ NO'}`);
    console.log(`   Itinerary preserved: ${data6.itinerary?.days?.length === 7 ? '✅ YES (7 days)' : `❌ NO (${data6.itinerary?.days?.length || 0} days)`}`);

    const segmentTest = hasTeamLab && data6.itinerary?.days?.length === 7;

    await sleep(2000);

    // TEST 4: Add activity to existing day
    console.log('\n\n📍 TEST 4: Add activity to existing day');
    console.log('-'.repeat(80));

    const data7 = await sendMessage(chatId, 'Add a visit to Senso-ji Temple in the afternoon of Day 2');

    const day2 = data7.itinerary?.days?.[1];
    const day2Text = JSON.stringify(day2 || {}).toLowerCase();
    const hasSensoji = day2Text.includes('senso') || day2Text.includes('sensoji') || day2Text.includes('temple');

    console.log(`\nResults:`);
    console.log(`   Day 2 mentions Senso-ji/temple: ${hasSensoji ? '✅ YES' : '❌ NO'}`);
    console.log(`   Itinerary preserved: ${data7.itinerary?.days?.length === 7 ? '✅ YES (7 days)' : `❌ NO (${data7.itinerary?.days?.length || 0} days)`}`);

    const addActivityTest = hasSensoji && data7.itinerary?.days?.length === 7;

    // Final Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(80));

    const results = [
      { name: 'Budget update (200k→300k INR)', passed: budgetTest },
      { name: 'Duration update (5→7 days)', passed: durationTest },
      { name: 'Segment modification (Day 3)', passed: segmentTest },
      { name: 'Add activity (Day 2)', passed: addActivityTest }
    ];

    results.forEach((result, i) => {
      console.log(`${i + 1}. ${result.name}: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    });

    const passedCount = results.filter(r => r.passed).length;
    console.log(`\n${passedCount}/4 tests passed (${((passedCount / 4) * 100).toFixed(1)}%)`);
    console.log('='.repeat(80));

    if (passedCount === 4) {
      console.log('\n🎉 ALL ITINERARY UPDATE TESTS PASSED!\n');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED. Review above for details.\n');
    }

    // Show final state
    console.log('Final State:');
    console.log(`  - Duration: ${data7.summary.duration_days} days`);
    console.log(`  - Budget: ${data7.summary.budget.currency} ${data7.summary.budget.amount}`);
    console.log(`  - Itinerary days: ${data7.itinerary.days.length}`);
    console.log(`  - Places: ${data7.placesOfInterest?.length || 0}`);
    console.log(`  - Questions: ${data7.suggestedQuestions?.length || 0}`);

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    console.error(error.stack);
  }
}

testItineraryUpdates();
