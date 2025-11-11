/**
 * K6 Baseline Scenarios - Individual Test Cases
 *
 * Purpose: Test specific scenarios one at a time for detailed baseline
 * Run these BEFORE optimization to establish baseline metrics
 *
 * Usage:
 * k6 run tests/k6-baseline-scenarios.js -e SCENARIO=trip_planning
 * k6 run tests/k6-baseline-scenarios.js -e SCENARIO=flight_search
 * k6 run tests/k6-baseline-scenarios.js -e SCENARIO=modification
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_ENDPOINT = `${BASE_URL}/api/chat/message`;
const SCENARIO = __ENV.SCENARIO || 'trip_planning'; // Default scenario

// Single user test for baseline
export const options = {
  vus: 1,
  iterations: 5, // Run 5 times to get average
  thresholds: {
    http_req_duration: ['p(95)<20000'], // Should complete in under 20s
  },
};

// ============================================================================
// DETAILED METRICS
// ============================================================================

const metrics = {
  // Overall metrics
  total_duration: new Trend('total_scenario_duration'),

  // Per-step metrics
  step1_duration: new Trend('step1_duration'),
  step2_duration: new Trend('step2_duration'),
  step3_duration: new Trend('step3_duration'),

  // Response quality
  response_length: new Trend('response_length_chars'),
  context_size: new Trend('context_size_bytes'),

  // Business metrics
  itinerary_days: new Trend('itinerary_days_generated'),
  flight_results: new Trend('flight_results_count'),
  suggested_questions: new Trend('suggested_questions_count'),
};

// ============================================================================
// TEST SCENARIOS
// ============================================================================

const SCENARIOS = {
  // 1. TRIP PLANNING - Full workflow from scratch
  trip_planning: {
    name: 'Trip Planning - Full Workflow',
    description: 'Tests complete trip planning from initial request to itinerary generation',
    steps: [
      {
        name: 'Initial Request',
        message: 'I want to plan a 5-day trip to Paris from Mumbai',
        expectations: {
          agent: 'Trip Planner Agent',
          hasResponse: true,
          shouldAskForDetails: true
        }
      },
      {
        name: 'Provide Details',
        message: 'March 15-20, 2026, 2 adults, budget ₹1.5 lakh per person, interested in culture and food',
        expectations: {
          agent: 'Trip Planner Agent',
          summaryUpdated: true,
          placesOfInterest: true,
          suggestedQuestions: true
        }
      },
      {
        name: 'Confirm and Generate',
        message: 'Yes, create the detailed day-by-day itinerary',
        expectations: {
          agent: 'Trip Planner Agent',
          itineraryGenerated: true,
          itineraryDays: 5,
          hasBudgetBreakdown: true
        }
      }
    ]
  },

  // 2. FLIGHT SEARCH
  flight_search: {
    name: 'Flight Search - Full Workflow',
    description: 'Tests flight search with IATA code resolution and results presentation',
    steps: [
      {
        name: 'Initial Flight Request',
        message: 'Find me flights from Delhi to Mumbai',
        expectations: {
          agent: 'Flight Specialist Agent',
          hasResponse: true
        }
      },
      {
        name: 'Provide Flight Details',
        message: 'January 20, 2026, returning January 25, 2 passengers, economy class',
        expectations: {
          agent: 'Flight Specialist Agent',
          flightResults: true,
          hasDeeplink: true,
          resultsCount: 3 // Expect at least 3 options
        }
      }
    ]
  },

  // 3. MODIFICATION - Tests predicted outputs capability (baseline for comparison)
  modification: {
    name: 'Trip Modification',
    description: 'Tests modification of existing itinerary (baseline for predicted outputs)',
    steps: [
      {
        name: 'Create Initial Trip',
        message: 'Plan a 5-day trip to Goa from Bangalore for 2 people',
        expectations: {
          agent: 'Trip Planner Agent'
        }
      },
      {
        name: 'Confirm Initial',
        message: 'Yes, create the itinerary',
        expectations: {
          agent: 'Trip Planner Agent',
          itineraryGenerated: true,
          itineraryDays: 5
        }
      },
      {
        name: 'Request Modification',
        message: 'Change it to 3 days instead of 5',
        expectations: {
          agent: 'Trip Planner Agent',
          itineraryGenerated: true,
          itineraryDays: 3,
          isModification: true
        }
      }
    ]
  },

  // 4. HOTEL SEARCH
  hotel_search: {
    name: 'Hotel Search',
    description: 'Tests hotel search and recommendations',
    steps: [
      {
        name: 'Hotel Request',
        message: 'Show me hotels in Dubai near Burj Khalifa',
        expectations: {
          agent: 'Hotel Specialist Agent',
          hasResponse: true
        }
      },
      {
        name: 'Provide Details',
        message: 'December 15-20, 2 adults, budget $200-300 per night',
        expectations: {
          agent: 'Hotel Specialist Agent',
          hasRecommendations: true
        }
      }
    ]
  },

  // 5. QUICK QUESTION - Tests gateway routing
  quick_question: {
    name: 'Quick Question',
    description: 'Tests simple question handling and gateway routing',
    steps: [
      {
        name: 'Simple Question',
        message: 'What is the best time to visit Switzerland?',
        expectations: {
          agent: 'Trip Planner Agent',
          hasResponse: true,
          quickResponse: true // Should be faster
        }
      }
    ]
  },

  // 6. VAGUE DESTINATION - Tests destination resolution
  vague_destination: {
    name: 'Vague Destination Handling',
    description: 'Tests how agent handles vague location requests',
    steps: [
      {
        name: 'Vague Request',
        message: 'I want to visit a sanctuary near me',
        expectations: {
          agent: 'Trip Planner Agent',
          shouldAskLocation: true
        }
      },
      {
        name: 'Provide Location',
        message: 'I am in Delhi',
        expectations: {
          agent: 'Trip Planner Agent',
          shouldProvideOptions: true,
          optionCount: 3 // Should suggest 3-4 options
        }
      },
      {
        name: 'Select Option',
        message: 'Jim Corbett sounds good, 2 days for 2 people',
        expectations: {
          agent: 'Trip Planner Agent',
          summaryUpdated: true
        }
      }
    ]
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateChatId() {
  return `baseline-${SCENARIO}-${Date.now()}-${__ITER}`;
}

function makeRequest(chatId, message, stepName) {
  const startTime = Date.now();

  const payload = JSON.stringify({
    chatId: chatId,
    message: message,
    role: 'user'
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
    tags: { step: stepName, scenario: SCENARIO }
  };

  const response = http.post(API_ENDPOINT, payload, params);
  const duration = Date.now() - startTime;

  let data = {};
  try {
    data = JSON.parse(response.body);
  } catch (e) {
    console.error(`Failed to parse response: ${e}`);
  }

  return { response, data, duration };
}

function validateExpectations(data, expectations, stepName) {
  const checks = {
    'status 200': data.response?.status === 200,
    'has response': !!data.data.response,
  };

  if (expectations.agent) {
    checks[`correct agent: ${expectations.agent}`] = data.data.lastAgent === expectations.agent;
  }

  if (expectations.itineraryGenerated) {
    const days = data.data.itinerary?.days?.length || 0;
    checks['itinerary generated'] = days > 0;

    if (expectations.itineraryDays) {
      checks[`has ${expectations.itineraryDays} days`] = days === expectations.itineraryDays;
    }

    metrics.itinerary_days.add(days);
  }

  if (expectations.flightResults) {
    const count = data.data.context?.flight?.searchResults?.length || 0;
    checks['flight results found'] = count > 0;
    metrics.flight_results.add(count);
  }

  if (expectations.suggestedQuestions) {
    const count = data.data.suggestedQuestions?.length || 0;
    metrics.suggested_questions.add(count);
  }

  // Measure response quality
  metrics.response_length.add(data.data.response?.length || 0);
  metrics.context_size.add(JSON.stringify(data.data.context || {}).length);

  const success = check(data.response, checks);

  // Log detailed results
  console.log(`\n[${stepName}] Duration: ${data.duration}ms`);
  console.log(`  Agent: ${data.data.lastAgent}`);
  console.log(`  Response length: ${data.data.response?.length || 0} chars`);
  console.log(`  Success: ${success ? '✓' : '✗'}`);

  if (expectations.itineraryGenerated) {
    console.log(`  Itinerary days: ${data.data.itinerary?.days?.length || 0}`);
  }
  if (expectations.flightResults) {
    console.log(`  Flight results: ${data.data.context?.flight?.searchResults?.length || 0}`);
  }

  return success;
}

// ============================================================================
// MAIN TEST FUNCTION
// ============================================================================

export default function () {
  const scenario = SCENARIOS[SCENARIO];

  if (!scenario) {
    console.error(`Unknown scenario: ${SCENARIO}`);
    console.log(`Available scenarios: ${Object.keys(SCENARIOS).join(', ')}`);
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`BASELINE TEST: ${scenario.name}`);
  console.log(`Iteration: ${__ITER + 1}/${options.iterations}`);
  console.log(`Description: ${scenario.description}`);
  console.log('='.repeat(60));

  const chatId = generateChatId();
  const scenarioStart = Date.now();
  let allSuccess = true;

  // Execute each step
  scenario.steps.forEach((step, index) => {
    console.log(`\n--- Step ${index + 1}/${scenario.steps.length}: ${step.name} ---`);

    const result = makeRequest(chatId, step.message, step.name);

    // Record step duration
    if (index === 0) metrics.step1_duration.add(result.duration);
    if (index === 1) metrics.step2_duration.add(result.duration);
    if (index === 2) metrics.step3_duration.add(result.duration);

    // Validate expectations
    const success = validateExpectations(result, step.expectations, step.name);
    allSuccess = allSuccess && success;

    // Small delay between steps
    sleep(0.5);
  });

  const totalDuration = Date.now() - scenarioStart;
  metrics.total_duration.add(totalDuration);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total Scenario Duration: ${totalDuration}ms`);
  console.log(`Overall Success: ${allSuccess ? '✓' : '✗'}`);
  console.log('='.repeat(60));

  sleep(1);
}

// ============================================================================
// CUSTOM SUMMARY
// ============================================================================

export function handleSummary(data) {
  console.log('\n' + '='.repeat(80));
  console.log(`BASELINE RESULTS: ${SCENARIOS[SCENARIO]?.name || SCENARIO}`);
  console.log('='.repeat(80));

  // Extract key metrics
  const summary = {
    scenario: SCENARIO,
    timestamp: new Date().toISOString(),
    iterations: options.iterations,
    metrics: {}
  };

  // Process metrics
  Object.keys(data.metrics).forEach(key => {
    const metric = data.metrics[key];
    if (metric.values) {
      summary.metrics[key] = {
        avg: metric.values.avg || 0,
        min: metric.values.min || 0,
        max: metric.values.max || 0,
        p95: metric.values['p(95)'] || 0,
        p99: metric.values['p(99)'] || 0
      };
    }
  });

  // Save to JSON for comparison
  const jsonOutput = JSON.stringify(summary, null, 2);

  // Print summary
  console.log('\nKEY METRICS:');
  console.log('-'.repeat(80));

  if (summary.metrics.total_scenario_duration) {
    console.log('\nTotal Duration:');
    console.log(`  Average: ${summary.metrics.total_scenario_duration.avg.toFixed(0)}ms`);
    console.log(`  P95: ${summary.metrics.total_scenario_duration.p95.toFixed(0)}ms`);
    console.log(`  P99: ${summary.metrics.total_scenario_duration.p99.toFixed(0)}ms`);
  }

  if (summary.metrics.step1_duration) {
    console.log('\nStep Durations:');
    console.log(`  Step 1: ${summary.metrics.step1_duration.avg.toFixed(0)}ms (avg)`);
    if (summary.metrics.step2_duration) {
      console.log(`  Step 2: ${summary.metrics.step2_duration.avg.toFixed(0)}ms (avg)`);
    }
    if (summary.metrics.step3_duration) {
      console.log(`  Step 3: ${summary.metrics.step3_duration.avg.toFixed(0)}ms (avg)`);
    }
  }

  if (summary.metrics.response_length_chars) {
    console.log('\nResponse Quality:');
    console.log(`  Avg Response Length: ${summary.metrics.response_length_chars.avg.toFixed(0)} chars`);
    console.log(`  Avg Context Size: ${summary.metrics.context_size_bytes.avg.toFixed(0)} bytes`);
  }

  if (summary.metrics.itinerary_days_generated) {
    console.log(`  Avg Itinerary Days: ${summary.metrics.itinerary_days_generated.avg.toFixed(1)}`);
  }

  if (summary.metrics.flight_results_count) {
    console.log(`  Avg Flight Results: ${summary.metrics.flight_results_count.avg.toFixed(1)}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('BASELINE SAVED TO: baseline-results/' + SCENARIO + '.json');
  console.log('='.repeat(80) + '\n');

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    [`baseline-results/${SCENARIO}.json`]: jsonOutput
  };
}
