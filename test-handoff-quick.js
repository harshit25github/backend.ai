import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log("🧪 HANDOFF APPROACH - QUICK SLOT-FIRST VALIDATION\n");
console.log("=" .repeat(80));
console.log("Testing Trip Planner Agent - Critical Scenarios Only\n");

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
    log("\n📝 Agent Response (first 600 chars):");
    log(output.length > 600 ? output.substring(0, 600) + "\n..." : output);

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

// ============================================================================
// CRITICAL TEST 1: Vague Destination - No Suggestions Until All Slots Filled
// ============================================================================
async function criticalTest1() {
  log("\n\n📋 CRITICAL TEST 1: Type A - Vague Destination (3 turns only)");
  log("=" .repeat(80));
  log("Scenario: Vague request → Progressive slots → Show suggestions ONLY when all filled\n");

  const chatId = `test-${chatIdCounter++}`;
  let history = [];

  // Turn 1: Completely vague
  const turn1 = await runTestTurn(
    "Critical 1",
    1,
    "I want to go somewhere for vacation",
    chatId,
    history,
    "Should ask for ALL slots, NO destinations"
  );
  history = turn1.conversationHistory;

  const slots1 = countFilledSlots(turn1.context);
  const dest1 = hasDestinationSuggestions(turn1.output);
  log(`\n📊 Slots: ${slots1.filled}/5 | Destinations: ${dest1.result ? '❌ YES (FAIL)' : '✅ NO (PASS)'}`);

  testResults.push({
    test: 'Critical 1 - Turn 1',
    scenario: 'vague-initial',
    slotsFilled: slots1.filled,
    hasDestinations: dest1.result,
    passed: !dest1.result,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Turn 2: Provide ALL slots at once
  const turn2 = await runTestTurn(
    "Critical 1",
    2,
    "From Mumbai, ₹60000 budget for 5 days, 2 people, we love beaches and adventure",
    chatId,
    history,
    "ALL SLOTS FILLED → Should NOW show 4+ destination suggestions"
  );
  history = turn2.conversationHistory;

  const slots2 = countFilledSlots(turn2.context);
  const dest2 = hasDestinationSuggestions(turn2.output);
  log(`\n📊 Slots: ${slots2.filled}/5 | Destinations: ${dest2.result ? '✅ YES (PASS)' : '❌ NO (FAIL)'}`);
  log(`   Destination count: ${dest2.count}`);

  testResults.push({
    test: 'Critical 1 - Turn 2',
    scenario: 'all-slots-filled',
    slotsFilled: slots2.filled,
    hasDestinations: dest2.result,
    destinationCount: dest2.count,
    passed: dest2.result && slots2.filled === 5 && dest2.count >= 4,
    critical: true
  });

  return { chatId, summary: turn2.context?.summary };
}

// ============================================================================
// CRITICAL TEST 2: Specific Destination - Direct Itinerary
// ============================================================================
async function criticalTest2() {
  log("\n\n📋 CRITICAL TEST 2: Type B - Specific Destination (2 turns)");
  log("=" .repeat(80));
  log("Scenario: Specific destination → Gather slots → Create itinerary\n");

  const chatId = `test-${chatIdCounter++}`;
  let history = [];

  // Turn 1: Specific destination
  const turn1 = await runTestTurn(
    "Critical 2",
    1,
    "Plan a trip to Goa from Delhi, Jan 15-20, 2026, 4 travelers",
    chatId,
    history,
    "Should capture all info, confirm, NO suggestions needed"
  );
  history = turn1.conversationHistory;

  const dest1 = hasDestinationSuggestions(turn1.output);
  const hasDestinationCapture = turn1.context?.summary?.destination?.city?.toLowerCase().includes('goa');
  const slots1 = countFilledSlots(turn1.context);
  log(`\n📊 Destination: ${hasDestinationCapture ? '✅ GOA' : '❌ NOT CAPTURED'}`);
  log(`   Slots: ${slots1.filled}/5 | Shows suggestions: ${dest1.result ? '❌ YES (wrong)' : '✅ NO (correct)'}`);

  testResults.push({
    test: 'Critical 2 - Turn 1',
    scenario: 'specific-destination',
    destinationCaptured: hasDestinationCapture,
    hasDestinations: dest1.result,
    slotsFilled: slots1.filled,
    passed: hasDestinationCapture && !dest1.result,
    critical: true
  });

  return { chatId };
}

// ============================================================================
// CRITICAL TEST 3: All-at-Once Complete Info
// ============================================================================
async function criticalTest3() {
  log("\n\n📋 CRITICAL TEST 3: All-at-Once Complete Info (1 turn)");
  log("=" .repeat(80));
  log("Scenario: Everything in one message\n");

  const chatId = `test-${chatIdCounter++}`;

  const turn1 = await runTestTurn(
    "Critical 3",
    1,
    "Plan 7-day trip to Bali from Mumbai, 2 people, ₹150000 budget, beaches and culture",
    chatId,
    [],
    "Should capture all, confirm destination, ask to create itinerary"
  );

  const slots1 = countFilledSlots(turn1.context);
  const hasConfirmation = /confirm|create|itinerary|should i create/i.test(turn1.output);
  log(`\n📊 Slots: ${slots1.filled}/5 | Asks confirmation: ${hasConfirmation ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    test: 'Critical 3 - All-at-Once',
    scenario: 'complete-info-single-message',
    slotsFilled: slots1.filled,
    asksConfirmation: hasConfirmation,
    passed: hasConfirmation && slots1.filled >= 4,
    critical: true
  });

  return { chatId };
}

// ============================================================================
// RUN CRITICAL TESTS
// ============================================================================
async function runCriticalTests() {
  const startTime = Date.now();

  try {
    log("\n🚀 Starting Handoff Approach - Critical Slot-First Tests");
    log("Testing Trip Planner Agent with 3 essential scenarios...\n");

    const test1 = await criticalTest1();
    const test2 = await criticalTest2();
    const test3 = await criticalTest3();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    log("\n\n" + "=".repeat(80));
    log("✨ CRITICAL TESTS COMPLETED");
    log("=".repeat(80));
    log(`\n⏱️  Total Time: ${duration} seconds`);

    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = ((passedTests / totalTests) * 100).toFixed(1);

    log(`\n📊 Test Summary:`);
    log(`  Total Critical Tests: ${totalTests}`);
    log(`  Passed: ${passedTests} ✅`);
    log(`  Failed: ${failedTests} ❌`);
    log(`  Pass Rate: ${passRate}%`);

    log(`\n📋 Test Scenarios:`);
    log(`  1. ✓ Type A - Vague Destination (2 turns)`);
    log(`  2. ✓ Type B - Specific Destination (1 turn)`);
    log(`  3. ✓ All-at-Once Complete Info (1 turn)`);

    const failed = testResults.filter(t => !t.passed);
    if (failed.length > 0) {
      log(`\n⚠️  FAILED TESTS:`);
      failed.forEach(t => {
        log(`  ❌ ${t.test}: ${t.scenario}`);
        log(`     Slots: ${t.slotsFilled || 'N/A'}/5, Destinations: ${t.hasDestinations ? 'YES' : 'NO'}`);
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFilePath = path.join(DATA_DIR, `handoff-quick-${timestamp}.log`);
    await fs.writeFile(logFilePath, allLogs.join('\n'), 'utf-8');
    log(`\n💾 Logs saved to: ${logFilePath}`);

    const resultsFilePath = path.join(DATA_DIR, `handoff-quick-results-${timestamp}.json`);
    await fs.writeFile(resultsFilePath, JSON.stringify({
      timestamp: new Date().toISOString(),
      duration,
      totalTests,
      passedTests,
      failedTests,
      passRate,
      testResults,
      suites: [
        { id: 1, name: 'Type A - Vague Destination', summary: test1.summary },
        { id: 2, name: 'Type B - Specific Destination' },
        { id: 3, name: 'All-at-Once Complete' }
      ]
    }, null, 2), 'utf-8');
    log(`💾 Results saved to: ${resultsFilePath}`);

    log("\n" + "=".repeat(80));
    if (passRate >= 95) {
      log("🎉 EXCELLENT! Handoff slot-first workflow working perfectly!");
    } else if (passRate >= 80) {
      log("✅ GOOD! Minor issues may need attention.");
    } else {
      log("❌ NEEDS FIXES! Critical issues detected.");
    }
    log("=".repeat(80) + "\n");

  } catch (error) {
    log("\n\n❌ TESTS FAILED WITH ERROR:");
    log(error.message);
    log(error.stack);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const errorLogPath = path.join(DATA_DIR, `handoff-quick-error-${timestamp}.log`);
    await fs.writeFile(errorLogPath, allLogs.join('\n') + '\n\nERROR:\n' + error.stack, 'utf-8');
    log(`\n💾 Error log saved to: ${errorLogPath}`);
  }
}

runCriticalTests().catch(console.error);
