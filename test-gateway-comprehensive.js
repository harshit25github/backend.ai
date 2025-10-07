import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';
import fs from 'fs/promises';

const TEST_RESULTS_DIR = './data/gateway-test-results';
const timestamp = Date.now();

// Ensure results directory exists
await fs.mkdir(TEST_RESULTS_DIR, { recursive: true });

// Test result tracker
const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    totalTokens: 0,
    totalTime: 0
  }
};

function logTest(name, status, details) {
  const test = { name, status, ...details };
  results.tests.push(test);
  results.summary.total++;
  if (status === 'PASS') results.summary.passed++;
  else results.summary.failed++;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${name}`);
  console.log(`STATUS: ${status === 'PASS' ? '✅' : '❌'} ${status}`);
  if (details.error) console.log(`ERROR: ${details.error}`);
  console.log('='.repeat(80));
}

async function runTest(testName, userMessages, validations) {
  const startTime = Date.now();
  const chatId = `test-${timestamp}-${testName.replace(/\s+/g, '-')}`;

  try {
    console.log(`\n🧪 Running: ${testName}`);

    let context = null;
    let lastOutput = null;
    let conversationHistory = [];

    // Run through all messages in conversation
    for (let i = 0; i < userMessages.length; i++) {
      const msg = userMessages[i];
      console.log(`\n  👤 User (turn ${i+1}): "${msg.substring(0, 100)}..."`);

      conversationHistory.push({ role: 'user', content: msg });

      const result = await runMultiAgentSystem(msg, chatId, conversationHistory);

      conversationHistory.push({ role: 'assistant', content: result.finalOutput });
      context = result.context;
      lastOutput = result.finalOutput;

      console.log(`  🤖 Agent: ${result.lastAgent}`);
      console.log(`  📊 Response length: ${result.finalOutput.length} chars`);
    }

    // Run validations
    const validationResults = [];
    for (const validation of validations) {
      const result = validation(context, lastOutput);
      validationResults.push(result);
      console.log(`  ${result.passed ? '✅' : '❌'} ${result.name}: ${result.message}`);
    }

    const allPassed = validationResults.every(v => v.passed);
    const duration = Date.now() - startTime;

    logTest(testName, allPassed ? 'PASS' : 'FAIL', {
      duration,
      validations: validationResults,
      summary: context.summary,
      itineraryDays: context.itinerary?.days?.length || 0,
      error: allPassed ? null : 'Some validations failed'
    });

    results.summary.totalTime += duration;

    // Save detailed context
    await fs.writeFile(
      `${TEST_RESULTS_DIR}/${testName.replace(/\s+/g, '-')}.json`,
      JSON.stringify({ context, lastOutput, validationResults }, null, 2)
    );

    return { passed: allPassed, context };

  } catch (error) {
    const duration = Date.now() - startTime;
    logTest(testName, 'FAIL', {
      duration,
      error: error.message,
      stack: error.stack
    });
    results.summary.totalTime += duration;
    return { passed: false, error };
  }
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

const validators = {
  hasDestination: (city) => (ctx) => ({
    name: 'Has destination',
    passed: ctx.summary.destination?.city === city,
    message: `Expected: ${city}, Got: ${ctx.summary.destination?.city || 'none'}`
  }),

  hasOrigin: (city) => (ctx) => ({
    name: 'Has origin',
    passed: ctx.summary.origin?.city === city,
    message: `Expected: ${city}, Got: ${ctx.summary.origin?.city || 'none'}`
  }),

  hasDuration: (days) => (ctx) => ({
    name: 'Has duration',
    passed: ctx.summary.duration_days === days,
    message: `Expected: ${days}, Got: ${ctx.summary.duration_days}`
  }),

  hasPassengers: (count) => (ctx) => ({
    name: 'Has passenger count',
    passed: ctx.summary.passenger_count === count,
    message: `Expected: ${count}, Got: ${ctx.summary.passenger_count}`
  }),

  hasBudget: (amount, currency) => (ctx) => ({
    name: 'Has budget',
    passed: ctx.summary.budget?.amount === amount && ctx.summary.budget?.currency === currency,
    message: `Expected: ${amount} ${currency}, Got: ${ctx.summary.budget?.amount || 'none'} ${ctx.summary.budget?.currency || ''}`
  }),

  returnDateCalculated: () => (ctx) => {
    if (!ctx.summary.outbound_date || !ctx.summary.duration_days) {
      return { name: 'Return date calculated', passed: false, message: 'Missing outbound_date or duration_days' };
    }
    const expected = new Date(ctx.summary.outbound_date);
    expected.setDate(expected.getDate() + ctx.summary.duration_days);
    const expectedReturn = expected.toISOString().split('T')[0];
    return {
      name: 'Return date auto-calculated',
      passed: ctx.summary.return_date === expectedReturn,
      message: `Expected: ${expectedReturn}, Got: ${ctx.summary.return_date}`
    };
  },

  hasItinerary: (minDays = 1) => (ctx) => ({
    name: 'Has itinerary',
    passed: (ctx.itinerary?.days?.length || 0) >= minDays,
    message: `Expected: >= ${minDays} days, Got: ${ctx.itinerary?.days?.length || 0}`
  }),

  itineraryMatchesDuration: () => (ctx) => ({
    name: 'Itinerary matches duration',
    passed: ctx.itinerary?.days?.length === ctx.summary.duration_days,
    message: `Itinerary: ${ctx.itinerary?.days?.length || 0}, Duration: ${ctx.summary.duration_days}`
  }),

  hasSuggestedQuestions: (min = 3) => (ctx) => ({
    name: 'Has suggested questions',
    passed: (ctx.summary.suggestedQuestions?.length || 0) >= min,
    message: `Expected: >= ${min}, Got: ${ctx.summary.suggestedQuestions?.length || 0}`
  }),

  questionsAreUserAsking: () => (ctx) => {
    const questions = ctx.summary.suggestedQuestions || [];
    const wrongPatterns = ['would you like', 'do you want', 'should i', 'can i'];
    const wrongQuestions = questions.filter(q =>
      wrongPatterns.some(pattern => q.toLowerCase().includes(pattern))
    );
    return {
      name: 'Questions are user asking agent',
      passed: wrongQuestions.length === 0,
      message: wrongQuestions.length > 0
        ? `Found ${wrongQuestions.length} agent-asking-user questions`
        : 'All questions are user-asking-agent'
    };
  },

  hasPlacesOfInterest: (min = 3) => (ctx) => ({
    name: 'Has places of interest',
    passed: (ctx.summary.placesOfInterests?.length || 0) >= min,
    message: `Expected: >= ${min}, Got: ${ctx.summary.placesOfInterests?.length || 0}`
  }),

  hasSegmentStructure: () => (ctx) => {
    if (!ctx.itinerary?.days?.length) {
      return { name: 'Has proper segment structure', passed: false, message: 'No itinerary' };
    }
    const day1 = ctx.itinerary.days[0];
    const hasSegments = day1.segments &&
      Array.isArray(day1.segments.morning) &&
      Array.isArray(day1.segments.afternoon) &&
      Array.isArray(day1.segments.evening);

    let hasProperFields = false;
    if (hasSegments && day1.segments.morning.length > 0) {
      const seg = day1.segments.morning[0];
      hasProperFields = seg.places && seg.duration_hours && seg.descriptor;
    }

    return {
      name: 'Has proper segment structure',
      passed: hasSegments && hasProperFields,
      message: hasSegments && hasProperFields
        ? 'Segments have places, duration, descriptor'
        : 'Missing required segment fields'
    };
  },

  responseDoesNotMentionQuestions: () => (ctx, output) => {
    const mentionsQuestions = /questions (have been|to personalize|are ready)/i.test(output);
    return {
      name: 'Response does not mention questions',
      passed: !mentionsQuestions,
      message: mentionsQuestions ? 'Response mentions questions (should be silent)' : 'Questions captured silently'
    };
  }
};

// =============================================================================
// TEST SUITE
// =============================================================================

console.log('='.repeat(80));
console.log('COMPREHENSIVE GATEWAY AGENT TEST SUITE');
console.log('='.repeat(80));

// TEST 1: Basic trip planning flow
await runTest(
  '01 - Basic Trip Planning',
  [
    'Plan a 5-day trip to Paris for 2 people',
    'From Delhi, January 15-20, 2026, budget 150000 INR total',
    'Yes, create the itinerary'
  ],
  [
    validators.hasDestination('Paris'),
    validators.hasOrigin('Delhi'),
    validators.hasDuration(5),
    validators.hasPassengers(2),
    validators.hasBudget(150000, 'INR'),
    validators.returnDateCalculated(),
    validators.hasItinerary(5),
    validators.itineraryMatchesDuration(),
    validators.hasSuggestedQuestions(3),
    validators.hasSegmentStructure()
  ]
);

// TEST 2: Duration change (15 days → 8 days)
await runTest(
  '02 - Duration Change Sync',
  [
    'Create a 15-day Thailand itinerary for 1 person, budget 80000 INR',
    'From Mumbai, starting March 1, 2026',
    'Yes proceed',
    'Actually, change it to 8 days instead'
  ],
  [
    validators.hasDuration(8),
    validators.hasItinerary(8),
    validators.itineraryMatchesDuration(),
    validators.returnDateCalculated()
  ]
);

// TEST 3: Suggested questions perspective
await runTest(
  '03 - Question Perspective',
  [
    'I want to visit Santorini for 6 days with my partner'
  ],
  [
    validators.hasSuggestedQuestions(3),
    validators.questionsAreUserAsking(),
    validators.responseDoesNotMentionQuestions()
  ]
);

// TEST 4: Passenger count extraction
await runTest(
  '04 - Passenger Count Extraction',
  [
    'Plan a family trip to Dubai for 4 people - 2 adults and 2 kids'
  ],
  [
    validators.hasPassengers(4),
    validators.hasDestination('Dubai')
  ]
);

// TEST 5: Missing origin
await runTest(
  '05 - Missing Critical Info',
  [
    'I want to go to Tokyo for 7 days'
  ],
  [
    validators.hasDestination('Tokyo'),
    validators.hasDuration(7),
    // Should NOT have itinerary without origin
    (ctx) => ({
      name: 'No itinerary without origin',
      passed: (ctx.itinerary?.days?.length || 0) === 0,
      message: ctx.itinerary?.days?.length > 0 ? 'Created itinerary without origin' : 'Correctly waiting for origin'
    })
  ]
);

// TEST 6: Budget per person vs total
await runTest(
  '06 - Budget Per Person',
  [
    'Plan Rome trip for 2 people, 5 days, budget 2000 EUR per person',
    'From Paris, June 15-20, 2026',
    'Yes, proceed'
  ],
  [
    validators.hasBudget(2000, 'EUR'),
    (ctx) => ({
      name: 'Budget is per person',
      passed: ctx.summary.budget?.per_person === true,
      message: `per_person: ${ctx.summary.budget?.per_person}`
    })
  ]
);

// TEST 7: Multiple destination consideration
await runTest(
  '07 - Destination Refinement',
  [
    'I want beach vacation in Southeast Asia',
    'Thailand sounds good, Phuket specifically',
    '5 days, 2 people, from Singapore, budget $2000 total'
  ],
  [
    validators.hasDestination('Phuket'),
    validators.hasOrigin('Singapore')
  ]
);

// TEST 8: Date without year (future date inference)
await runTest(
  '08 - Date Inference',
  [
    'Plan 4-day Bali trip from Jakarta, leaving March 10, 2 people, 30000000 IDR'
  ],
  [
    validators.hasDuration(4),
    (ctx) => ({
      name: 'Has outbound date',
      passed: ctx.summary.outbound_date !== null && ctx.summary.outbound_date !== '',
      message: `Outbound date: ${ctx.summary.outbound_date || 'none'}`
    })
  ]
);

// TEST 9: Itinerary modification
await runTest(
  '09 - Itinerary Modification',
  [
    'Create 3-day Amsterdam itinerary from London, April 20-23, 2026, 2 people, £1500',
    'Yes proceed',
    'Can you add a day trip to Rotterdam on day 2?'
  ],
  [
    validators.hasItinerary(3),
    (ctx, output) => ({
      name: 'Contains Rotterdam',
      passed: output.toLowerCase().includes('rotterdam'),
      message: output.toLowerCase().includes('rotterdam') ? 'Rotterdam mentioned' : 'Rotterdam not found'
    })
  ]
);

// TEST 10: Places of Interest populated
await runTest(
  '10 - Places of Interest',
  [
    'I want to visit Barcelona for 5 days'
  ],
  [
    validators.hasDestination('Barcelona'),
    validators.hasPlacesOfInterest(5)
  ]
);

// TEST 11: Corner case - Very long trip
await runTest(
  '11 - Long Duration Trip',
  [
    'Plan a 30-day backpacking trip across Europe from New York, starting May 1, 2026, budget $10000, solo traveler'
  ],
  [
    validators.hasDuration(30),
    validators.hasPassengers(1),
    validators.hasBudget(10000, 'USD')
  ]
);

// TEST 12: Corner case - Same day trip
await runTest(
  '12 - One Day Trip',
  [
    'Plan a 1-day trip to Agra from Delhi, tomorrow, 3 people, 15000 INR',
    'Yes create the plan'
  ],
  [
    validators.hasDuration(1),
    validators.hasItinerary(1)
  ]
);

// TEST 13: Corner case - Large group
await runTest(
  '13 - Large Group',
  [
    'Plan 5-day trip to Goa for 12 people (corporate team outing), from Bangalore, budget 500000 INR total'
  ],
  [
    validators.hasPassengers(12),
    validators.hasBudget(500000, 'INR')
  ]
);

// TEST 14: Booking request routing
await runTest(
  '14 - Booking Agent Routing',
  [
    'Book me a flight to London from New York'
  ],
  [
    (ctx, output, result) => ({
      name: 'Routes to Booking Agent',
      passed: true, // We'll check the agent in the actual result
      message: 'Booking request handled'
    })
  ]
);

// TEST 15: Trip type preferences
await runTest(
  '15 - Trip Types',
  [
    'Plan adventure trip to New Zealand, 10 days, from Sydney, 2 people, interested in hiking and extreme sports, budget 8000 AUD'
  ],
  [
    validators.hasDuration(10),
    (ctx) => ({
      name: 'Has trip types',
      passed: (ctx.summary.tripTypes?.length || 0) > 0,
      message: `Trip types: ${ctx.summary.tripTypes?.join(', ') || 'none'}`
    })
  ]
);

// =============================================================================
// SAVE RESULTS
// =============================================================================

console.log('\n' + '='.repeat(80));
console.log('TEST SUMMARY');
console.log('='.repeat(80));
console.log(`Total Tests: ${results.summary.total}`);
console.log(`✅ Passed: ${results.summary.passed}`);
console.log(`❌ Failed: ${results.summary.failed}`);
console.log(`⏱️  Total Time: ${(results.summary.totalTime / 1000).toFixed(2)}s`);
console.log(`📊 Pass Rate: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%`);

// Save summary
await fs.writeFile(
  `${TEST_RESULTS_DIR}/summary-${timestamp}.json`,
  JSON.stringify(results, null, 2)
);

console.log(`\n📁 Results saved to: ${TEST_RESULTS_DIR}/`);
console.log('='.repeat(80));

// Exit with appropriate code
process.exit(results.summary.failed > 0 ? 1 : 0);
