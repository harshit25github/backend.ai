import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log("🧪 FLIGHT SPECIALIST AGENT - COMPREHENSIVE TESTING\n");
console.log("=" .repeat(80));
console.log("Testing Flight Agent with slot-first workflow, airport resolution, and conditional API calls\n");

const DATA_DIR = './data';
await fs.mkdir(DATA_DIR, { recursive: true });

let allLogs = [];
let testResults = [];
let chatIdCounter = 2000;

function log(message, save = true) {
  console.log(message);
  if (save) {
    allLogs.push(message);
  }
}

async function runTestTurn(testName, turnNumber, message, chatId, conversationHistory, expectedBehavior) {
  log(`\n🔹 TURN ${turnNumber}: ${message}`);
  log("-".repeat(80));
  log(`Expected: ${expectedBehavior}`);

  const startTime = Date.now();

  try {
    const updatedHistory = [...conversationHistory, { role: 'user', content: message }];
    const result = await runMultiAgentSystem(message, chatId, updatedHistory, false);
    const duration = Date.now() - startTime;

    const output = Array.isArray(result.finalOutput)
      ? result.finalOutput.map(String).join('\n')
      : String(result.finalOutput ?? '');

    log(`\n✅ Last Agent: ${result.lastAgent}`);
    log(`⏱️  Response Time: ${(duration / 1000).toFixed(2)}s`);
    log("\n📝 Agent Response (first 800 chars):");
    log(output.length > 800 ? output.substring(0, 800) + "\n... (truncated) ..." : output);

    const newHistory = [...updatedHistory, { role: 'assistant', content: output }];

    return {
      success: true,
      output: output || '',
      context: result.context,
      lastAgent: result.lastAgent,
      conversationHistory: newHistory,
      duration
    };
  } catch (error) {
    log(`\n❌ Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      output: '',
      context: null,
      conversationHistory,
      duration: Date.now() - startTime
    };
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function countFlightSlots(context) {
  const flights = context?.flights || {};
  const summary = context?.summary || {};

  const slots = {
    origin_city: !!(summary.origin?.city),
    destination_city: !!(summary.destination?.city),
    origin_iata: !!(flights.resolvedOrigin?.airportIATA),
    dest_iata: !!(flights.resolvedDestination?.airportIATA),
    outbound_date: !!summary.outbound_date,
    return_date: flights.tripType === 'roundtrip' ? !!summary.return_date : true, // not required for oneway
    pax: !!(summary.pax && summary.pax > 0),
    cabin_class: !!flights.cabinClass,
    trip_type: !!flights.tripType
  };

  return {
    slots,
    filled: Object.values(slots).filter(Boolean).length,
    total: 9,
    citiesFilled: slots.origin_city && slots.destination_city,
    iataFilled: slots.origin_iata && slots.dest_iata,
    allFilled: Object.values(slots).every(Boolean)
  };
}

function hasAirportResolution(output) {
  return /airport|IATA|nearest|TIR|Tirupati|DEL|Delhi/i.test(output);
}

function hasFlightResults(output) {
  const hasFlightPattern = /flight.*option|option.*\d+:|✈️.*flight/i.test(output);
  const hasPricing = /₹\s*\d{1,3}(,\d{3})*|INR|price|fare/i.test(output);
  const hasBookingLink = /cheapoair|book now|booking link/i.test(output);

  return {
    result: hasFlightPattern && (hasPricing || hasBookingLink),
    hasPattern: hasFlightPattern,
    hasPricing,
    hasBookingLink
  };
}

function hasSlotFillingQuestions(output) {
  return /where.*flying from|where.*headed|what dates|how many passengers|how many people|economy|business|first class|one-way|round-trip|cabin class/i.test(output);
}

function apiWasCalled(context) {
  const results = context?.flights?.searchResults || [];
  const status = context?.flights?.bookingStatus;
  return results.length > 0 && (status === 'results_shown' || status === 'searching');
}

// ============================================================================
// TEST SUITE 1: Progressive Slot Filling (No Airport at Origin)
// ============================================================================
async function testProgressiveSlotFillingNoAirport() {
  log("\n\n📋 TEST SUITE 1: Progressive Slot Filling - City Without Airport");
  log("=" .repeat(80));
  log("Scenario: User from Nellore (no airport) → Progressive gathering → Web search → API call\n");

  const chatId = `test-flight-${chatIdCounter++}`;
  let history = [];

  // Turn 1: Initial vague request
  const turn1 = await runTestTurn(
    "Suite 1",
    1,
    "I need to find flights to Goa",
    chatId,
    history,
    "Should ask for origin, dates, pax, cabin class, trip type. NO API call yet"
  );
  history = turn1.conversationHistory;

  const slots1 = countFlightSlots(turn1.context);
  const apiCalled1 = apiWasCalled(turn1.context);
  log(`\n📊 Slots: ${slots1.filled}/9 | API Called: ${apiCalled1 ? '❌ YES' : '✅ NO'}`);

  testResults.push({
    suite: 1,
    turn: 1,
    scenario: 'initial-vague',
    slotsFilled: slots1.filled,
    passed: !apiCalled1 && hasSlotFillingQuestions(turn1.output),
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 2: Provide origin (Nellore - no airport)
  const turn2 = await runTestTurn(
    "Suite 1",
    2,
    "From Nellore, on Dec 15 returning Dec 20, 2 passengers",
    chatId,
    history,
    "Should capture origin/dates/pax, still missing IATA codes. Should ask for cabin class/trip type"
  );
  history = turn2.conversationHistory;

  const slots2 = countFlightSlots(turn2.context);
  const apiCalled2 = apiWasCalled(turn2.context);
  const hasNellore = turn2.context?.summary?.origin?.city?.toLowerCase().includes('nellore');
  log(`\n📊 Slots: ${slots2.filled}/9 | Origin=Nellore: ${hasNellore ? '✅ YES' : '❌ NO'} | API Called: ${apiCalled2 ? '❌ YES' : '✅ NO'}`);

  testResults.push({
    suite: 1,
    turn: 2,
    slotsFilled: slots2.filled,
    passed: !apiCalled2 && hasNellore && slots2.filled >= 3,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 3: Provide cabin class and trip type
  const turn3 = await runTestTurn(
    "Suite 1",
    3,
    "Economy class, round trip please",
    chatId,
    history,
    "Should capture cabin/trip type. Still missing IATA codes. Should use web_search OR inform about airport resolution"
  );
  history = turn3.conversationHistory;

  const slots3 = countFlightSlots(turn3.context);
  const apiCalled3 = apiWasCalled(turn3.context);
  const hasAirportMention = hasAirportResolution(turn3.output);

  log(`\n📊 Slots: ${slots3.filled}/9 | Cities filled: ${slots3.citiesFilled ? '✅' : '❌'} | IATAs filled: ${slots3.iataFilled ? '✅' : '❌'}`);
  log(`   Airport resolution mentioned: ${hasAirportMention ? '✅ YES' : '❌ NO'}`);
  log(`   API Called: ${apiCalled3 ? '✅ YES (expected if IATAs resolved)' : '❌ NO (expected if IATAs not resolved)'}`);

  testResults.push({
    suite: 1,
    turn: 3,
    slotsFilled: slots3.filled,
    passed: slots3.citiesFilled && slots3.filled >= 7,
    critical: true,
    notes: 'Should have all info except IATA codes (requires web_search)'
  });

  return { suite: 1, chatId, finalContext: turn3.context };
}

// ============================================================================
// TEST SUITE 2: Complete Info at Once (with Airport Resolution)
// ============================================================================
async function testCompleteInfoAtOnce() {
  log("\n\n📋 TEST SUITE 2: Complete Info at Once (Cities with Airports)");
  log("=" .repeat(80));
  log("Scenario: User provides all info upfront, major cities with airports\n");

  const chatId = `test-flight-${chatIdCounter++}`;

  const turn1 = await runTestTurn(
    "Suite 2",
    1,
    "Find flights from Delhi to Mumbai on Jan 10, returning Jan 15, 2 passengers, economy, round trip",
    chatId,
    [],
    "Should capture all info, resolve airports (DEL, BOM), call API if IATAs resolved"
  );

  const slots1 = countFlightSlots(turn1.context);
  const apiCalled1 = apiWasCalled(turn1.context);
  const hasResults = hasFlightResults(turn1.output);

  log(`\n📊 Slots: ${slots1.filled}/9 | All filled: ${slots1.allFilled ? '✅ YES' : '❌ NO'}`);
  log(`   API Called: ${apiCalled1 ? '✅ YES' : '❌ NO'}`);
  log(`   Has flight results: ${hasResults.result ? '✅ YES' : '❌ NO'}`);
  log(`   Has booking link: ${hasResults.hasBookingLink ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    suite: 2,
    turn: 1,
    slotsFilled: slots1.filled,
    passed: slots1.allFilled && (apiCalled1 || hasResults.hasBookingLink),
    critical: true,
    notes: 'All info provided upfront - should resolve and call API'
  });

  return { suite: 2, chatId, finalContext: turn1.context };
}

// ============================================================================
// TEST SUITE 3: One-Way Trip
// ============================================================================
async function testOneWayTrip() {
  log("\n\n📋 TEST SUITE 3: One-Way Trip");
  log("=" .repeat(80));
  log("Scenario: User wants one-way flight, no return date\n");

  const chatId = `test-flight-${chatIdCounter++}`;
  let history = [];

  const turn1 = await runTestTurn(
    "Suite 3",
    1,
    "One way flight from Bangalore to Goa on Feb 5, 1 passenger, business class",
    chatId,
    history,
    "Should capture all info, trip_type=oneway, no return_date needed"
  );
  history = turn1.conversationHistory;

  const slots1 = countFlightSlots(turn1.context);
  const tripType = turn1.context?.flights?.tripType;
  const hasReturnDate = !!turn1.context?.summary?.return_date;
  const apiCalled1 = apiWasCalled(turn1.context);

  log(`\n📊 Slots: ${slots1.filled}/9 | Trip Type: ${tripType}`);
  log(`   Has return date: ${hasReturnDate ? '❌ YES (wrong for oneway)' : '✅ NO (correct)'}`);
  log(`   API Called: ${apiCalled1 ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    suite: 3,
    turn: 1,
    passed: tripType === 'oneway' && !hasReturnDate && slots1.filled >= 7,
    critical: true
  });

  return { suite: 3, chatId };
}

// ============================================================================
// TEST SUITE 4: Different Cabin Classes
// ============================================================================
async function testDifferentCabinClasses() {
  log("\n\n📋 TEST SUITE 4: Different Cabin Classes");
  log("=" .repeat(80));
  log("Scenario: Test all cabin class options\n");

  const classes = ['economy', 'premium_economy', 'business', 'first'];
  const results = [];

  for (const cabinClass of classes) {
    const chatId = `test-flight-${chatIdCounter++}`;

    const turn = await runTestTurn(
      "Suite 4",
      classes.indexOf(cabinClass) + 1,
      `Flights from Chennai to Hyderabad on March 20, 1 passenger, ${cabinClass.replace('_', ' ')}, one way`,
      chatId,
      [],
      `Should capture cabin_class=${cabinClass}`
    );

    const capturedClass = turn.context?.flights?.cabinClass;
    const matches = capturedClass === cabinClass;

    log(`\n📊 Cabin Class: ${cabinClass} | Captured: ${capturedClass} | Match: ${matches ? '✅' : '❌'}`);

    testResults.push({
      suite: 4,
      case: cabinClass,
      passed: matches,
      critical: false
    });

    results.push({ cabinClass, captured: capturedClass, matches });

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  return { suite: 4, results };
}

// ============================================================================
// TEST SUITE 5: Ambiguous Dates Resolution
// ============================================================================
async function testAmbiguousDates() {
  log("\n\n📋 TEST SUITE 5: Ambiguous Date Resolution");
  log("=" .repeat(80));
  log("Scenario: User provides relative/ambiguous dates\n");

  const chatId = `test-flight-${chatIdCounter++}`;
  let history = [];

  const turn1 = await runTestTurn(
    "Suite 5",
    1,
    "Flights to Dubai next month for 5 days",
    chatId,
    history,
    "Should interpret 'next month' and '5 days duration', ask for specifics"
  );
  history = turn1.conversationHistory;

  const hasDuration = turn1.context?.summary?.duration_days === 5;
  const asksForSpecificDates = /specific date|which date|what date|when exactly/i.test(turn1.output);

  log(`\n📊 Duration captured: ${hasDuration ? '✅ 5 days' : '❌ Not captured'}`);
  log(`   Asks for specific dates: ${asksForSpecificDates ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    suite: 5,
    turn: 1,
    passed: asksForSpecificDates,
    critical: false,
    notes: 'Should ask for specific dates when given relative time'
  });

  return { suite: 5, chatId };
}

// ============================================================================
// TEST SUITE 6: Error Handling - Missing Critical Info
// ============================================================================
async function testErrorHandlingMissingInfo() {
  log("\n\n📋 TEST SUITE 6: Error Handling - Missing Critical Info");
  log("=" .repeat(80));
  log("Scenario: Test that API is NOT called when info is missing\n");

  const testCases = [
    { msg: "Find flights to Goa", missing: ['origin', 'dates', 'pax', 'cabin_class'] },
    { msg: "From Delhi on Jan 10", missing: ['destination', 'pax', 'cabin_class'] },
    { msg: "2 passengers to Mumbai", missing: ['origin', 'dates', 'cabin_class'] }
  ];

  for (let i = 0; i < testCases.length; i++) {
    const chatId = `test-flight-${chatIdCounter++}`;
    const testCase = testCases[i];

    const turn = await runTestTurn(
      "Suite 6",
      i + 1,
      testCase.msg,
      chatId,
      [],
      `Should NOT call API, missing: ${testCase.missing.join(', ')}`
    );

    const apiCalled = apiWasCalled(turn.context);
    const asksQuestions = hasSlotFillingQuestions(turn.output);

    log(`\n📊 API Called: ${apiCalled ? '❌ YES (ERROR!)' : '✅ NO (correct)'}`);
    log(`   Asks for missing info: ${asksQuestions ? '✅ YES' : '❌ NO'}`);

    testResults.push({
      suite: 6,
      case: i + 1,
      passed: !apiCalled && asksQuestions,
      critical: true,
      notes: `Missing: ${testCase.missing.join(', ')}`
    });

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  return { suite: 6 };
}

// ============================================================================
// TEST SUITE 7: Routing - Ensure Gateway Routes to Flight Agent
// ============================================================================
async function testGatewayRouting() {
  log("\n\n📋 TEST SUITE 7: Gateway Routing to Flight Specialist");
  log("=" .repeat(80));
  log("Scenario: Ensure flight queries route to Flight Specialist Agent\n");

  const flightQueries = [
    "Find flights to Paris",
    "Search for flights from Mumbai to Dubai",
    "Show me flight options",
    "I need to book a flight",
    "What are the flight prices to London?"
  ];

  let routedCorrectly = 0;

  for (let i = 0; i < flightQueries.length; i++) {
    const chatId = `test-flight-${chatIdCounter++}`;

    const turn = await runTestTurn(
      "Suite 7",
      i + 1,
      flightQueries[i],
      chatId,
      [],
      "Should route to Flight Specialist Agent"
    );

    const routedToFlightAgent = turn.lastAgent === 'Flight Specialist Agent';

    log(`\n📊 Routed to: ${turn.lastAgent} | Correct: ${routedToFlightAgent ? '✅ YES' : '❌ NO'}`);

    if (routedToFlightAgent) routedCorrectly++;

    testResults.push({
      suite: 7,
      query: flightQueries[i],
      passed: routedToFlightAgent,
      critical: true
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  log(`\n📊 Total: ${routedCorrectly}/${flightQueries.length} routed correctly`);

  return { suite: 7, correctRouting: routedCorrectly, total: flightQueries.length };
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================
async function runAllTests() {
  const startTime = Date.now();

  try {
    log("\n🚀 Starting Flight Specialist Agent Comprehensive Tests");
    log("Testing slot-first workflow, airport resolution, and conditional API calls...\n");

    const suite1 = await testProgressiveSlotFillingNoAirport();
    const suite2 = await testCompleteInfoAtOnce();
    const suite3 = await testOneWayTrip();
    const suite4 = await testDifferentCabinClasses();
    const suite5 = await testAmbiguousDates();
    const suite6 = await testErrorHandlingMissingInfo();
    const suite7 = await testGatewayRouting();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    log("\n\n" + "=".repeat(80));
    log("✨ ALL TESTS COMPLETED");
    log("=".repeat(80));
    log(`\n⏱️  Total Time: ${duration} seconds (${(duration / 60).toFixed(1)} minutes)`);

    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = ((passedTests / totalTests) * 100).toFixed(1);

    const criticalTests = testResults.filter(t => t.critical);
    const criticalPassed = criticalTests.filter(t => t.passed).length;
    const criticalRate = ((criticalPassed / criticalTests.length) * 100).toFixed(1);

    log(`\n📊 Test Summary:`);
    log(`  Total Tests: ${totalTests}`);
    log(`  Passed: ${passedTests} ✅`);
    log(`  Failed: ${failedTests} ❌`);
    log(`  Pass Rate: ${passRate}%`);

    log(`\n🔴 CRITICAL Tests:`);
    log(`  Total: ${criticalTests.length}`);
    log(`  Passed: ${criticalPassed} ✅`);
    log(`  Failed: ${criticalTests.length - criticalPassed} ❌`);
    log(`  Pass Rate: ${criticalRate}%`);

    log(`\n📋 Test Suites:`);
    log(`  1. ✓ Progressive Slot Filling (No Airport) - 3 turns`);
    log(`  2. ✓ Complete Info at Once (Major Cities) - 1 turn`);
    log(`  3. ✓ One-Way Trip - 1 turn`);
    log(`  4. ✓ Different Cabin Classes - 4 cases`);
    log(`  5. ✓ Ambiguous Dates - 1 turn`);
    log(`  6. ✓ Error Handling (Missing Info) - 3 cases`);
    log(`  7. ✓ Gateway Routing - 5 queries`);

    const failedCritical = criticalTests.filter(t => !t.passed);
    if (failedCritical.length > 0) {
      log(`\n⚠️  FAILED CRITICAL TESTS:`);
      failedCritical.forEach(t => {
        log(`  ❌ Suite ${t.suite}, Turn/Case ${t.turn || t.case || t.query}: ${t.notes || ''}`);
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFilePath = path.join(DATA_DIR, `flight-agent-test-${timestamp}.log`);
    await fs.writeFile(logFilePath, allLogs.join('\n'), 'utf-8');
    log(`\n💾 Logs saved to: ${logFilePath}`);

    const resultsFilePath = path.join(DATA_DIR, `flight-agent-results-${timestamp}.json`);
    await fs.writeFile(resultsFilePath, JSON.stringify({
      timestamp: new Date().toISOString(),
      duration,
      totalTests,
      passedTests,
      failedTests,
      passRate,
      criticalTests: {
        total: criticalTests.length,
        passed: criticalPassed,
        failed: criticalTests.length - criticalPassed,
        passRate: criticalRate
      },
      testResults,
      suites: [
        { id: 1, name: 'Progressive Slot Filling (No Airport)', context: suite1.finalContext },
        { id: 2, name: 'Complete Info at Once', context: suite2.finalContext },
        { id: 3, name: 'One-Way Trip' },
        { id: 4, name: 'Different Cabin Classes', results: suite4.results },
        { id: 5, name: 'Ambiguous Dates' },
        { id: 6, name: 'Error Handling (Missing Info)' },
        { id: 7, name: 'Gateway Routing', routing: suite7 }
      ]
    }, null, 2), 'utf-8');
    log(`💾 Results saved to: ${resultsFilePath}`);

    log("\n" + "=".repeat(80));
    if (criticalRate >= 95) {
      log("🎉 EXCELLENT! Flight Specialist Agent is working perfectly!");
    } else if (criticalRate >= 85) {
      log("✅ VERY GOOD! Minor edge cases may need attention.");
    } else if (criticalRate >= 70) {
      log("⚠️  GOOD but needs improvements.");
    } else {
      log("❌ CRITICAL ISSUES! Needs fixes.");
    }
    log("=".repeat(80) + "\n");

  } catch (error) {
    log("\n\n❌ TESTS FAILED WITH ERROR:");
    log(error.message);
    log(error.stack);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const errorLogPath = path.join(DATA_DIR, `flight-agent-error-${timestamp}.log`);
    await fs.writeFile(errorLogPath, allLogs.join('\n') + '\n\nERROR:\n' + error.stack, 'utf-8');
    log(`\n💾 Error log saved to: ${errorLogPath}`);
  }
}

runAllTests().catch(console.error);
