import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log("🧪 HANDOFF APPROACH - SLOT-FIRST WORKFLOW TESTING\n");
console.log("=" .repeat(80));
console.log("Testing Trip Planner Agent with slot-first workflow\n");

const DATA_DIR = './data';
await fs.mkdir(DATA_DIR, { recursive: true });

let allLogs = [];
let testResults = [];
let chatIdCounter = 1000;

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
    // Add current message to history
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

    // Update conversation history with assistant response
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

// Validation helpers
function hasDestinationSuggestions(output) {
  if (!output) return { result: false, count: 0 };

  const hasHeaders = /##\s+[A-Z][a-z]+,\s+[A-Z]/m.test(output);
  const hasLandmarks = /📍\s+Must-see highlights?:/i.test(output);
  const hasMultiple = (output.match(/##\s+[A-Z][a-z]+,/g) || []).length >= 2;

  return {
    result: hasHeaders && hasLandmarks && hasMultiple,
    count: (output.match(/##\s+[A-Z][a-z]+,/g) || []).length
  };
}

function countFilledSlots(context) {
  const summary = context?.summary || {};
  const slots = {
    budget: !!(summary.budget?.amount && summary.budget.amount > 0),
    duration: !!(summary.duration_days && summary.duration_days > 0) ||
              !!(summary.outbound_date && summary.return_date),
    pax: !!(summary.pax && summary.pax > 0),
    origin: !!(summary.origin?.city && summary.origin.city.length > 0),
    tripTypes: !!(summary.tripTypes && summary.tripTypes.length > 0)
  };

  return {
    slots,
    filled: Object.values(slots).filter(Boolean).length,
    total: 5
  };
}

function hasSlotFillingQuestions(output) {
  return /where.*traveling from|where are you|what.*budget|how much.*budget|how many days|how long|how many travelers|how many people|what type|what kind|preferences|interested in|experience.*looking/i.test(output);
}

// ============================================================================
// TEST SUITE 1: Type A - Vague Destination (Progressive Slot Filling)
// ============================================================================
async function testTypeAVagueDestination() {
  log("\n\n📋 TEST SUITE 1: Type A - Vague Destination (Progressive Slot Filling)");
  log("=" .repeat(80));
  log("Scenario: User doesn't know where to go → Gather all slots → Show suggestions → Create itinerary\n");

  const chatId = `test-${chatIdCounter++}`;
  let history = [];

  // Turn 1: Completely vague
  const turn1 = await runTestTurn(
    "Suite 1",
    1,
    "I want to go somewhere for vacation",
    chatId,
    history,
    "Should ask for ALL 5 slots (origin, budget, duration, pax, tripTypes), NO destinations"
  );
  history = turn1.conversationHistory;

  const slots1 = countFilledSlots(turn1.context);
  const dest1 = hasDestinationSuggestions(turn1.output);
  log(`\n📊 Slots: ${slots1.filled}/5 | Destinations: ${dest1.result ? '❌ YES' : '✅ NO'}`);

  testResults.push({
    suite: 1,
    turn: 1,
    scenario: 'vague-initial',
    slotsFilled: slots1.filled,
    passed: !dest1.result && hasSlotFillingQuestions(turn1.output),
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 2: Provide budget + duration
  const turn2 = await runTestTurn(
    "Suite 1",
    2,
    "I have around ₹60000 budget for 5 days",
    chatId,
    history,
    "Should capture budget+duration, ask for origin, pax, tripTypes, NO destinations"
  );
  history = turn2.conversationHistory;

  const slots2 = countFilledSlots(turn2.context);
  const dest2 = hasDestinationSuggestions(turn2.output);
  log(`\n📊 Slots: ${slots2.filled}/5 | Destinations: ${dest2.result ? '❌ YES' : '✅ NO'}`);

  testResults.push({
    suite: 1,
    turn: 2,
    slotsFilled: slots2.filled,
    passed: !dest2.result && slots2.filled >= 2,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 3: Provide origin + pax
  const turn3 = await runTestTurn(
    "Suite 1",
    3,
    "From Mumbai, 2 people",
    chatId,
    history,
    "Should capture origin+pax, ask for tripTypes only, NO destinations"
  );
  history = turn3.conversationHistory;

  const slots3 = countFilledSlots(turn3.context);
  const dest3 = hasDestinationSuggestions(turn3.output);
  log(`\n📊 Slots: ${slots3.filled}/5 | Destinations: ${dest3.result ? '❌ YES' : '✅ NO'}`);

  testResults.push({
    suite: 1,
    turn: 3,
    slotsFilled: slots3.filled,
    passed: !dest3.result && slots3.filled >= 4,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 4: Provide tripTypes (final slot!)
  const turn4 = await runTestTurn(
    "Suite 1",
    4,
    "We love beaches and adventure",
    chatId,
    history,
    "ALL 5 slots filled → Should NOW show 4-7 destination suggestions!"
  );
  history = turn4.conversationHistory;

  const slots4 = countFilledSlots(turn4.context);
  const dest4 = hasDestinationSuggestions(turn4.output);
  log(`\n📊 Slots: ${slots4.filled}/5 | Destinations: ${dest4.result ? '✅ YES' : '❌ NO'}`);
  log(`   Destination count: ${dest4.count}`);

  testResults.push({
    suite: 1,
    turn: 4,
    slotsFilled: slots4.filled,
    passed: dest4.result && slots4.filled === 5 && dest4.count >= 4,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 5: User picks destination
  const turn5 = await runTestTurn(
    "Suite 1",
    5,
    "I like the first option, let's go with that",
    chatId,
    history,
    "Should confirm destination choice, ask to create itinerary"
  );
  history = turn5.conversationHistory;

  const hasConfirmation = /confirm|create|itinerary|day-by-day/i.test(turn5.output);
  log(`\n📊 Asks to create itinerary: ${hasConfirmation ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    suite: 1,
    turn: 5,
    passed: hasConfirmation,
    critical: false
  });

  return { suite: 1, chatId, summary: turn5.context?.summary };
}

// ============================================================================
// TEST SUITE 2: Type B - Specific Destination (Direct Itinerary)
// ============================================================================
async function testTypeBSpecificDestination() {
  log("\n\n📋 TEST SUITE 2: Type B - Specific Destination (Direct Itinerary)");
  log("=" .repeat(80));
  log("Scenario: User knows destination → Gather remaining slots → Create itinerary\n");

  const chatId = `test-${chatIdCounter++}`;
  let history = [];

  // Turn 1: Specific destination mentioned
  const turn1 = await runTestTurn(
    "Suite 2",
    1,
    "Plan a trip to Goa",
    chatId,
    history,
    "Should recognize Goa as destination, ask for origin/dates/pax, NO suggestions"
  );
  history = turn1.conversationHistory;

  const dest1 = hasDestinationSuggestions(turn1.output);
  const hasDestinationCapture = turn1.context?.summary?.destination?.city?.toLowerCase().includes('goa');
  log(`\n📊 Destination captured: ${hasDestinationCapture ? '✅ YES' : '❌ NO'}`);
  log(`   Shows suggestions: ${dest1.result ? '❌ YES (wrong!)' : '✅ NO (correct)'}`);

  testResults.push({
    suite: 2,
    turn: 1,
    passed: hasDestinationCapture && !dest1.result,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 2: Provide all remaining info
  const turn2 = await runTestTurn(
    "Suite 2",
    2,
    "From Delhi, Jan 15-20, 2026, 4 travelers, budget ₹80000",
    chatId,
    history,
    "Should confirm all details, ask to create itinerary"
  );
  history = turn2.conversationHistory;

  const slots2 = countFilledSlots(turn2.context);
  const asksConfirmation = /confirm|create|itinerary|should i create/i.test(turn2.output);
  log(`\n📊 Slots: ${slots2.filled}/5 | Asks confirmation: ${asksConfirmation ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    suite: 2,
    turn: 2,
    slotsFilled: slots2.filled,
    passed: asksConfirmation && slots2.filled >= 4,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 3: Confirm to create
  const turn3 = await runTestTurn(
    "Suite 2",
    3,
    "Yes, create the itinerary",
    chatId,
    history,
    "Should create detailed day-by-day itinerary"
  );

  const hasItinerary = /Day \d+:/i.test(turn3.output) && /### (Morning|Afternoon|Evening)/i.test(turn3.output);
  const itineraryDays = turn3.context?.itinerary?.days?.length || 0;
  log(`\n📊 Has itinerary format: ${hasItinerary ? '✅ YES' : '❌ NO'}`);
  log(`   Itinerary days: ${itineraryDays}`);

  testResults.push({
    suite: 2,
    turn: 3,
    passed: hasItinerary && itineraryDays > 0,
    critical: true
  });

  return { suite: 2, chatId, summary: turn3.context?.summary };
}

// ============================================================================
// TEST SUITE 3: All-at-Once Complete Info
// ============================================================================
async function testAllAtOnceComplete() {
  log("\n\n📋 TEST SUITE 3: All-at-Once Complete Info");
  log("=" .repeat(80));
  log("Scenario: User provides everything in one message\n");

  const chatId = `test-${chatIdCounter++}`;

  const turn1 = await runTestTurn(
    "Suite 3",
    1,
    "Plan a 7-day trip to Bali from Mumbai, 2 people, ₹150000 budget, we love beaches and culture",
    chatId,
    [],
    "Should capture all info, confirm, and ask to create itinerary"
  );

  const slots1 = countFilledSlots(turn1.context);
  const asksConfirmation = /confirm|create|itinerary|should i create/i.test(turn1.output);
  log(`\n📊 Slots: ${slots1.filled}/5 | Asks confirmation: ${asksConfirmation ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    suite: 3,
    turn: 1,
    slotsFilled: slots1.filled,
    passed: asksConfirmation && slots1.filled >= 4,
    critical: true
  });

  return { suite: 3, chatId };
}

// ============================================================================
// TEST SUITE 4: Ambiguous & Conversational Inputs
// ============================================================================
async function testAmbiguousInputs() {
  log("\n\n📋 TEST SUITE 4: Ambiguous & Conversational Inputs");
  log("=" .repeat(80));
  log("Scenario: User provides vague, conversational info\n");

  const chatId = `test-${chatIdCounter++}`;
  let history = [];

  const turn1 = await runTestTurn(
    "Suite 4",
    1,
    "I want a vacation, not too expensive",
    chatId,
    history,
    "Should extract budget hint, ask for remaining slots"
  );
  history = turn1.conversationHistory;

  const slots1 = countFilledSlots(turn1.context);
  const dest1 = hasDestinationSuggestions(turn1.output);
  log(`\n📊 Slots: ${slots1.filled}/5 | Destinations: ${dest1.result ? '❌ YES' : '✅ NO'}`);

  testResults.push({
    suite: 4,
    case: 'vague-budget',
    slotsFilled: slots1.filled,
    passed: !dest1.result && hasSlotFillingQuestions(turn1.output),
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  const turn2 = await runTestTurn(
    "Suite 4",
    2,
    "maybe a week or so, just me and my wife",
    chatId,
    history,
    "Should extract duration (~7 days) and pax (2)"
  );
  history = turn2.conversationHistory;

  const slots2 = countFilledSlots(turn2.context);
  const dest2 = hasDestinationSuggestions(turn2.output);
  log(`\n📊 Slots: ${slots2.filled}/5 | Destinations: ${dest2.result ? '❌ YES' : '✅ NO'}`);

  testResults.push({
    suite: 4,
    case: 'casual-duration-pax',
    slotsFilled: slots2.filled,
    passed: !dest2.result && slots2.filled >= 2,
    critical: true
  });

  return { suite: 4, chatId };
}

// ============================================================================
// TEST SUITE 5: Fragmented Slot Filling (Many Messages)
// ============================================================================
async function testFragmentedFilling() {
  log("\n\n📋 TEST SUITE 5: Fragmented Slot Filling");
  log("=" .repeat(80));
  log("Scenario: User provides slots over 6 separate messages\n");

  const chatId = `test-${chatIdCounter++}`;
  let history = [];

  const turns = [
    { msg: "I want to travel", expected: "Ask for all slots" },
    { msg: "Budget is $3000", expected: "Acknowledge, ask for rest" },
    { msg: "per person", expected: "Clarify, ask for rest" },
    { msg: "10 days", expected: "Capture duration, ask for rest" },
    { msg: "3 travelers", expected: "Capture pax, ask for rest" },
    { msg: "from San Francisco", expected: "Capture origin, ask for tripTypes" },
    { msg: "love food and wine", expected: "ALL FILLED - show destinations!" }
  ];

  for (let i = 0; i < turns.length; i++) {
    const turn = await runTestTurn(
      "Suite 5",
      i + 1,
      turns[i].msg,
      chatId,
      history,
      turns[i].expected
    );
    history = turn.conversationHistory;

    const slots = countFilledSlots(turn.context);
    const dest = hasDestinationSuggestions(turn.output);

    log(`\n  Slots: ${slots.filled}/5 | Destinations: ${dest.result ? (i === 6 ? '✅ YES' : '❌ YES') : (i === 6 ? '❌ NO' : '✅ NO')}`);

    if (i < 6) {
      testResults.push({
        suite: 5,
        turn: i + 1,
        slotsFilled: slots.filled,
        passed: !dest.result,
        critical: true
      });
    } else {
      testResults.push({
        suite: 5,
        turn: i + 1,
        slotsFilled: slots.filled,
        passed: dest.result && slots.filled === 5,
        critical: true
      });
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  return { suite: 5, chatId };
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================
async function runAllTests() {
  const startTime = Date.now();

  try {
    log("\n🚀 Starting Handoff Approach - Slot-First Workflow Tests");
    log("Testing Trip Planner Agent with comprehensive scenarios...\n");

    const suite1 = await testTypeAVagueDestination();
    const suite2 = await testTypeBSpecificDestination();
    const suite3 = await testAllAtOnceComplete();
    const suite4 = await testAmbiguousInputs();
    const suite5 = await testFragmentedFilling();

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

    log(`\n🔴 CRITICAL Slot-First Tests:`);
    log(`  Total: ${criticalTests.length}`);
    log(`  Passed: ${criticalPassed} ✅`);
    log(`  Failed: ${criticalTests.length - criticalPassed} ❌`);
    log(`  Pass Rate: ${criticalRate}%`);

    log(`\n📋 Test Suites:`);
    log(`  1. ✓ Type A - Vague Destination (5 turns)`);
    log(`  2. ✓ Type B - Specific Destination (3 turns)`);
    log(`  3. ✓ All-at-Once Complete Info (1 turn)`);
    log(`  4. ✓ Ambiguous Inputs (2 cases)`);
    log(`  5. ✓ Fragmented Filling (7 messages)`);

    const failedCritical = criticalTests.filter(t => !t.passed);
    if (failedCritical.length > 0) {
      log(`\n⚠️  FAILED CRITICAL TESTS:`);
      failedCritical.forEach(t => {
        log(`  ❌ Suite ${t.suite}, Turn ${t.turn || t.case}: Slots ${t.slotsFilled || 'N/A'}/5`);
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFilePath = path.join(DATA_DIR, `handoff-slot-first-${timestamp}.log`);
    await fs.writeFile(logFilePath, allLogs.join('\n'), 'utf-8');
    log(`\n💾 Logs saved to: ${logFilePath}`);

    const resultsFilePath = path.join(DATA_DIR, `handoff-slot-first-results-${timestamp}.json`);
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
        { id: 1, name: 'Type A - Vague Destination', summary: suite1.summary },
        { id: 2, name: 'Type B - Specific Destination', summary: suite2.summary },
        { id: 3, name: 'All-at-Once Complete' },
        { id: 4, name: 'Ambiguous Inputs' },
        { id: 5, name: 'Fragmented Filling' }
      ]
    }, null, 2), 'utf-8');
    log(`💾 Results saved to: ${resultsFilePath}`);

    log("\n" + "=".repeat(80));
    if (criticalRate >= 95) {
      log("🎉 EXCELLENT! Handoff slot-first workflow is working perfectly!");
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
    const errorLogPath = path.join(DATA_DIR, `handoff-error-${timestamp}.log`);
    await fs.writeFile(errorLogPath, allLogs.join('\n') + '\n\nERROR:\n' + error.stack, 'utf-8');
    log(`\n💾 Error log saved to: ${errorLogPath}`);
  }
}

runAllTests().catch(console.error);
