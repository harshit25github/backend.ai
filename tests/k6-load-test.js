/**
 * K6 Load Testing Script for Multi-Agent Travel System
 *
 * Purpose: Baseline performance measurement before optimization
 * Metrics captured:
 * - Response time (p95, p99, avg)
 * - Token usage (input/output)
 * - Tool calls count
 * - Error rates
 * - Agent routing decisions
 *
 * Usage:
 * k6 run tests/k6-load-test.js
 * k6 run --vus 10 --duration 30s tests/k6-load-test.js  (load test)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_ENDPOINT = `${BASE_URL}/api/chat/message`;
const STREAM_ENDPOINT = `${BASE_URL}/api/chat/stream`;

// K6 Test Configuration - ADJUSTED FOR OPENAI RATE LIMITS
export const options = {
  // SEQUENTIAL TESTING (No concurrent users - respects rate limits)
  vus: 1,           // Only 1 virtual user at a time
  iterations: 3,    // Run 3 complete test cycles

  // If you need concurrent testing, use VERY slow ramp:
  // stages: [
  //   { duration: '2m', target: 2 },    // 2 users over 2 minutes (very slow!)
  //   { duration: '3m', target: 2 },    // Stay at 2 users
  //   { duration: '30s', target: 0 },   // Ramp down
  // ],

  thresholds: {
    http_req_duration: ['p(95)<20000'], // 95% of requests should be below 20s
    http_req_failed: ['rate<0.3'],      // Allow 30% errors (rate limiting)
  },
};

// ============================================================================
// CUSTOM METRICS
// ============================================================================

// Response time metrics
const tripPlannerResponseTime = new Trend('trip_planner_response_time');
const flightSpecialistResponseTime = new Trend('flight_specialist_response_time');
const hotelSpecialistResponseTime = new Trend('hotel_specialist_response_time');
const gatewayResponseTime = new Trend('gateway_response_time');

// Token usage metrics
const inputTokens = new Trend('input_tokens');
const outputTokens = new Trend('output_tokens');
const totalTokens = new Trend('total_tokens');

// Tool call metrics
const toolCallCount = new Counter('tool_calls_total');
const updateSummaryCalls = new Counter('update_summary_calls');
const updateItineraryCalls = new Counter('update_itinerary_calls');
const webSearchCalls = new Counter('web_search_calls');
const flightSearchCalls = new Counter('flight_search_calls');

// Quality metrics
const successRate = new Rate('success_rate');
const itineraryGenerated = new Rate('itinerary_generated_rate');
const flightResultsFound = new Rate('flight_results_found_rate');

// Agent routing metrics
const agentRoutingCount = new Counter('agent_routing_total');

// ============================================================================
// TEST SCENARIOS
// ============================================================================

// ============================================================================
// TRIP PLANNER AGENT SCENARIOS ONLY
// ============================================================================
const TEST_SCENARIOS = {
  // Scenario 1: New trip planning (full workflow)
  NEW_TRIP_PLANNING: [
    {
      message: "I want to plan a trip to Paris",
      expectedAgent: "Trip Planner Agent",
      scenario: "new_trip_planning_step1"
    },
    {
      message: "From Mumbai, 5 days in March, 2 people, budget ₹1.5L per person",
      expectedAgent: "Trip Planner Agent",
      scenario: "new_trip_planning_step2"
    },
    {
      message: "Yes, create the detailed itinerary",
      expectedAgent: "Trip Planner Agent",
      scenario: "new_trip_planning_step3",
      expectItinerary: true
    }
  ],

  // Scenario 2: Modification (tests predicted outputs when implemented)
  TRIP_MODIFICATION: [
    {
      message: "Plan a trip to Goa from Bangalore, 5 days, 2 people",
      expectedAgent: "Trip Planner Agent",
      scenario: "modification_setup"
    },
    {
      message: "Yes, create it",
      expectedAgent: "Trip Planner Agent",
      scenario: "modification_create",
      expectItinerary: true
    },
    {
      message: "Change it to 3 days instead of 5",
      expectedAgent: "Trip Planner Agent",
      scenario: "modification_request",
      expectItinerary: true,
      isModification: true
    }
  ],

  // Scenario 3: Quick question (simple query handling)
  QUICK_QUESTION: [
    {
      message: "What's the best time to visit Switzerland?",
      expectedAgent: "Trip Planner Agent",
      scenario: "quick_question"
    }
  ],

  // Scenario 4: Vague destination handling
  VAGUE_DESTINATION: [
    {
      message: "I want to visit a hill station near me",
      expectedAgent: "Trip Planner Agent",
      scenario: "vague_destination_step1"
    },
    {
      message: "I'm from Delhi",
      expectedAgent: "Trip Planner Agent",
      scenario: "vague_destination_step2"
    }
  ]
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique chat ID for each virtual user
 */
function generateChatId() {
  return `k6-test-${__VU}-${Date.now()}`;
}

/**
 * Make API request and capture metrics
 */
