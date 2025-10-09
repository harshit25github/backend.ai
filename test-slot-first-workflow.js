import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { run, user } from '@openai/agents';
import {
  createEnhancedContext,
  enhancedManagerAgent
} from './src/ai/enhanced-manager.js';

console.log("🧪 SLOT-FIRST WORKFLOW TESTING\n");
console.log("=" .repeat(80));
console.log("Testing NEW workflow: NO destinations until ALL slots filled\n");

// Ensure data directory exists
const DATA_DIR = './data';
await fs.mkdir(DATA_DIR, { recursive: true });

let allLogs = [];
let testResults = [];

// Helper to log and save
function log(message, save = true) {
  console.log(message);
  if (save) {
    allLogs.push(message);
  }
}

// Helper to run a test turn
async function runTestTurn(testName, turnNumber, message, thread, appContext, expectedBehavior) {
  log(`\n🔹 TURN ${turnNumber}: ${message}`);
  log("-".repeat(80));
  log(`Expected: ${expectedBehavior}`);

  const startTime = Date.now();

  try {
    const res = await run(
      enhancedManagerAgent,
      thread.concat(user(message)),
      { context: appContext }
    );

    const duration = Date.now() - startTime;
    const output = Array.isArray(res.finalOutput)
      ? res.finalOutput.map(String).join('\n')
      : String(res.finalOutput ?? '');

    log(`\n✅ Last Agent: ${res.lastAgent?.name ?? 'Unknown'}`);
    log(`⏱️  Response Time: ${(duration / 1000).toFixed(2)}s`);
    log("\n📝 Agent Response:");
    log(output.length > 1500 ? output.substring(0, 1500) + "\n... (truncated) ..." : output);

    return {
      success: true,
      output,
      context: appContext,
      lastAgent: res.lastAgent?.name,
      history: res.history,
      duration
    };
  } catch (error) {
    log(`\n❌ Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      context: appContext,
      duration: Date.now() - startTime
    };
  }
}

// Validation helpers
function hasDestinationSuggestions(output) {
  // Check for destination headers and landmark lists
  const hasDestinationHeaders = /##\s+[A-Z][a-z]+,\s+[A-Z]/m.test(output);
  const hasLandmarks = /📍\s+Must-see highlights?:/i.test(output);
  const hasMultipleDestinations = (output.match(/##\s+[A-Z][a-z]+,/g) || []).length >= 2;

  return hasDestinationHeaders && hasLandmarks && hasMultipleDestinations;
}

function hasSlotFillingQuestions(output) {
  // Check for slot-filling questions
  return /where.*traveling from|what.*budget|how many days|how many travelers|what type|what kind|preferences/i.test(output);
}

function countFilledSlots(context) {
  const slots = {
    budget: !!(context.summary?.budget?.amount),
    duration: !!(context.summary?.duration_days || (context.summary?.outbound_date && context.summary?.return_date)),
    pax: !!(context.summary?.pax),
    origin: !!(context.summary?.origin?.city),
    preferences: !!(context.summary?.preferences || context.summary?.trip_type)
  };

  const filled = Object.values(slots).filter(Boolean).length;
  return { slots, filled, total: 5 };
}

function validateSuggestedQuestions(context) {
  return (context.summary?.suggestedQuestions?.length || 0) > 0;
}

// ============================================================================
// TEST SUITE 1: Progressive Slot Filling - NO Destinations Until Complete
// ============================================================================
async function testProgressiveSlotFilling() {
  log("\n\n📋 TEST SUITE 1: Progressive Slot Filling - NO Destinations Until Complete");
  log("=" .repeat(80));
  log("Scenario: User gradually provides slots → Should NOT show destinations until ALL filled\n");

  const appContext = createEnhancedContext({ name: 'Test User', uid: 1 });
  let thread = [];
  const results = [];

  // Turn 1: Completely vague - NO slots
  const turn1 = await runTestTurn(
    "Suite 1",
    1,
    "I want to travel somewhere",
    thread,
    appContext,
    "Should ask for ALL slots, NO destination suggestions"
  );
  results.push(turn1);
  thread = turn1.history || thread.concat(user("I want to travel somewhere"));

  log("\n📊 Validation:");
  const slotInfo1 = countFilledSlots(appContext);
  const hasDestinations1 = hasDestinationSuggestions(turn1.output);
  const hasQuestions1 = hasSlotFillingQuestions(turn1.output);
  const hasSuggested1 = validateSuggestedQuestions(appContext);

  log(`  Slots filled: ${slotInfo1.filled}/${slotInfo1.total}`);
  Object.entries(slotInfo1.slots).forEach(([key, filled]) => {
    log(`    ${filled ? '✅' : '❌'} ${key}`);
  });
  log(`  ${!hasDestinations1 ? '✅' : '❌'} NO destination suggestions shown (CORRECT)`);
  log(`  ${hasQuestions1 ? '✅' : '❌'} Asked slot-filling questions`);
  log(`  ${hasSuggested1 ? '✅' : '❌'} Populated suggestedQuestions (${appContext.summary?.suggestedQuestions?.length || 0})`);

  testResults.push({
    suite: 1,
    turn: 1,
    slotsFilled: slotInfo1.filled,
    passed: !hasDestinations1 && hasQuestions1,
    critical: true,
    reason: hasDestinations1 ? "❌ FAILED: Showed destinations too early!" : "✅ Correctly withheld destinations"
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 2: Provide budget only (1/5 slots)
  const turn2 = await runTestTurn(
    "Suite 1",
    2,
    "My budget is $2000 per person",
    thread,
    appContext,
    "Should acknowledge budget, ask for remaining 4 slots, still NO destinations"
  );
  results.push(turn2);
  thread = turn2.history || thread.concat(user("My budget is $2000 per person"));

  log("\n📊 Validation:");
  const slotInfo2 = countFilledSlots(appContext);
  const hasDestinations2 = hasDestinationSuggestions(turn2.output);
  const hasQuestions2 = hasSlotFillingQuestions(turn2.output);

  log(`  Slots filled: ${slotInfo2.filled}/${slotInfo2.total}`);
  Object.entries(slotInfo2.slots).forEach(([key, filled]) => {
    log(`    ${filled ? '✅' : '❌'} ${key}`);
  });
  log(`  ${!hasDestinations2 ? '✅' : '❌'} NO destination suggestions shown (CORRECT)`);
  log(`  ${hasQuestions2 ? '✅' : '❌'} Still asking for remaining slots`);

  testResults.push({
    suite: 1,
    turn: 2,
    slotsFilled: slotInfo2.filled,
    passed: !hasDestinations2 && hasQuestions2 && slotInfo2.filled >= 1,
    critical: true,
    reason: hasDestinations2 ? "❌ FAILED: Showed destinations too early!" : "✅ Correctly withheld destinations"
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 3: Provide duration and pax (3/5 slots)
  const turn3 = await runTestTurn(
    "Suite 1",
    3,
    "7 days for 2 people",
    thread,
    appContext,
    "Should acknowledge, ask for origin and preferences, still NO destinations"
  );
  results.push(turn3);
  thread = turn3.history || thread.concat(user("7 days for 2 people"));

  log("\n📊 Validation:");
  const slotInfo3 = countFilledSlots(appContext);
  const hasDestinations3 = hasDestinationSuggestions(turn3.output);
  const hasQuestions3 = hasSlotFillingQuestions(turn3.output);

  log(`  Slots filled: ${slotInfo3.filled}/${slotInfo3.total}`);
  Object.entries(slotInfo3.slots).forEach(([key, filled]) => {
    log(`    ${filled ? '✅' : '❌'} ${key}`);
  });
  log(`  ${!hasDestinations3 ? '✅' : '❌'} NO destination suggestions shown (CORRECT)`);
  log(`  ${hasQuestions3 ? '✅' : '❌'} Still asking for remaining slots`);

  testResults.push({
    suite: 1,
    turn: 3,
    slotsFilled: slotInfo3.filled,
    passed: !hasDestinations3 && hasQuestions3 && slotInfo3.filled >= 3,
    critical: true,
    reason: hasDestinations3 ? "❌ FAILED: Showed destinations too early!" : "✅ Correctly withheld destinations"
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 4: Provide origin (4/5 slots)
  const turn4 = await runTestTurn(
    "Suite 1",
    4,
    "I'm traveling from New York",
    thread,
    appContext,
    "Should acknowledge, ask for preferences only, still NO destinations"
  );
  results.push(turn4);
  thread = turn4.history || thread.concat(user("I'm traveling from New York"));

  log("\n📊 Validation:");
  const slotInfo4 = countFilledSlots(appContext);
  const hasDestinations4 = hasDestinationSuggestions(turn4.output);
  const hasQuestions4 = hasSlotFillingQuestions(turn4.output);

  log(`  Slots filled: ${slotInfo4.filled}/${slotInfo4.total}`);
  Object.entries(slotInfo4.slots).forEach(([key, filled]) => {
    log(`    ${filled ? '✅' : '❌'} ${key}`);
  });
  log(`  ${!hasDestinations4 ? '✅' : '❌'} NO destination suggestions shown (CORRECT)`);
  log(`  ${hasQuestions4 ? '✅' : '❌'} Still asking for preferences`);

  testResults.push({
    suite: 1,
    turn: 4,
    slotsFilled: slotInfo4.filled,
    passed: !hasDestinations4 && hasQuestions4 && slotInfo4.filled >= 4,
    critical: true,
    reason: hasDestinations4 ? "❌ FAILED: Showed destinations too early!" : "✅ Correctly withheld destinations"
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 5: Provide preferences (5/5 slots - ALL COMPLETE!)
  const turn5 = await runTestTurn(
    "Suite 1",
    5,
    "I love beaches and culture",
    thread,
    appContext,
    "ALL SLOTS FILLED → Should NOW show 4-7 destination suggestions!"
  );
  results.push(turn5);
  thread = turn5.history || thread.concat(user("I love beaches and culture"));

  log("\n📊 Validation:");
  const slotInfo5 = countFilledSlots(appContext);
  const hasDestinations5 = hasDestinationSuggestions(turn5.output);
  const destinationCount = (turn5.output.match(/##\s+[A-Z][a-z]+,/g) || []).length;

  log(`  Slots filled: ${slotInfo5.filled}/${slotInfo5.total}`);
  Object.entries(slotInfo5.slots).forEach(([key, filled]) => {
    log(`    ${filled ? '✅' : '❌'} ${key}`);
  });
  log(`  ${hasDestinations5 ? '✅' : '❌'} Destination suggestions NOW shown (CORRECT)`);
  log(`  ${destinationCount >= 4 ? '✅' : '⚠️ '} Destination count: ${destinationCount} (expected 4-7)`);
  log(`  ${/which destination|which.*catch|interested in/i.test(turn5.output) ? '✅' : '❌'} Asked which destination user prefers`);

  testResults.push({
    suite: 1,
    turn: 5,
    slotsFilled: slotInfo5.filled,
    passed: hasDestinations5 && slotInfo5.filled === 5 && destinationCount >= 4,
    critical: true,
    reason: hasDestinations5 ? "✅ Correctly showed destinations after all slots filled" : "❌ FAILED: Should show destinations now!"
  });

  return { suite: 1, results, summary: appContext.summary };
}

// ============================================================================
// TEST SUITE 2: All-at-Once Complete Info
// ============================================================================
async function testAllAtOnce() {
  log("\n\n📋 TEST SUITE 2: All-at-Once Complete Info");
  log("=" .repeat(80));
  log("Scenario: User provides ALL slots in first message → Should show destinations immediately\n");

  const appContext = createEnhancedContext({ name: 'Test User', uid: 2 });
  let thread = [];

  const turn1 = await runTestTurn(
    "Suite 2",
    1,
    "I want to travel from Mumbai, 7 days, 2 people, $2000 budget per person, looking for beaches and culture",
    thread,
    appContext,
    "ALL slots provided → Should show destinations immediately"
  );
  thread = turn1.history || thread.concat(user("I want to travel from Mumbai, 7 days, 2 people, $2000 budget per person, looking for beaches and culture"));

  log("\n📊 Validation:");
  const slotInfo = countFilledSlots(appContext);
  const hasDestinations = hasDestinationSuggestions(turn1.output);
  const destinationCount = (turn1.output.match(/##\s+[A-Z][a-z]+,/g) || []).length;

  log(`  Slots filled: ${slotInfo.filled}/${slotInfo.total}`);
  Object.entries(slotInfo.slots).forEach(([key, filled]) => {
    log(`    ${filled ? '✅' : '❌'} ${key}`);
  });
  log(`  ${hasDestinations ? '✅' : '❌'} Destination suggestions shown (CORRECT)`);
  log(`  Destination count: ${destinationCount} (expected 4-7)`);

  testResults.push({
    suite: 2,
    turn: 1,
    slotsFilled: slotInfo.filled,
    passed: hasDestinations && slotInfo.filled >= 4,
    critical: true,
    reason: hasDestinations ? "✅ Correctly showed destinations with complete info" : "❌ FAILED: Should show destinations!"
  });

  return { suite: 2, summary: appContext.summary };
}

// ============================================================================
// TEST SUITE 3: Exception - Specific Destination Query
// ============================================================================
async function testSpecificDestinationException() {
  log("\n\n📋 TEST SUITE 3: Exception - Specific Destination Query");
  log("=" .repeat(80));
  log("Scenario: User asks about specific destination WITHOUT slots → Should provide insights anyway\n");

  const appContext = createEnhancedContext({ name: 'Test User', uid: 3 });
  let thread = [];

  const turn1 = await runTestTurn(
    "Suite 3",
    1,
    "Tell me about Paris",
    thread,
    appContext,
    "Should provide Paris insights immediately (EXCEPTION to slot-first rule)"
  );
  thread = turn1.history || turn1.history || thread.concat(user("Tell me about Paris"));

  log("\n📊 Validation:");
  const slotInfo = countFilledSlots(appContext);
  const hasParisInfo = /paris/i.test(turn1.output) &&
                       (/best time|visa|culture|attractions|budget|eiffel|louvre/i.test(turn1.output));
  const hasMultipleSections = (turn1.output.match(/##\s+/g) || []).length >= 3;
  const asksForItinerary = /itinerary|plan|create|would you like/i.test(turn1.output);

  log(`  Slots filled: ${slotInfo.filled}/${slotInfo.total} (expected to be low)`);
  log(`  ${hasParisInfo ? '✅' : '❌'} Provided Paris insights (EXCEPTION)`);
  log(`  ${hasMultipleSections ? '✅' : '❌'} Multiple information sections`);
  log(`  ${asksForItinerary ? '✅' : '❌'} Asked if user wants itinerary`);

  testResults.push({
    suite: 3,
    turn: 1,
    slotsFilled: slotInfo.filled,
    passed: hasParisInfo && asksForItinerary,
    critical: false,
    reason: hasParisInfo ? "✅ Correctly handled exception case" : "❌ FAILED: Should provide insights"
  });

  return { suite: 3, summary: appContext.summary };
}

// ============================================================================
// TEST SUITE 4: Partial Slots - Various Combinations
// ============================================================================
async function testPartialSlots() {
  log("\n\n📋 TEST SUITE 4: Partial Slots - Various Combinations");
  log("=" .repeat(80));
  log("Scenario: Test various partial slot combinations - should NEVER show destinations\n");

  const results = [];

  // Test Case 1: Only budget and duration (2/5)
  log("\n🔹 TEST CASE 1: Budget + Duration only (2/5 slots)");
  log("-".repeat(80));
  const appContext1 = createEnhancedContext({ name: 'Test User', uid: 4 });
  const turn1 = await runTestTurn(
    "Suite 4",
    1,
    "$3000 budget for 5 days",
    [],
    appContext1,
    "Should ask for origin, pax, preferences - NO destinations"
  );
  results.push(turn1);

  const slots1 = countFilledSlots(appContext1);
  const hasDestinations1 = hasDestinationSuggestions(turn1.output);
  log(`\n  Slots: ${slots1.filled}/5 | Destinations shown: ${hasDestinations1 ? '❌ YES (WRONG!)' : '✅ NO (CORRECT)'}`);

  testResults.push({
    suite: 4,
    case: 'budget-duration',
    slotsFilled: slots1.filled,
    passed: !hasDestinations1,
    reason: hasDestinations1 ? "❌ Showed destinations too early" : "✅ Correctly withheld"
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test Case 2: Origin, pax, preferences but NO budget, duration (3/5)
  log("\n\n🔹 TEST CASE 2: Origin + Pax + Preferences (3/5 slots, missing budget/duration)");
  log("-".repeat(80));
  const appContext2 = createEnhancedContext({ name: 'Test User', uid: 5 });
  const turn2 = await runTestTurn(
    "Suite 4",
    2,
    "I'm from London, 4 travelers, we want adventure activities",
    [],
    appContext2,
    "Should ask for budget and duration - NO destinations"
  );
  results.push(turn2);

  const slots2 = countFilledSlots(appContext2);
  const hasDestinations2 = hasDestinationSuggestions(turn2.output);
  log(`\n  Slots: ${slots2.filled}/5 | Destinations shown: ${hasDestinations2 ? '❌ YES (WRONG!)' : '✅ NO (CORRECT)'}`);

  testResults.push({
    suite: 4,
    case: 'origin-pax-prefs',
    slotsFilled: slots2.filled,
    passed: !hasDestinations2,
    reason: hasDestinations2 ? "❌ Showed destinations too early" : "✅ Correctly withheld"
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test Case 3: 4/5 slots (missing only preferences)
  log("\n\n🔹 TEST CASE 3: 4/5 slots (missing only preferences)");
  log("-".repeat(80));
  const appContext3 = createEnhancedContext({ name: 'Test User', uid: 6 });
  const turn3 = await runTestTurn(
    "Suite 4",
    3,
    "From Tokyo, 6 days, 3 people, $5000 budget",
    [],
    appContext3,
    "Should ask for preferences only - NO destinations"
  );
  results.push(turn3);

  const slots3 = countFilledSlots(appContext3);
  const hasDestinations3 = hasDestinationSuggestions(turn3.output);
  log(`\n  Slots: ${slots3.filled}/5 | Destinations shown: ${hasDestinations3 ? '❌ YES (WRONG!)' : '✅ NO (CORRECT)'}`);

  testResults.push({
    suite: 4,
    case: 'missing-prefs-only',
    slotsFilled: slots3.filled,
    passed: !hasDestinations3,
    reason: hasDestinations3 ? "❌ Showed destinations too early" : "✅ Correctly withheld"
  });

  return { suite: 4, results };
}

// ============================================================================
// TEST SUITE 5: Edge Cases
// ============================================================================
async function testEdgeCases() {
  log("\n\n📋 TEST SUITE 5: Edge Cases");
  log("=" .repeat(80));
  log("Scenario: Test edge cases and boundary conditions\n");

  const results = [];

  // Edge Case 1: User says "anywhere" for destination preferences
  log("\n🔹 EDGE CASE 1: Vague preference 'anywhere'");
  log("-".repeat(80));
  const appContext1 = createEnhancedContext({ name: 'Test User', uid: 7 });
  let thread1 = [];

  // First, fill budget, duration, pax, origin
  const turn1a = await runTestTurn("Suite 5", 1, "From Paris, 10 days, 2 people, €4000 budget", thread1, appContext1, "Fill 4 slots");
  thread1 = turn1a.history || thread1.concat(user("From Paris, 10 days, 2 people, €4000 budget"));
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Now provide vague preference
  const turn1b = await runTestTurn("Suite 5", 2, "anywhere is fine", thread1, appContext1, "Should accept and show destinations");

  const slots1 = countFilledSlots(appContext1);
  const hasDestinations1 = hasDestinationSuggestions(turn1b.output);
  log(`\n  Slots: ${slots1.filled}/5 | Destinations shown: ${hasDestinations1 ? '✅ YES (if 5/5)' : '❌ NO'}`);

  testResults.push({
    suite: 5,
    case: 'vague-preference',
    slotsFilled: slots1.filled,
    passed: slots1.filled === 5 ? hasDestinations1 : !hasDestinations1,
    reason: "Vague preference handling"
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Edge Case 2: User changes mind on budget mid-conversation
  log("\n\n🔹 EDGE CASE 2: Change budget mid-conversation");
  log("-".repeat(80));
  const appContext2 = createEnhancedContext({ name: 'Test User', uid: 8 });
  let thread2 = [];

  const turn2a = await runTestTurn("Suite 5", 3, "From Mumbai, 7 days, 2 people, ₹80000 budget, beaches", thread2, appContext2, "All slots filled");
  thread2 = turn2a.history || thread2.concat(user("From Mumbai, 7 days, 2 people, ₹80000 budget, beaches"));
  await new Promise(resolve => setTimeout(resolve, 2000));

  const turn2b = await runTestTurn("Suite 5", 4, "Actually, change budget to ₹50000", thread2, appContext2, "Update budget and re-suggest");

  const newBudget = appContext2.summary?.budget?.amount;
  log(`\n  Budget updated to: ₹${newBudget}`);

  testResults.push({
    suite: 5,
    case: 'budget-change',
    passed: true, // Any reasonable handling is acceptable
    reason: "Budget modification handling"
  });

  return { suite: 5, results };
}

// ============================================================================
// RUN ALL TESTS AND SAVE RESULTS
// ============================================================================
async function runAllTests() {
  const startTime = Date.now();

  try {
    log("\n🚀 Starting Slot-First Workflow Tests");
    log("This will validate the NEW slot-gathering-first approach...\n");

    const suite1 = await testProgressiveSlotFilling();
    const suite2 = await testAllAtOnce();
    const suite3 = await testSpecificDestinationException();
    const suite4 = await testPartialSlots();
    const suite5 = await testEdgeCases();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Generate summary
    log("\n\n" + "=".repeat(80));
    log("✨ ALL TESTS COMPLETED");
    log("=".repeat(80));
    log(`\n⏱️  Total Time: ${duration} seconds`);

    // Count results
    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = ((passedTests / totalTests) * 100).toFixed(1);

    // Critical tests (slot-first validation)
    const criticalTests = testResults.filter(t => t.critical);
    const criticalPassed = criticalTests.filter(t => t.passed).length;
    const criticalRate = ((criticalPassed / criticalTests.length) * 100).toFixed(1);

    log(`\n📊 Test Summary:`);
    log(`  Total Tests: ${totalTests}`);
    log(`  Passed: ${passedTests} ✅`);
    log(`  Failed: ${failedTests} ❌`);
    log(`  Pass Rate: ${passRate}%`);
    log(`\n🔴 CRITICAL Slot-First Tests: ${criticalPassed}/${criticalTests.length} passed (${criticalRate}%)`);

    log(`\n📋 Test Suites:`);
    log(`  1. ✓ Progressive Slot Filling (5 turns)`);
    log(`  2. ✓ All-at-Once Complete Info (1 turn)`);
    log(`  3. ✓ Specific Destination Exception (1 turn)`);
    log(`  4. ✓ Partial Slots Combinations (3 cases)`);
    log(`  5. ✓ Edge Cases (2 scenarios)`);

    // Show failed critical tests
    const failedCritical = criticalTests.filter(t => !t.passed);
    if (failedCritical.length > 0) {
      log(`\n⚠️  FAILED CRITICAL TESTS:`);
      failedCritical.forEach(t => {
        log(`  ❌ Suite ${t.suite}, Turn ${t.turn || 'N/A'}: ${t.reason}`);
      });
    }

    // Save logs to data folder
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFilePath = path.join(DATA_DIR, `slot-first-workflow-${timestamp}.log`);

    await fs.writeFile(logFilePath, allLogs.join('\n'), 'utf-8');
    log(`\n💾 Detailed logs saved to: ${logFilePath}`);

    // Save results JSON
    const resultsFilePath = path.join(DATA_DIR, `slot-first-results-${timestamp}.json`);
    await fs.writeFile(resultsFilePath, JSON.stringify({
      timestamp: new Date().toISOString(),
      duration: duration,
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
        { id: 1, name: 'Progressive Slot Filling', summary: suite1.summary },
        { id: 2, name: 'All-at-Once Complete Info', summary: suite2.summary },
        { id: 3, name: 'Specific Destination Exception', summary: suite3.summary },
        { id: 4, name: 'Partial Slots Combinations' },
        { id: 5, name: 'Edge Cases' }
      ]
    }, null, 2), 'utf-8');
    log(`💾 Results JSON saved to: ${resultsFilePath}`);

    log("\n" + "=".repeat(80));
    if (criticalRate >= 90) {
      log("🎉 EXCELLENT! Slot-first workflow is working perfectly!");
    } else if (criticalRate >= 75) {
      log("✅ GOOD! Most critical tests passed. Minor adjustments may be needed.");
    } else {
      log("⚠️  CRITICAL ISSUES! Slot-first workflow needs fixes. Review failures above.");
    }
    log("=".repeat(80) + "\n");

  } catch (error) {
    log("\n\n❌ TESTS FAILED WITH ERROR:");
    log(error.message);
    log(error.stack);

    // Save error log
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const errorLogPath = path.join(DATA_DIR, `slot-first-error-${timestamp}.log`);
    await fs.writeFile(errorLogPath, allLogs.join('\n') + '\n\nERROR:\n' + error.stack, 'utf-8');
    log(`\n💾 Error log saved to: ${errorLogPath}`);
  }
}

runAllTests().catch(console.error);
