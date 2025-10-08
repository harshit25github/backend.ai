/**
 * Comprehensive test to verify all identified issues are resolved:
 * 1. suggestedQuestions should NOT appear in response text
 * 2. update_itinerary should only be called when actually creating/modifying itinerary
 * 3. Itinerary should update correctly when user requests changes
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api/chat';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testComprehensiveIssues() {
  console.log('🧪 COMPREHENSIVE ISSUE VERIFICATION TEST\n');
  console.log('=' .repeat(80));

  const chatId = `comprehensive-test-${Date.now()}`;
  let testsPassed = 0;
  let testsFailed = 0;

  // TEST 1: suggestedQuestions should NOT be in response text
  console.log('\n📍 TEST 1: suggestedQuestions should be silent (not in response text)');
  console.log('-'.repeat(80));

  try {
    const response1 = await fetch(`${API_BASE}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: 'I want to visit Paris for 5 days'
      })
    });

    const data1 = await response1.json();
    const responseText = data1.response.toLowerCase();

    // Check if response contains question-like patterns that suggest leaked questions
    const hasQuestionList = /what are|how do i|where should|which/.test(responseText);
    const hasQuestionFormat = responseText.includes('?') && responseText.split('?').length > 3;
    const leakedQuestions = hasQuestionList && hasQuestionFormat;

    console.log(`Response text preview: "${data1.response.substring(0, 200)}..."`);
    console.log(`\nSuggestedQuestions in context: ${data1.suggestedQuestions?.length || 0} questions`);
    console.log(`Questions appear in response text: ${leakedQuestions ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);

    if (!leakedQuestions && data1.suggestedQuestions && data1.suggestedQuestions.length > 0) {
      console.log('✅ TEST 1 PASSED: Questions are captured silently');
      testsPassed++;
    } else {
      console.log('❌ TEST 1 FAILED: Questions may be leaking into response');
      testsFailed++;
    }
  } catch (error) {
    console.error('❌ TEST 1 ERROR:', error.message);
    testsFailed++;
  }

  await sleep(1000);

  // TEST 2: Itinerary should NOT be created during information gathering
  console.log('\n\n📍 TEST 2: Itinerary should NOT be created without confirmation');
  console.log('-'.repeat(80));

  try {
    const response2 = await fetch(`${API_BASE}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: 'From Delhi, June 1-6, 2026, budget 100000 INR for 2 people'
      })
    });

    const data2 = await response2.json();
    const hasItinerary = data2.itinerary && data2.itinerary.days && data2.itinerary.days.length > 0;

    console.log(`Response: "${data2.response.substring(0, 150)}..."`);
    console.log(`Itinerary created: ${hasItinerary ? '❌ YES (BAD - should wait for confirmation)' : '✅ NO (GOOD)'}`);

    if (!hasItinerary) {
      console.log('✅ TEST 2 PASSED: No premature itinerary creation');
      testsPassed++;
    } else {
      console.log('❌ TEST 2 FAILED: Itinerary created without user confirmation');
      testsFailed++;
    }
  } catch (error) {
    console.error('❌ TEST 2 ERROR:', error.message);
    testsFailed++;
  }

  await sleep(1000);

  // TEST 3: Itinerary should be created when user confirms
  console.log('\n\n📍 TEST 3: Itinerary SHOULD be created after user confirmation');
  console.log('-'.repeat(80));

  try {
    const response3 = await fetch(`${API_BASE}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: 'Yes, please create the detailed itinerary'
      })
    });

    const data3 = await response3.json();
    const hasItinerary = data3.itinerary && data3.itinerary.days && data3.itinerary.days.length > 0;
    const itineraryDays = data3.itinerary?.days?.length || 0;

    console.log(`Response preview: "${data3.response.substring(0, 150)}..."`);
    console.log(`Itinerary created: ${hasItinerary ? '✅ YES (GOOD)' : '❌ NO (BAD)'}`);
    console.log(`Number of days: ${itineraryDays}`);

    if (hasItinerary && itineraryDays === 5) {
      console.log('✅ TEST 3 PASSED: Itinerary created correctly after confirmation');
      testsPassed++;
    } else {
      console.log('❌ TEST 3 FAILED: Itinerary not created properly after confirmation');
      testsFailed++;
    }
  } catch (error) {
    console.error('❌ TEST 3 ERROR:', error.message);
    testsFailed++;
  }

  await sleep(1000);

  // TEST 4: Itinerary should update when user requests modification
  console.log('\n\n📍 TEST 4: Itinerary should UPDATE when user requests changes');
  console.log('-'.repeat(80));

  try {
    const response4 = await fetch(`${API_BASE}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: 'Change Day 2 to focus on Louvre Museum all day'
      })
    });

    const data4 = await response4.json();
    const hasItinerary = data4.itinerary && data4.itinerary.days && data4.itinerary.days.length > 0;
    const day2 = data4.itinerary?.days?.[1];
    const day2HasLouvre = day2 && JSON.stringify(day2).toLowerCase().includes('louvre');

    console.log(`Response preview: "${data4.response.substring(0, 150)}..."`);
    console.log(`Itinerary present: ${hasItinerary ? '✅ YES' : '❌ NO'}`);
    console.log(`Day 2 mentions Louvre: ${day2HasLouvre ? '✅ YES' : '❌ NO'}`);

    if (hasItinerary && day2HasLouvre) {
      console.log('✅ TEST 4 PASSED: Itinerary updated correctly');
      testsPassed++;
    } else {
      console.log('❌ TEST 4 FAILED: Itinerary not updated properly');
      testsFailed++;
    }
  } catch (error) {
    console.error('❌ TEST 4 ERROR:', error.message);
    testsFailed++;
  }

  await sleep(1000);

  // TEST 5: General question should NOT modify itinerary
  console.log('\n\n📍 TEST 5: General question should NOT modify itinerary');
  console.log('-'.repeat(80));

  try {
    // First get current itinerary
    const contextResponse = await fetch(`${API_BASE}/context/${chatId}`);
    const contextData = await contextResponse.json();
    const beforeItinerary = JSON.stringify(contextData.context.itinerary);

    const response5 = await fetch(`${API_BASE}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: 'What is the best time to visit Paris?'
      })
    });

    const data5 = await response5.json();
    const afterItinerary = JSON.stringify(data5.context.itinerary);
    const itineraryUnchanged = beforeItinerary === afterItinerary;

    console.log(`Response: "${data5.response.substring(0, 150)}..."`);
    console.log(`Itinerary unchanged: ${itineraryUnchanged ? '✅ YES (GOOD)' : '❌ NO (BAD)'}`);

    if (itineraryUnchanged) {
      console.log('✅ TEST 5 PASSED: Itinerary preserved during general question');
      testsPassed++;
    } else {
      console.log('❌ TEST 5 FAILED: Itinerary incorrectly modified');
      testsFailed++;
    }
  } catch (error) {
    console.error('❌ TEST 5 ERROR:', error.message);
    testsFailed++;
  }

  // Final Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(80));
  console.log(`\nTotal Tests: 5`);
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`\nSuccess Rate: ${((testsPassed / 5) * 100).toFixed(1)}%`);

  if (testsPassed === 5) {
    console.log('\n🎉 ALL TESTS PASSED! All issues resolved.\n');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED. Please review the results above.\n');
  }
  console.log('='.repeat(80));
}

// Run the test
testComprehensiveIssues();
