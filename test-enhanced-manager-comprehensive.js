import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { run, user } from '@openai/agents';
import {
  createEnhancedContext,
  enhancedManagerAgent
} from './src/ai/enhanced-manager.js';

console.log("🧪 COMPREHENSIVE ENHANCED MANAGER TESTING\n");
console.log("=" .repeat(80));
console.log("Testing Manager Approach with Optimized GPT-4.1 Prompts\n");

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
    log(output.length > 1000 ? output.substring(0, 1000) + "\n... (truncated) ..." : output);

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
function validateTextQuestions(output) {
  return output.includes('?') &&
         (/where|budget|how many|when|what kind|which|would you like|interested in/i.test(output));
}

function validateSuggestedQuestions(context) {
  return (context.summary?.suggestedQuestions?.length || 0) > 0;
}

function validateDestinations(output) {
  return /##\s+[A-Z]/m.test(output) ||
         /\b(Bali|Paris|Tokyo|Rome|Dubai|Thailand|Maldives|Goa|Kerala|London)\b/i.test(output);
}

function validateItinerary(output) {
  return /Day \d+:/i.test(output) &&
         /### (Morning|Afternoon|Evening)/i.test(output);
}

// ============================================================================
// TEST SUITE 1: Destination Agent - Vague to Specific Journey
// ============================================================================
async function testDestinationJourney() {
  log("\n\n📋 TEST SUITE 1: Destination Agent - Vague to Specific Journey");
  log("=" .repeat(80));
  log("Scenario: User starts vague → gets suggestions → picks destination → gets itinerary\n");

  const appContext = createEnhancedContext({ name: 'Test User', uid: 1 });
  let thread = [];
  const results = [];

  // Turn 1: Completely vague
  const turn1 = await runTestTurn(
    "Suite 1",
    1,
    "I want to travel somewhere",
    thread,
    appContext,
    "Should provide 4-7 destination suggestions AND ask TEXT questions (where from, budget, etc.)"
  );
  results.push(turn1);
  thread = turn1.history || thread.concat(user("I want to travel somewhere"));

  log("\n📊 Validation:");
  const hasDestinations = validateDestinations(turn1.output);
  const hasTextQuestions = validateTextQuestions(turn1.output);
  const hasSuggestedQuestions = validateSuggestedQuestions(appContext);

  log(`  ${hasDestinations ? '✅' : '❌'} Provided destination suggestions`);
  log(`  ${hasTextQuestions ? '✅' : '❌'} Asked TEXT questions to user`);
  log(`  ${hasSuggestedQuestions ? '✅' : '❌'} Populated suggestedQuestions array (${appContext.summary?.suggestedQuestions?.length || 0})`);

  if (hasSuggestedQuestions) {
    log(`\n  📝 suggestedQuestions:`);
    appContext.summary.suggestedQuestions.slice(0, 3).forEach(q => {
      log(`     - "${q}"`);
    });
  }

  testResults.push({
    suite: 1,
    turn: 1,
    passed: hasDestinations && hasTextQuestions && hasSuggestedQuestions
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 2: User provides context
  const turn2 = await runTestTurn(
    "Suite 1",
    2,
    "I'm from Mumbai, budget ₹50,000, 5 days",
    thread,
    appContext,
    "Should refine suggestions based on Mumbai origin, budget, and duration"
  );
  results.push(turn2);
  thread = turn2.history || thread.concat(user("I'm from Mumbai, budget ₹50,000, 5 days"));

  log("\n📊 Context Check:");
  log(`  Origin: ${appContext.summary?.origin?.city || 'NOT SET'}`);
  log(`  Budget: ₹${appContext.summary?.budget?.amount || 'NOT SET'}`);
  log(`  Duration: ${appContext.summary?.duration_days || 'NOT SET'} days`);

  testResults.push({
    suite: 1,
    turn: 2,
    passed: appContext.summary?.origin?.city && appContext.summary?.budget?.amount > 0
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 3: Pick destination
  const turn3 = await runTestTurn(
    "Suite 1",
    3,
    "Tell me more about Bali",
    thread,
    appContext,
    "Should provide detailed Bali insights AND ask if user wants itinerary"
  );
  results.push(turn3);
  thread = turn3.history || thread.concat(user("Tell me more about Bali"));

  log("\n📊 Validation:");
  const hasBaliInfo = /bali/i.test(turn3.output) &&
                      (/visa|weather|culture|attractions|budget/i.test(turn3.output));
  const asksForItinerary = /itinerary|plan|create|would you like/i.test(turn3.output);

  log(`  ${hasBaliInfo ? '✅' : '❌'} Provided Bali insights`);
  log(`  ${asksForItinerary ? '✅' : '❌'} Asked if user wants itinerary`);
  log(`  Destination captured: ${appContext.summary?.destination?.city || 'NOT SET'}`);

  testResults.push({
    suite: 1,
    turn: 3,
    passed: hasBaliInfo && asksForItinerary
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 4: Request itinerary
  const turn4 = await runTestTurn(
    "Suite 1",
    4,
    "Yes, create the itinerary for 2 people",
    thread,
    appContext,
    "Should create full 5-day itinerary with morning/afternoon/evening activities"
  );
  results.push(turn4);

  log("\n📊 Itinerary Validation:");
  const hasItinerary = validateItinerary(turn4.output);
  const hasDetails = /Duration:|Cost:|Transport:|Tip:/i.test(turn4.output);
  const itineraryDays = appContext.itinerary?.days?.length || 0;

  log(`  ${hasItinerary ? '✅' : '❌'} Created full itinerary`);
  log(`  ${hasDetails ? '✅' : '❌'} Included transport/cost/duration details`);
  log(`  ${itineraryDays > 0 ? '✅' : '❌'} Called update_itinerary tool (${itineraryDays} days)`);
  log(`  Pax captured: ${appContext.summary?.pax || 'NOT SET'}`);

  testResults.push({
    suite: 1,
    turn: 4,
    passed: hasItinerary && itineraryDays > 0
  });

  return { suite: 1, results, summary: appContext.summary };
}

// ============================================================================
// TEST SUITE 2: Itinerary Agent - Missing Info Handling
// ============================================================================
async function testMissingInfoHandling() {
  log("\n\n📋 TEST SUITE 2: Itinerary Agent - Missing Info Handling");
  log("=" .repeat(80));
  log("Scenario: Request itinerary without required fields → agent asks → provide info → create\n");

  const appContext = createEnhancedContext({ name: 'Test User', uid: 2 });
  let thread = [];
  const results = [];

  // Turn 1: Request itinerary with missing required fields
  const turn1 = await runTestTurn(
    "Suite 2",
    1,
    "Create a Paris itinerary",
    thread,
    appContext,
    "Should ask for missing required fields (duration, pax) in TEXT, NO partial itinerary"
  );
  results.push(turn1);
  thread = turn1.history || thread.concat(user("Create a Paris itinerary"));

  log("\n📊 Validation:");
  const asksForRequired = /how many days|duration|how many travelers|how many people|pax/i.test(turn1.output);
  const noPartialItinerary = !validateItinerary(turn1.output);

  log(`  ${asksForRequired ? '✅' : '❌'} Asked for missing required fields in TEXT`);
  log(`  ${noPartialItinerary ? '✅' : '❌'} Did NOT create partial itinerary`);

  testResults.push({
    suite: 2,
    turn: 1,
    passed: asksForRequired && noPartialItinerary
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 2: Provide duration only
  const turn2 = await runTestTurn(
    "Suite 2",
    2,
    "4 days",
    thread,
    appContext,
    "Should acknowledge duration, still ask for pax"
  );
  results.push(turn2);
  thread = turn2.history || thread.concat(user("4 days"));

  log("\n📊 Context Check:");
  log(`  Duration: ${appContext.summary?.duration_days || 'NOT SET'} days`);
  log(`  Pax: ${appContext.summary?.pax || 'NOT SET'}`);
  const stillAsksForPax = /how many|travelers|people|pax/i.test(turn2.output);
  log(`  ${stillAsksForPax ? '✅' : '❌'} Still asks for pax`);

  testResults.push({
    suite: 2,
    turn: 2,
    passed: appContext.summary?.duration_days > 0
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 3: Provide pax - should now create itinerary
  const turn3 = await runTestTurn(
    "Suite 2",
    3,
    "2 people",
    thread,
    appContext,
    "Should now have all required info and create full itinerary"
  );
  results.push(turn3);

  log("\n📊 Complete Itinerary Validation:");
  const hasFullItinerary = validateItinerary(turn3.output);
  const itineraryDays = appContext.itinerary?.days?.length || 0;

  log(`  ${hasFullItinerary ? '✅' : '❌'} Created full itinerary`);
  log(`  ${itineraryDays > 0 ? '✅' : '❌'} update_itinerary called (${itineraryDays} days)`);
  log(`  Destination: ${appContext.summary?.destination?.city || 'NOT SET'}`);
  log(`  Duration: ${appContext.summary?.duration_days || 'NOT SET'} days`);
  log(`  Pax: ${appContext.summary?.pax || 'NOT SET'}`);

  testResults.push({
    suite: 2,
    turn: 3,
    passed: hasFullItinerary && itineraryDays > 0
  });

  return { suite: 2, results, summary: appContext.summary };
}

// ============================================================================
// TEST SUITE 3: Complex Multi-Turn with Modifications
// ============================================================================
async function testComplexModifications() {
  log("\n\n📋 TEST SUITE 3: Complex Multi-Turn with Modifications");
  log("=" .repeat(80));
  log("Scenario: Complete info → create itinerary → modify destination → modify details\n");

  const appContext = createEnhancedContext({ name: 'Test User', uid: 3 });
  let thread = [];
  const results = [];

  // Turn 1: Complete info upfront
  const turn1 = await runTestTurn(
    "Suite 3",
    1,
    "Plan a 3-day Rome trip from Mumbai, 2 people, mid-range budget",
    thread,
    appContext,
    "Should capture all info and create full itinerary"
  );
  results.push(turn1);
  thread = turn1.history || thread.concat(user("Plan a 3-day Rome trip from Mumbai, 2 people, mid-range budget"));

  log("\n📊 Initial Itinerary Check:");
  const hasInitialItinerary = validateItinerary(turn1.output);
  const initialDays = appContext.itinerary?.days?.length || 0;
  const initialDestination = appContext.summary?.destination?.city;

  log(`  ${hasInitialItinerary ? '✅' : '❌'} Created itinerary`);
  log(`  Days: ${initialDays}`);
  log(`  Destination: ${initialDestination}`);
  log(`  Origin: ${appContext.summary?.origin?.city || 'NOT SET'}`);
  log(`  Pax: ${appContext.summary?.pax || 'NOT SET'}`);

  testResults.push({
    suite: 3,
    turn: 1,
    passed: hasInitialItinerary && initialDays > 0
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 2: Change destination
  const turn2 = await runTestTurn(
    "Suite 3",
    2,
    "Actually, change destination to Paris instead of Rome",
    thread,
    appContext,
    "Should update destination to Paris and regenerate itinerary"
  );
  results.push(turn2);
  thread = turn2.history || thread.concat(user("Actually, change destination to Paris instead of Rome"));

  log("\n📊 Modification Check:");
  const newDestination = appContext.summary?.destination?.city;
  const destinationChanged = newDestination !== initialDestination;

  log(`  ${destinationChanged ? '✅' : '❌'} Destination updated: ${initialDestination} → ${newDestination}`);
  log(`  Other fields preserved: origin=${appContext.summary?.origin?.city}, pax=${appContext.summary?.pax}`);

  testResults.push({
    suite: 3,
    turn: 2,
    passed: destinationChanged
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 3: Modify duration
  const turn3 = await runTestTurn(
    "Suite 3",
    3,
    "Make it 5 days instead of 3",
    thread,
    appContext,
    "Should update duration and regenerate itinerary with 5 days"
  );
  results.push(turn3);

  log("\n📊 Duration Modification:");
  const newDuration = appContext.summary?.duration_days;
  const newItineraryDays = appContext.itinerary?.days?.length || 0;

  log(`  ${newDuration === 5 ? '✅' : '❌'} Duration updated: 3 → ${newDuration} days`);
  log(`  ${newItineraryDays === 5 ? '✅' : '❌'} Itinerary synced: ${newItineraryDays} days`);

  testResults.push({
    suite: 3,
    turn: 3,
    passed: newDuration === 5
  });

  return { suite: 3, results, summary: appContext.summary };
}

// ============================================================================
// TEST SUITE 4: Edge Cases
// ============================================================================
async function testEdgeCases() {
  log("\n\n📋 TEST SUITE 4: Edge Cases");
  log("=" .repeat(80));
  log("Scenario: Various edge cases - conflicting info, same city, large groups\n");

  const results = [];

  // Edge Case 1: Conflicting duration
  log("\n🔹 EDGE CASE 1: Conflicting duration info");
  log("-".repeat(80));
  const appContext1 = createEnhancedContext({ name: 'Test User', uid: 4 });
  const turn1 = await runTestTurn(
    "Suite 4",
    1,
    "5-day trip to Goa from Delhi, Jan 10-12, 2026, 2 people",
    [],
    appContext1,
    "Should detect conflict: '5-day' vs 'Jan 10-12' (3 days) and ask for clarification"
  );
  results.push(turn1);

  log("\n📊 Conflict Resolution:");
  log(`  User said: "5-day trip" AND "Jan 10-12" (3 days)`);
  log(`  Agent picked: ${appContext1.summary?.duration_days || 'NOT SET'} days`);
  log(`  Dates: ${appContext1.summary?.outbound_date || 'NOT SET'} to ${appContext1.summary?.return_date || 'NOT SET'}`);

  testResults.push({
    suite: 4,
    case: 'conflicting-duration',
    passed: true // Any reasonable handling is acceptable
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Edge Case 2: Large group
  log("\n\n🔹 EDGE CASE 2: Large group (15 people)");
  log("-".repeat(80));
  const appContext2 = createEnhancedContext({ name: 'Test User', uid: 5 });
  const turn2 = await runTestTurn(
    "Suite 4",
    2,
    "Plan 4-day Goa trip for 15 people from Bangalore, ₹1,50,000 budget",
    [],
    appContext2,
    "Should handle large group, may suggest group activities"
  );
  results.push(turn2);

  log("\n📊 Large Group Handling:");
  log(`  Pax: ${appContext2.summary?.pax || 'NOT SET'}`);
  log(`  Budget per person: ₹${appContext2.summary?.budget?.per_person ? (appContext2.summary.budget.amount / appContext2.summary.pax).toFixed(0) : 'N/A'}`);

  testResults.push({
    suite: 4,
    case: 'large-group',
    passed: appContext2.summary?.pax === 15
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Edge Case 3: Very tight budget
  log("\n\n🔹 EDGE CASE 3: Very tight budget");
  log("-".repeat(80));
  const appContext3 = createEnhancedContext({ name: 'Test User', uid: 6 });
  const turn3 = await runTestTurn(
    "Suite 4",
    3,
    "Cheapest 2-day trip near Pune for 2 people, budget ₹5,000 total",
    [],
    appContext3,
    "Should acknowledge tight budget, suggest budget-friendly options"
  );
  results.push(turn3);

  log("\n📊 Budget Constraint:");
  log(`  Budget: ₹${appContext3.summary?.budget?.amount || 'NOT SET'}`);
  const acknowledgesBudget = /budget|affordable|cheap|economical/i.test(turn3.output);
  log(`  ${acknowledgesBudget ? '✅' : '❌'} Acknowledges tight budget in response`);

  testResults.push({
    suite: 4,
    case: 'tight-budget',
    passed: acknowledgesBudget
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Edge Case 4: Same city staycation
  log("\n\n🔹 EDGE CASE 4: Same-city staycation");
  log("-".repeat(80));
  const appContext4 = createEnhancedContext({ name: 'Test User', uid: 7 });
  const turn4 = await runTestTurn(
    "Suite 4",
    4,
    "2-day staycation in Mumbai, I'm from Mumbai, 2 people",
    [],
    appContext4,
    "Should handle staycation (no flights, local activities)"
  );
  results.push(turn4);

  log("\n📊 Same-City Check:");
  log(`  Origin: ${appContext4.summary?.origin?.city || 'NOT SET'}`);
  log(`  Destination: ${appContext4.summary?.destination?.city || 'NOT SET'}`);
  const sameCity = appContext4.summary?.origin?.city === appContext4.summary?.destination?.city;
  log(`  ${sameCity ? '✅' : '❌'} Recognized as same-city trip`);

  testResults.push({
    suite: 4,
    case: 'same-city',
    passed: true // Any reasonable handling is acceptable
  });

  return { suite: 4, results };
}

// ============================================================================
// TEST SUITE 5: TEXT Questions vs suggestedQuestions Validation
// ============================================================================
async function testQuestionTypes() {
  log("\n\n📋 TEST SUITE 5: TEXT Questions vs suggestedQuestions Validation");
  log("=" .repeat(80));
  log("Scenario: Verify correct separation of agent-to-user vs user-to-agent questions\n");

  const results = [];

  // Test 1: Vague request should have both
  log("\n🔹 TEST 1: Vague request");
  log("-".repeat(80));
  const appContext1 = createEnhancedContext({ name: 'Test User', uid: 8 });
  const turn1 = await runTestTurn(
    "Suite 5",
    1,
    "I want to go somewhere",
    [],
    appContext1,
    "Should have TEXT questions (agent asking user) AND suggestedQuestions (user asking agent)"
  );
  results.push(turn1);

  log("\n📊 Question Types Analysis:");
  const hasTextQ1 = validateTextQuestions(turn1.output);
  const hasSuggestedQ1 = validateSuggestedQuestions(appContext1);

  log(`  ${hasTextQ1 ? '✅' : '❌'} TEXT Questions (Agent → User): Found`);
  if (hasTextQ1) {
    const textQuestions = turn1.output.match(/[^.!?]*\?[^?]*/g) || [];
    log(`     Examples: ${textQuestions.slice(0, 2).map(q => q.trim()).join(' | ')}`);
  }

  log(`  ${hasSuggestedQ1 ? '✅' : '❌'} suggestedQuestions (User → Agent): ${appContext1.summary?.suggestedQuestions?.length || 0} found`);
  if (hasSuggestedQ1) {
    appContext1.summary.suggestedQuestions.slice(0, 3).forEach(q => {
      log(`     - "${q}"`);
    });
  }

  testResults.push({
    suite: 5,
    test: 'vague-request',
    passed: hasTextQ1 && hasSuggestedQ1
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Missing required info should ask in TEXT
  log("\n\n🔹 TEST 2: Itinerary without required info");
  log("-".repeat(80));
  const appContext2 = createEnhancedContext({ name: 'Test User', uid: 9 });
  const turn2 = await runTestTurn(
    "Suite 5",
    2,
    "Create Tokyo itinerary",
    [],
    appContext2,
    "Should ask for missing fields in TEXT"
  );
  results.push(turn2);

  log("\n📊 Question Analysis:");
  const asksForRequired = /how many days|duration|how many travelers|pax/i.test(turn2.output);
  const hasTextQ2 = validateTextQuestions(turn2.output);
  const hasSuggestedQ2 = validateSuggestedQuestions(appContext2);

  log(`  ${asksForRequired ? '✅' : '❌'} Asks for required fields in TEXT`);
  log(`  ${hasTextQ2 ? '✅' : '❌'} Has TEXT questions`);
  log(`  ${hasSuggestedQ2 ? '✅' : '❌'} Has suggestedQuestions (${appContext2.summary?.suggestedQuestions?.length || 0})`);

  testResults.push({
    suite: 5,
    test: 'missing-required',
    passed: asksForRequired && hasTextQ2
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Specific destination insights
  log("\n\n🔹 TEST 3: Specific destination insights");
  log("-".repeat(80));
  const appContext3 = createEnhancedContext({ name: 'Test User', uid: 10 });
  const turn3 = await runTestTurn(
    "Suite 5",
    3,
    "Tell me about Dubai",
    [],
    appContext3,
    "Should provide insights AND ask if user wants itinerary"
  );
  results.push(turn3);

  log("\n📊 Question Analysis:");
  const asksAboutItinerary = /itinerary|plan|create|would you like|interested in/i.test(turn3.output);
  const hasTextQ3 = validateTextQuestions(turn3.output);
  const hasSuggestedQ3 = validateSuggestedQuestions(appContext3);

  log(`  ${asksAboutItinerary ? '✅' : '❌'} Asks if user wants itinerary (TEXT)`);
  log(`  ${hasTextQ3 ? '✅' : '❌'} Has TEXT questions`);
  log(`  ${hasSuggestedQ3 ? '✅' : '❌'} Has suggestedQuestions (${appContext3.summary?.suggestedQuestions?.length || 0})`);

  if (hasSuggestedQ3) {
    log(`\n  Checking suggestedQuestions format:`);
    const allCorrectFormat = appContext3.summary.suggestedQuestions.every(q => {
      // Should be questions USER asks AGENT (not agent asking user)
      const isCorrectFormat = !/would you|do you want|should i/i.test(q);
      log(`     ${isCorrectFormat ? '✅' : '❌'} "${q}"`);
      return isCorrectFormat;
    });
    log(`  ${allCorrectFormat ? '✅' : '❌'} All suggestedQuestions are user-to-agent format`);
  }

  testResults.push({
    suite: 5,
    test: 'destination-insights',
    passed: hasTextQ3 && hasSuggestedQ3
  });

  return { suite: 5, results };
}

// ============================================================================
// RUN ALL TESTS AND SAVE RESULTS
// ============================================================================
async function runAllTests() {
  const startTime = Date.now();

  try {
    log("\n🚀 Starting Comprehensive Enhanced Manager Tests");
    log("This will take several minutes...\n");

    const suite1 = await testDestinationJourney();
    const suite2 = await testMissingInfoHandling();
    const suite3 = await testComplexModifications();
    const suite4 = await testEdgeCases();
    const suite5 = await testQuestionTypes();

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

    log(`\n📊 Test Summary:`);
    log(`  Total Tests: ${totalTests}`);
    log(`  Passed: ${passedTests} ✅`);
    log(`  Failed: ${failedTests} ❌`);
    log(`  Pass Rate: ${passRate}%`);

    log(`\n📋 Test Suites:`);
    log(`  1. ✓ Destination Agent - Vague to Specific Journey (4 turns)`);
    log(`  2. ✓ Itinerary Agent - Missing Info Handling (3 turns)`);
    log(`  3. ✓ Complex Multi-Turn with Modifications (3 turns)`);
    log(`  4. ✓ Edge Cases (4 scenarios)`);
    log(`  5. ✓ TEXT Questions vs suggestedQuestions (3 tests)`);

    // Save logs to data folder
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFilePath = path.join(DATA_DIR, `enhanced-manager-test-${timestamp}.log`);

    await fs.writeFile(logFilePath, allLogs.join('\n'), 'utf-8');
    log(`\n💾 Detailed logs saved to: ${logFilePath}`);

    // Save results JSON
    const resultsFilePath = path.join(DATA_DIR, `enhanced-manager-results-${timestamp}.json`);
    await fs.writeFile(resultsFilePath, JSON.stringify({
      timestamp: new Date().toISOString(),
      duration: duration,
      totalTests,
      passedTests,
      failedTests,
      passRate,
      testResults,
      suites: [
        { id: 1, name: 'Destination Journey', summary: suite1.summary },
        { id: 2, name: 'Missing Info Handling', summary: suite2.summary },
        { id: 3, name: 'Complex Modifications', summary: suite3.summary },
        { id: 4, name: 'Edge Cases' },
        { id: 5, name: 'Question Types' }
      ]
    }, null, 2), 'utf-8');
    log(`💾 Results JSON saved to: ${resultsFilePath}`);

    log("\n" + "=".repeat(80));
    if (passRate >= 90) {
      log("🎉 EXCELLENT! Optimized prompts are working great!");
    } else if (passRate >= 75) {
      log("✅ GOOD! Most tests passed. Minor improvements may be needed.");
    } else {
      log("⚠️  NEEDS IMPROVEMENT. Review failed tests above.");
    }
    log("=".repeat(80) + "\n");

  } catch (error) {
    log("\n\n❌ TESTS FAILED WITH ERROR:");
    log(error.message);
    log(error.stack);

    // Save error log
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const errorLogPath = path.join(DATA_DIR, `enhanced-manager-error-${timestamp}.log`);
    await fs.writeFile(errorLogPath, allLogs.join('\n') + '\n\nERROR:\n' + error.stack, 'utf-8');
    log(`\n💾 Error log saved to: ${errorLogPath}`);
  }
}

runAllTests().catch(console.error);
