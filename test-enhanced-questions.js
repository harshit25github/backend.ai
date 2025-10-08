/**
 * Test enhanced suggestedQuestions generation
 * Should have mix of context-specific and general travel questions
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api/chat';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testEnhancedQuestions() {
  console.log('🧪 ENHANCED SUGGESTED QUESTIONS TEST\n');
  console.log('='.repeat(80));

  const chatId = `questions-test-${Date.now()}`;

  try {
    // STEP 1: Initial request with some context
    console.log('\n📍 STEP 1: Initial request (destination, duration, pax)');
    console.log('-'.repeat(80));

    const response1 = await fetch(`${API_BASE}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: 'Plan a 7-day trip to Bali for 2 people'
      })
    });

    const data1 = await response1.json();
    console.log(`\nContext captured:`);
    console.log(`  Destination: ${data1.summary?.destination?.city}`);
    console.log(`  Duration: ${data1.summary?.duration_days} days`);
    console.log(`  Pax: ${data1.summary?.pax}`);

    console.log(`\nSuggested Questions (${data1.suggestedQuestions?.length || 0}):`);
    data1.suggestedQuestions?.forEach((q, i) => {
      console.log(`  ${i + 1}. ${q}`);
    });

    console.log(`\n✅ Analysis:`);
    const hasContextSpecific = data1.suggestedQuestions?.some(q =>
      q.toLowerCase().includes('bali') ||
      q.toLowerCase().includes('7 day') ||
      q.toLowerCase().includes('7-day')
    );
    const hasGeneralTravel = data1.suggestedQuestions?.some(q =>
      q.toLowerCase().includes('visa') ||
      q.toLowerCase().includes('weather') ||
      q.toLowerCase().includes('food') ||
      q.toLowerCase().includes('culture')
    );
    const isUserPerspective = !data1.suggestedQuestions?.some(q =>
      q.toLowerCase().includes('would you') ||
      q.toLowerCase().includes('do you want') ||
      q.toLowerCase().includes('should i include') ||
      q.toLowerCase().includes('what\'s your')
    );

    console.log(`  - Has context-specific (Bali/7-day): ${hasContextSpecific ? '✅' : '❌'}`);
    console.log(`  - Has general travel questions: ${hasGeneralTravel ? '✅' : '❌'}`);
    console.log(`  - User-asking-agent perspective: ${isUserPerspective ? '✅' : '❌'}`);

    await sleep(2000);

    // STEP 2: Add more context (origin, budget, dates)
    console.log('\n\n📍 STEP 2: Add more context (origin, budget, dates)');
    console.log('-'.repeat(80));

    const response2 = await fetch(`${API_BASE}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: 'From Singapore, July 10-17 2026, budget $3000 total'
      })
    });

    const data2 = await response2.json();
    console.log(`\nContext captured:`);
    console.log(`  Origin: ${data2.summary?.origin?.city}`);
    console.log(`  Budget: ${data2.summary?.budget?.currency} ${data2.summary?.budget?.amount}`);
    console.log(`  Dates: ${data2.summary?.outbound_date} to ${data2.summary?.return_date}`);

    console.log(`\nSuggested Questions (${data2.suggestedQuestions?.length || 0}):`);
    data2.suggestedQuestions?.forEach((q, i) => {
      console.log(`  ${i + 1}. ${q}`);
    });

    console.log(`\n✅ Analysis:`);
    const hasBudgetContext = data2.suggestedQuestions?.some(q =>
      q.toLowerCase().includes('3000') ||
      q.toLowerCase().includes('budget')
    );
    const hasOriginContext = data2.suggestedQuestions?.some(q =>
      q.toLowerCase().includes('singapore')
    );
    const hasSeasonContext = data2.suggestedQuestions?.some(q =>
      q.toLowerCase().includes('july') ||
      q.toLowerCase().includes('weather')
    );
    const isStillUserPerspective = !data2.suggestedQuestions?.some(q =>
      q.toLowerCase().includes('would you') ||
      q.toLowerCase().includes('do you want') ||
      q.toLowerCase().startsWith('any ')
    );

    console.log(`  - Uses budget context ($3000): ${hasBudgetContext ? '✅' : '❌'}`);
    console.log(`  - Uses origin context (Singapore): ${hasOriginContext ? '✅' : '❌'}`);
    console.log(`  - Uses season context (July/weather): ${hasSeasonContext ? '✅' : '❌'}`);
    console.log(`  - Still user-asking-agent: ${isStillUserPerspective ? '✅' : '❌'}`);

    await sleep(2000);

    // STEP 3: Create itinerary
    console.log('\n\n📍 STEP 3: Create itinerary');
    console.log('-'.repeat(80));

    const response3 = await fetch(`${API_BASE}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: 'Yes, please create the detailed itinerary'
      })
    });

    const data3 = await response3.json();
    const hasItinerary = data3.itinerary?.days?.length > 0;

    console.log(`\nItinerary created: ${hasItinerary ? '✅ YES' : '❌ NO'}`);
    console.log(`Days: ${data3.itinerary?.days?.length || 0}`);

    console.log(`\nSuggested Questions (${data3.suggestedQuestions?.length || 0}):`);
    data3.suggestedQuestions?.forEach((q, i) => {
      console.log(`  ${i + 1}. ${q}`);
    });

    console.log(`\n✅ Analysis:`);
    const hasItineraryContext = data3.suggestedQuestions?.some(q =>
      q.toLowerCase().includes('day trip') ||
      q.toLowerCase().includes('hotel') ||
      q.toLowerCase().includes('restaurant') ||
      q.toLowerCase().includes('day ')
    );
    const hasEnhancementQuestions = data3.suggestedQuestions?.some(q =>
      q.toLowerCase().includes('add') ||
      q.toLowerCase().includes('suggest') ||
      q.toLowerCase().includes('recommend')
    );

    console.log(`  - Has itinerary-based questions: ${hasItineraryContext ? '✅' : '❌'}`);
    console.log(`  - Has enhancement questions: ${hasEnhancementQuestions ? '✅' : '❌'}`);

    // Final Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));

    const allTests = [
      { name: 'Step 1: Context-specific questions', passed: hasContextSpecific },
      { name: 'Step 1: General travel questions', passed: hasGeneralTravel },
      { name: 'Step 1: User perspective', passed: isUserPerspective },
      { name: 'Step 2: Budget context used', passed: hasBudgetContext },
      { name: 'Step 2: Origin/season context', passed: hasOriginContext || hasSeasonContext },
      { name: 'Step 2: Still user perspective', passed: isStillUserPerspective },
      { name: 'Step 3: Itinerary-based questions', passed: hasItineraryContext },
      { name: 'Step 3: Enhancement questions', passed: hasEnhancementQuestions }
    ];

    allTests.forEach((test, i) => {
      console.log(`${i + 1}. ${test.name}: ${test.passed ? '✅' : '❌'}`);
    });

    const passedCount = allTests.filter(t => t.passed).length;
    console.log(`\n${passedCount}/${allTests.length} checks passed`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
  }
}

testEnhancedQuestions();
