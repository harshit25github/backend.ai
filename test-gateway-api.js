import 'dotenv/config';
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api/chat';
const chatId = `api-test-${Date.now()}`;

console.log('🧪 Gateway Agent API Test Suite');
console.log('='.repeat(80));
console.log(`Test Chat ID: ${chatId}\n`);

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (message) console.log(`  → ${message}`);

  testResults.tests.push({ name, passed, message });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

async function sendMessage(message, expectItinerary = false) {
  console.log(`\n📤 Sending: "${message}"`);

  const response = await fetch(`${API_BASE}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  console.log(`📥 Response (${data.response.length} chars)`);
  console.log(`🤖 Agent: ${data.lastAgent}`);

  return data;
}

try {
  // ============================================================================
  // TEST 1: Basic API Response Structure
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 1: Basic API Response Structure');
  console.log('='.repeat(80));

  const result1 = await sendMessage('I want to plan a trip to Rome');

  logTest('Response has success field', result1.success === true);
  logTest('Response has chatId', result1.chatId === chatId);
  logTest('Response has response text', typeof result1.response === 'string');
  logTest('Response has lastAgent', typeof result1.lastAgent === 'string');
  logTest('Response has context', result1.context !== undefined);
  logTest('Response has summary', result1.summary !== undefined);
  logTest('Response has suggestedQuestions array', Array.isArray(result1.suggestedQuestions));
  logTest('Response has placesOfInterest array', Array.isArray(result1.placesOfInterest));

  // ============================================================================
  // TEST 2: Context Persistence
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: Context Persistence');
  console.log('='.repeat(80));

  logTest('Summary destination captured', result1.summary?.destination?.city === 'Rome');

  const result2 = await sendMessage('From Paris, 3 days, March 10-13, 2026, 2 people, 2000 EUR total');

  logTest('Origin captured', result2.summary?.origin?.city === 'Paris');
  logTest('Duration captured', result2.summary?.duration_days === 3);
  logTest('Passenger count captured', result2.summary?.passenger_count === 2);
  logTest('Budget captured', result2.summary?.budget?.amount === 2000);
  logTest('Budget currency captured', result2.summary?.budget?.currency === 'EUR');
  logTest('Outbound date captured', result2.summary?.outbound_date === '2026-03-10');
  logTest('Return date auto-calculated', result2.summary?.return_date === '2026-03-13');

  // ============================================================================
  // TEST 3: Itinerary Creation
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: Itinerary Creation');
  console.log('='.repeat(80));

  const result3 = await sendMessage('Yes, please create the detailed itinerary');

  const hasItinerary = result3.itinerary?.days?.length > 0;
  logTest('Itinerary created', hasItinerary);

  if (hasItinerary) {
    const itinerary = result3.itinerary;
    const day1 = itinerary.days[0];

    logTest('Itinerary has 3 days', itinerary.days.length === 3, `Got ${itinerary.days.length} days`);
    logTest('Duration matches itinerary length',
      itinerary.computed?.duration_days === itinerary.days.length);

    // Check segment structure
    logTest('Day has morning segment', Array.isArray(day1.segments.morning));
    logTest('Day has afternoon segment', Array.isArray(day1.segments.afternoon));
    logTest('Day has evening segment', Array.isArray(day1.segments.evening));

    // Check single object per segment
    logTest('Morning has exactly 1 object',
      day1.segments.morning.length === 1,
      `Got ${day1.segments.morning.length}`);
    logTest('Afternoon has exactly 1 object',
      day1.segments.afternoon.length === 1,
      `Got ${day1.segments.afternoon.length}`);
    logTest('Evening has exactly 1 object',
      day1.segments.evening.length === 1,
      `Got ${day1.segments.evening.length}`);

    // Check new segment field structure
    if (day1.segments.morning.length > 0) {
      const morning = day1.segments.morning[0];
      logTest('Segment has place field', morning.place !== undefined);
      logTest('Segment does NOT have places field', morning.places === undefined);
      logTest('Segment has duration_hours', typeof morning.duration_hours === 'number');
      logTest('Segment has descriptor', typeof morning.descriptor === 'string');

      const wordCount = morning.place.split(' ').length;
      logTest('Place field has max 4 words',
        wordCount <= 4,
        `"${morning.place}" has ${wordCount} words`);
    }

    console.log('\n📋 Sample Day 1 Structure:');
    console.log(JSON.stringify(day1, null, 2).substring(0, 500) + '...');
  }

  // ============================================================================
  // TEST 4: Context Endpoint
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 4: Context Endpoint');
  console.log('='.repeat(80));

  const contextResponse = await fetch(`${API_BASE}/context/${chatId}`);
  const contextData = await contextResponse.json();

  logTest('Context endpoint accessible', contextResponse.ok);
  logTest('Context has chatId', contextData.chatId === chatId);
  logTest('Context has summary', contextData.context?.summary !== undefined);
  logTest('Context has itinerary', contextData.context?.itinerary !== undefined);

  // ============================================================================
  // TEST 5: Suggested Questions
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 5: Suggested Questions');
  console.log('='.repeat(80));

  const questions = result3.suggestedQuestions || [];
  logTest('Has suggested questions', questions.length > 0, `Got ${questions.length} questions`);

  if (questions.length > 0) {
    console.log('\n💡 Sample Suggested Questions:');
    questions.slice(0, 3).forEach((q, i) => {
      console.log(`  ${i + 1}. ${q}`);
    });

    // Check question perspective (should be user asking agent)
    const agentAskingPatterns = ['would you like', 'do you want', 'should i', 'can i help'];
    const wrongQuestions = questions.filter(q =>
      agentAskingPatterns.some(pattern => q.toLowerCase().includes(pattern))
    );

    logTest('Questions are user-asking-agent perspective',
      wrongQuestions.length === 0,
      wrongQuestions.length > 0 ? `Found ${wrongQuestions.length} wrong perspective` : undefined);
  }

  // ============================================================================
  // TEST 6: Modification Flow
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 6: Itinerary Modification');
  console.log('='.repeat(80));

  const result4 = await sendMessage('Add a visit to Vatican Museums in the morning of day 2');

  logTest('Modification request processed', result4.success === true);
  logTest('Context updated', result4.context !== undefined);

  if (result4.itinerary?.days?.length > 1) {
    const day2Morning = result4.itinerary.days[1].segments.morning[0];
    const mentionsVatican = day2Morning.place.toLowerCase().includes('vatican') ||
                           day2Morning.descriptor.toLowerCase().includes('vatican');
    logTest('Vatican Museums added to Day 2', mentionsVatican);
  }

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Pass Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}${t.message ? ': ' + t.message : ''}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  if (testResults.failed === 0) {
    console.log('✅ ALL TESTS PASSED - API IS READY!');
  } else {
    console.log('❌ SOME TESTS FAILED - NEEDS ATTENTION');
  }
  console.log('='.repeat(80));

  process.exit(testResults.failed > 0 ? 1 : 0);

} catch (error) {
  console.error('\n❌ TEST ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
}
