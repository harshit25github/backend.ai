import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { run, user } from '@openai/agents';
import {
  createEnhancedContext,
  enhancedManagerAgent
} from './src/ai/enhanced-manager.js';

console.log("🧪 CONFIRMATION STEP - EXTENSIVE TESTING\n");
console.log("=" .repeat(80));
console.log("Testing NEW confirmation workflow before showing destinations\n");

const DATA_DIR = './data';
await fs.mkdir(DATA_DIR, { recursive: true });

let allLogs = [];
let testResults = [];

function log(message, save = true) {
  console.log(message);
  if (save) {
    allLogs.push(message);
  }
}

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
    log("\n📝 Agent Response (first 800 chars):");
    log(output.length > 800 ? output.substring(0, 800) + "\n..." : output);

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
      output: '',
      context: appContext,
      duration: Date.now() - startTime
    };
  }
}

// Validation helpers
function hasDestinationSuggestions(output) {
  const hasHeaders = /##\s+[A-Z][a-z]+,\s+[A-Z]/m.test(output);
  const hasLandmarks = /📍\s+Must-see highlights?:/i.test(output);
  const hasMultiple = (output.match(/##\s+[A-Z][a-z]+,/g) || []).length >= 2;
  return hasHeaders && hasLandmarks && hasMultiple;
}

function hasConfirmationRequest(output) {
  const hasSummary = /Your Trip Requirements|Trip Details|Here'?s what (I have|we have)|Perfect! I have all/i.test(output);
  const hasQuestion = /Would you like|Want me to|Shall I|Ready to see|Can I show you|Should I suggest/i.test(output);
  const mentionsDestinations = /suggest.*destinations?|show.*destinations?|destination suggestions?/i.test(output);
  return hasSummary && hasQuestion && mentionsDestinations;
}

function countFilledSlots(context) {
  const slots = {
    budget: !!(context.summary?.budget?.amount),
    duration: !!(context.summary?.duration_days || (context.summary?.outbound_date && context.summary?.return_date)),
    pax: !!(context.summary?.pax),
    origin: !!(context.summary?.origin?.city),
    preferences: !!(context.summary?.tripType?.length > 0)
  };

  const filled = Object.values(slots).filter(Boolean).length;
  return { slots, filled, total: 5 };
}

function isAwaitingConfirmation(context) {
  return context.conversationState?.awaitingConfirmation === true;
}

// ============================================================================
// TEST SUITE 1: Progressive Slot Filling with Confirmation
// ============================================================================
async function testProgressiveWithConfirmation() {
  log("\n\n📋 TEST SUITE 1: Progressive Slot Filling → Confirmation → Destinations");
  log("=" .repeat(80));
  log("Scenario: Gather slots → Ask confirmation → User confirms → Show destinations\n");

  const appContext = createEnhancedContext({ name: 'Test User', uid: 100 });
  let thread = [];

  // Turn 1: Vague request
  const turn1 = await runTestTurn(
    "Suite 1",
    1,
    "I want to go somewhere for vacation",
    thread,
    appContext,
    "Should ask for all slots, NO destinations, NO confirmation"
  );
  thread = turn1.history || thread.concat(user("I want to go somewhere for vacation"));

  const slots1 = countFilledSlots(appContext);
  const dest1 = hasDestinationSuggestions(turn1.output);
  const conf1 = hasConfirmationRequest(turn1.output);

  log(`\n📊 Slots: ${slots1.filled}/5 | Destinations: ${dest1 ? '❌ YES' : '✅ NO'} | Confirmation: ${conf1 ? '❌ YES' : '✅ NO'}`);

  testResults.push({
    suite: 1,
    turn: 1,
    test: 'initial-vague',
    slotsFilled: slots1.filled,
    hasDestinations: dest1,
    hasConfirmation: conf1,
    passed: !dest1 && !conf1,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 2: Provide all slots at once
  const turn2 = await runTestTurn(
    "Suite 1",
    2,
    "From Mumbai, ₹60000 budget for 5 days, 2 people, we love beaches and adventure",
    thread,
    appContext,
    "ALL SLOTS FILLED → Should show summary and ASK CONFIRMATION (NO destinations yet)"
  );
  thread = turn2.history || thread.concat(user("From Mumbai, ₹60000 budget for 5 days, 2 people, we love beaches and adventure"));

  const slots2 = countFilledSlots(appContext);
  const dest2 = hasDestinationSuggestions(turn2.output);
  const conf2 = hasConfirmationRequest(turn2.output);
  const awaiting2 = isAwaitingConfirmation(appContext);

  log(`\n📊 Slots: ${slots2.filled}/5 | Destinations: ${dest2 ? '❌ YES (FAIL)' : '✅ NO (PASS)'} | Confirmation: ${conf2 ? '✅ YES (PASS)' : '❌ NO (FAIL)'}`);
  log(`   AwaitingConfirmation flag: ${awaiting2 ? '✅ TRUE' : '❌ FALSE'}`);

  testResults.push({
    suite: 1,
    turn: 2,
    test: 'all-slots-filled-ask-confirmation',
    slotsFilled: slots2.filled,
    hasDestinations: dest2,
    hasConfirmation: conf2,
    awaitingConfirmation: awaiting2,
    passed: slots2.filled === 5 && !dest2 && conf2,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 3: User confirms
  const turn3 = await runTestTurn(
    "Suite 1",
    3,
    "Yes, show me the destinations",
    thread,
    appContext,
    "User confirmed → NOW show 4-7 destination suggestions"
  );
  thread = turn3.history || thread.concat(user("Yes, show me the destinations"));

  const dest3 = hasDestinationSuggestions(turn3.output);
  const destCount3 = (turn3.output.match(/##\s+[A-Z][a-z]+,/g) || []).length;

  log(`\n📊 Destinations: ${dest3 ? '✅ YES (PASS)' : '❌ NO (FAIL)'} | Count: ${destCount3} (expected 4-7)`);

  testResults.push({
    suite: 1,
    turn: 3,
    test: 'user-confirms-show-destinations',
    hasDestinations: dest3,
    destinationCount: destCount3,
    passed: dest3 && destCount3 >= 4,
    critical: true
  });

  return { suite: 1, summary: appContext.summary };
}

// ============================================================================
// TEST SUITE 2: User Modifies Before Confirming
// ============================================================================
async function testModificationBeforeConfirmation() {
  log("\n\n📋 TEST SUITE 2: User Modifies Slots Before Confirming");
  log("=" .repeat(80));
  log("Scenario: All slots filled → Confirmation asked → User changes slot → Re-confirm\n");

  const appContext = createEnhancedContext({ name: 'Test User', uid: 101 });
  let thread = [];

  // Turn 1: Provide all slots
  const turn1 = await runTestTurn(
    "Suite 2",
    1,
    "From Delhi, ₹80000 budget for 7 days, 4 people, culture and heritage",
    thread,
    appContext,
    "All slots filled → Ask confirmation"
  );
  thread = turn1.history || thread.concat(user("From Delhi, ₹80000 budget for 7 days, 4 people, culture and heritage"));

  const conf1 = hasConfirmationRequest(turn1.output);
  log(`\n📊 Confirmation requested: ${conf1 ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    suite: 2,
    turn: 1,
    test: 'all-at-once-ask-confirmation',
    hasConfirmation: conf1,
    passed: conf1,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 2: User changes budget
  const turn2 = await runTestTurn(
    "Suite 2",
    2,
    "Actually, change my budget to ₹100000",
    thread,
    appContext,
    "Should update budget and ask confirmation again"
  );
  thread = turn2.history || thread.concat(user("Actually, change my budget to ₹100000"));

  const newBudget = appContext.summary?.budget?.amount;
  const conf2 = hasConfirmationRequest(turn2.output);
  const dest2 = hasDestinationSuggestions(turn2.output);

  log(`\n📊 Budget updated: ${newBudget === 100000 ? '✅ ₹100000' : `❌ ${newBudget}`}`);
  log(`   Confirmation re-asked: ${conf2 ? '✅ YES' : '❌ NO'} | Destinations shown: ${dest2 ? '❌ YES (wrong)' : '✅ NO (correct)'}`);

  testResults.push({
    suite: 2,
    turn: 2,
    test: 'modify-budget-reconfirm',
    budgetUpdated: newBudget === 100000,
    hasConfirmation: conf2,
    hasDestinations: dest2,
    passed: newBudget === 100000 && !dest2,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 3: User confirms with updated budget
  const turn3 = await runTestTurn(
    "Suite 2",
    3,
    "Yes, now show me",
    thread,
    appContext,
    "Should show destinations with updated ₹100000 budget"
  );

  const dest3 = hasDestinationSuggestions(turn3.output);
  const mentions100k = /₹1[,\s]?00[,\s]?000|1 lakh|100000/i.test(turn3.output);

  log(`\n📊 Destinations shown: ${dest3 ? '✅ YES' : '❌ NO'} | Mentions ₹100000: ${mentions100k ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    suite: 2,
    turn: 3,
    test: 'confirm-with-updated-budget',
    hasDestinations: dest3,
    mentionsUpdatedBudget: mentions100k,
    passed: dest3,
    critical: true
  });

  return { suite: 2, summary: appContext.summary };
}

// ============================================================================
// TEST SUITE 3: User Declines Confirmation
// ============================================================================
async function testUserDeclinesConfirmation() {
  log("\n\n📋 TEST SUITE 3: User Declines Confirmation");
  log("=" .repeat(80));
  log("Scenario: All slots filled → User says 'no' to confirmation\n");

  const appContext = createEnhancedContext({ name: 'Test User', uid: 102 });
  let thread = [];

  // Turn 1: All slots filled
  const turn1 = await runTestTurn(
    "Suite 3",
    1,
    "I want a 5-day trip from Bangalore for 2 people, ₹50000 budget, prefer mountains",
    thread,
    appContext,
    "Ask confirmation"
  );
  thread = turn1.history || thread.concat(user("I want a 5-day trip from Bangalore for 2 people, ₹50000 budget, prefer mountains"));

  const conf1 = hasConfirmationRequest(turn1.output);
  log(`\n📊 Confirmation: ${conf1 ? '✅ YES' : '❌ NO'}`);

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 2: User declines
  const turn2 = await runTestTurn(
    "Suite 3",
    2,
    "No, wait",
    thread,
    appContext,
    "Should ask what user wants to change, NO destinations shown"
  );
  thread = turn2.history || thread.concat(user("No, wait"));

  const dest2 = hasDestinationSuggestions(turn2.output);
  const asksWhat = /what would you like|what do you want|anything you'?d like to|change|update|modify/i.test(turn2.output);

  log(`\n📊 Destinations: ${dest2 ? '❌ YES (wrong)' : '✅ NO (correct)'} | Asks what to change: ${asksWhat ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    suite: 3,
    turn: 2,
    test: 'user-declines-confirmation',
    hasDestinations: dest2,
    asksWhatToChange: asksWhat,
    passed: !dest2 && asksWhat,
    critical: true
  });

  return { suite: 3 };
}

// ============================================================================
// TEST SUITE 4: Confirmation Variations
// ============================================================================
async function testConfirmationVariations() {
  log("\n\n📋 TEST SUITE 4: Different Confirmation Responses");
  log("=" .repeat(80));
  log("Scenario: Test various ways user can confirm (yes/sure/ok/show me/etc.)\n");

  const variations = [
    { response: "Yes", expected: "Should recognize as confirmation" },
    { response: "Sure", expected: "Should recognize as confirmation" },
    { response: "Go ahead", expected: "Should recognize as confirmation" },
    { response: "Show me", expected: "Should recognize as confirmation" },
    { response: "Please show the destinations", expected: "Should recognize as confirmation" }
  ];

  for (let i = 0; i < variations.length; i++) {
    const { response, expected } = variations[i];

    log(`\n🔹 VARIATION ${i + 1}: "${response}"`);
    log("-".repeat(80));

    const appContext = createEnhancedContext({ name: 'Test User', uid: 200 + i });
    let thread = [];

    // Fill all slots first
    const turn1 = await runTestTurn(
      `Suite 4.${i + 1}`,
      1,
      "Trip from Mumbai, 3 days, 2 people, ₹40000, beaches",
      thread,
      appContext,
      "Fill slots and ask confirmation"
    );
    thread = turn1.history || thread.concat(user("Trip from Mumbai, 3 days, 2 people, ₹40000, beaches"));

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Test confirmation response
    const turn2 = await runTestTurn(
      `Suite 4.${i + 1}`,
      2,
      response,
      thread,
      appContext,
      expected
    );

    const dest2 = hasDestinationSuggestions(turn2.output);
    log(`\n📊 Response: "${response}" → Destinations shown: ${dest2 ? '✅ YES' : '❌ NO'}`);

    testResults.push({
      suite: 4,
      variation: i + 1,
      confirmationPhrase: response,
      hasDestinations: dest2,
      passed: dest2,
      critical: false
    });

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  return { suite: 4 };
}

// ============================================================================
// TEST SUITE 5: Exception - Specific Destination (Bypass Confirmation)
// ============================================================================
async function testSpecificDestinationException() {
  log("\n\n📋 TEST SUITE 5: Specific Destination Exception");
  log("=" .repeat(80));
  log("Scenario: User asks about specific destination → Should bypass confirmation\n");

  const appContext = createEnhancedContext({ name: 'Test User', uid: 300 });
  let thread = [];

  const turn1 = await runTestTurn(
    "Suite 5",
    1,
    "Tell me about Tokyo",
    thread,
    appContext,
    "Should provide Tokyo insights immediately, NO confirmation needed"
  );

  const hasTokyo = /tokyo/i.test(turn1.output);
  const hasInfo = /best time|visa|attractions|culture|budget|transport/i.test(turn1.output);
  const conf1 = hasConfirmationRequest(turn1.output);

  log(`\n📊 Has Tokyo info: ${hasTokyo && hasInfo ? '✅ YES' : '❌ NO'} | Asks confirmation: ${conf1 ? '❌ YES (wrong)' : '✅ NO (correct)'}`);

  testResults.push({
    suite: 5,
    turn: 1,
    test: 'specific-destination-exception',
    hasDestinationInfo: hasTokyo && hasInfo,
    asksConfirmation: conf1,
    passed: hasTokyo && hasInfo && !conf1,
    critical: true
  });

  return { suite: 5 };
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================
async function runAllTests() {
  const startTime = Date.now();

  try {
    log("\n🚀 Starting Confirmation Step Tests");
    log("Testing NEW workflow: Slots filled → Confirmation → Destinations\n");

    const suite1 = await testProgressiveWithConfirmation();
    const suite2 = await testModificationBeforeConfirmation();
    const suite3 = await testUserDeclinesConfirmation();
    const suite4 = await testConfirmationVariations();
    const suite5 = await testSpecificDestinationException();

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

    log(`\n🔴 CRITICAL Confirmation Tests: ${criticalPassed}/${criticalTests.length} passed (${criticalRate}%)`);

    log(`\n📋 Test Suites:`);
    log(`  1. ✓ Progressive Slot Filling with Confirmation (3 turns)`);
    log(`  2. ✓ User Modifies Before Confirming (3 turns)`);
    log(`  3. ✓ User Declines Confirmation (2 turns)`);
    log(`  4. ✓ Confirmation Response Variations (5 variations)`);
    log(`  5. ✓ Specific Destination Exception (1 turn)`);

    const failedCritical = criticalTests.filter(t => !t.passed);
    if (failedCritical.length > 0) {
      log(`\n⚠️  FAILED CRITICAL TESTS:`);
      failedCritical.forEach(t => {
        log(`  ❌ Suite ${t.suite}, Turn ${t.turn || t.variation}: ${t.test}`);
        if (t.hasDestinations !== undefined) log(`     - Has destinations: ${t.hasDestinations} (should be ${t.suite === 1 && t.turn === 3 ? 'true' : 'false'})`);
        if (t.hasConfirmation !== undefined) log(`     - Has confirmation: ${t.hasConfirmation}`);
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFilePath = path.join(DATA_DIR, `confirmation-test-${timestamp}.log`);
    await fs.writeFile(logFilePath, allLogs.join('\n'), 'utf-8');
    log(`\n💾 Logs saved to: ${logFilePath}`);

    const resultsFilePath = path.join(DATA_DIR, `confirmation-results-${timestamp}.json`);
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
        { id: 1, name: 'Progressive with Confirmation', summary: suite1.summary },
        { id: 2, name: 'Modification Before Confirmation', summary: suite2.summary },
        { id: 3, name: 'User Declines Confirmation' },
        { id: 4, name: 'Confirmation Variations' },
        { id: 5, name: 'Specific Destination Exception' }
      ]
    }, null, 2), 'utf-8');
    log(`💾 Results saved to: ${resultsFilePath}`);

    log("\n" + "=".repeat(80));
    if (criticalRate >= 95) {
      log("🎉 EXCELLENT! Confirmation step working perfectly!");
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
    const errorLogPath = path.join(DATA_DIR, `confirmation-error-${timestamp}.log`);
    await fs.writeFile(errorLogPath, allLogs.join('\n') + '\n\nERROR:\n' + error.stack, 'utf-8');
    log(`\n💾 Error log saved to: ${errorLogPath}`);
  }
}

runAllTests().catch(console.error);