function makeRequest(chatId, message, expectedAgent, scenario, expectations = {}) {
  const startTime = Date.now();

  const payload = JSON.stringify({
    chatId: chatId,
    message: message,
    role: 'user'
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: {
      scenario: scenario,
      expected_agent: expectedAgent
    }
  };

  const response = http.post(API_ENDPOINT, payload, params);
  const duration = Date.now() - startTime;

  // Parse response
  let responseData = {};
  try {
    responseData = JSON.parse(response.body);
  } catch (e) {
    console.error(`Failed to parse response for scenario ${scenario}:`, e);
  }

  // Basic checks
  const checks = {
    'status is 200': response.status === 200,
    'has response': responseData.response !== undefined,
    'has context': responseData.context !== undefined,
  };

  // Agent-specific checks
  if (expectedAgent) {
    checks['correct agent'] = responseData.lastAgent === expectedAgent;
  }

  // Scenario-specific expectations
  if (expectations.expectItinerary) {
    checks['itinerary generated'] = responseData.itinerary?.days?.length > 0;
    if (responseData.itinerary?.days?.length > 0) {
      itineraryGenerated.add(1);
    } else {
      itineraryGenerated.add(0);
    }
  }

  if (expectations.expectFlights) {
    checks['flight results found'] = responseData.context?.flight?.searchResults?.length > 0;
    if (responseData.context?.flight?.searchResults?.length > 0) {
      flightResultsFound.add(1);
    } else {
      flightResultsFound.add(0);
    }
  }

  const success = check(response, checks);
  successRate.add(success);

  // Record response time by agent type
  if (responseData.lastAgent) {
    agentRoutingCount.add(1, { agent: responseData.lastAgent });

    switch (responseData.lastAgent) {
      case 'Trip Planner Agent':
        tripPlannerResponseTime.add(duration);
        break;
      case 'Flight Specialist Agent':
        flightSpecialistResponseTime.add(duration);
        break;
      case 'Hotel Specialist Agent':
        hotelSpecialistResponseTime.add(duration);
        break;
      case 'Gateway Agent':
        gatewayResponseTime.add(duration);
        break;
    }
  }

  // Estimate token usage (rough estimation based on response length)
  // In production, you'd get this from OpenAI response headers or logging
  const estimatedInputTokens = Math.ceil(message.length / 4);
  const estimatedOutputTokens = Math.ceil((responseData.response?.length || 0) / 4);

  inputTokens.add(estimatedInputTokens);
  outputTokens.add(estimatedOutputTokens);
  totalTokens.add(estimatedInputTokens + estimatedOutputTokens);

  // Count tool calls (estimate from context changes)
  // In production, instrument this in your backend
  if (responseData.context?.summary) {
    updateSummaryCalls.add(1);
  }
  if (responseData.itinerary?.days?.length > 0) {
    updateItineraryCalls.add(1);
  }

  // Log details for debugging
  if (!success || response.status !== 200) {
    console.error(`[${scenario}] Failed:`, {
      status: response.status,
      agent: responseData.lastAgent,
      hasResponse: !!responseData.response,
      error: responseData.error
    });
  }

  return {
    success,
    duration,
    response: responseData
  };
}

/**
 * Run a complete scenario
 */
function runScenario(scenarioName, steps) {
  const chatId = generateChatId();
  const results = [];

  console.log(`\n[VU ${__VU}] Starting scenario: ${scenarioName}`);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    console.log(`[VU ${__VU}] Step ${i + 1}/${steps.length}: ${step.scenario}`);

    const result = makeRequest(
      chatId,
      step.message,
      step.expectedAgent,
      step.scenario,
      {
        expectItinerary: step.expectItinerary || false,
        expectFlights: step.expectFlights || false,
        isModification: step.isModification || false
      }
    );

    results.push(result);

    // Small delay between steps to simulate real user behavior
    sleep(1);
  }

  console.log(`[VU ${__VU}] Completed scenario: ${scenarioName}`);
  return results;
}

// ============================================================================
// MAIN TEST FUNCTION
// ============================================================================

export default function () {
  // Randomly select a scenario to simulate varied user behavior
  const scenarioKeys = Object.keys(TEST_SCENARIOS);
  const randomScenario = scenarioKeys[Math.floor(Math.random() * scenarioKeys.length)];
  const scenarioSteps = TEST_SCENARIOS[randomScenario];

  // Run the scenario
  runScenario(randomScenario, scenarioSteps);

  // Wait before next iteration
  sleep(2);
}

// ============================================================================
// TEARDOWN
// ============================================================================

export function teardown(data) {
  console.log('\n========================================');
  console.log('K6 Load Test Completed');
  console.log('========================================');
  console.log('Check the summary metrics above for:');
  console.log('- Response times (p95, p99)');
  console.log('- Success rates');
  console.log('- Token usage estimates');
  console.log('- Agent routing distribution');
  console.log('========================================\n');
}

// ============================================================================
// EXPORT SCENARIOS FOR INDIVIDUAL TESTING
// ============================================================================

export { TEST_SCENARIOS };
