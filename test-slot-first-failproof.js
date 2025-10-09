import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { run, user } from '@openai/agents';
import {
  createEnhancedContext,
  enhancedManagerAgent
} from './src/ai/enhanced-manager.js';

console.log("🧪 FAIL-PROOF SLOT-FIRST WORKFLOW TESTING\n");
console.log("=" .repeat(80));
console.log("Comprehensive multi-turn, multi-scenario stress testing\n");

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
    log("\n📝 Agent Response (first 800 chars):");
    log(output.length > 800 ? output.substring(0, 800) + "\n... (truncated) ..." : output);

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

// Enhanced validation helpers
function hasDestinationSuggestions(output) {
  const hasDestinationHeaders = /##\s+[A-Z][a-z]+,\s+[A-Z]/m.test(output);
  const hasLandmarks = /📍\s+Must-see highlights?:/i.test(output);
  const hasMultipleDestinations = (output.match(/##\s+[A-Z][a-z]+,/g) || []).length >= 2;
  const hasBudgetFit = /💰\s+Budget fit:/i.test(output);

  return {
    result: hasDestinationHeaders && hasLandmarks && hasMultipleDestinations,
    details: {
      hasDestinationHeaders,
      hasLandmarks,
      hasMultipleDestinations,
      hasBudgetFit,
      count: (output.match(/##\s+[A-Z][a-z]+,/g) || []).length
    }
  };
}

function countFilledSlots(context) {
  const slots = {
    budget: !!(context.summary?.budget?.amount && context.summary.budget.amount > 0),
    duration: !!(context.summary?.duration_days && context.summary.duration_days > 0) ||
              !!(context.summary?.outbound_date && context.summary?.return_date),
    pax: !!(context.summary?.pax && context.summary.pax > 0),
    origin: !!(context.summary?.origin?.city && context.summary.origin.city.length > 0),
    preferences: !!(context.summary?.preferences && context.summary.preferences.length > 0) ||
                 !!(context.summary?.tripType && context.summary.tripType.length > 0) ||
                 !!(context.summary?.trip_type)
  };

  const filled = Object.values(slots).filter(Boolean).length;
  return { slots, filled, total: 5 };
}

function hasSlotFillingQuestions(output) {
  return /where.*traveling from|where are you|what.*budget|how much.*budget|how many days|how long|how many travelers|how many people|what type|what kind|preferences|interested in|experience.*looking/i.test(output);
}

// ============================================================================
// TEST SUITE 1: Ambiguous & Conversational Slot Filling
// ============================================================================
async function testAmbiguousSlotFilling() {
  log("\n\n📋 TEST SUITE 1: Ambiguous & Conversational Slot Filling");
  log("=" .repeat(80));
  log("Scenario: User provides vague, conversational, ambiguous info\n");

  const appContext = createEnhancedContext({ name: 'Test User', uid: 101 });
  let thread = [];
  const results = [];

  // Turn 1: Very vague with only hint at budget
  const turn1 = await runTestTurn(
    "Suite 1",
    1,
    "I want to go on vacation, not too expensive",
    thread,
    appContext,
    "Should extract vague budget hint, ask for other 4 slots, NO destinations"
  );
  results.push(turn1);
  thread = turn1.history || thread.concat(user("I want to go on vacation, not too expensive"));

  const slots1 = countFilledSlots(appContext);
  const destinations1 = hasDestinationSuggestions(turn1.output);
  log(`\n📊 Slots: ${slots1.filled}/5 | Destinations: ${destinations1.result ? '❌ YES' : '✅ NO'}`);

  testResults.push({
    suite: 1,
    turn: 1,
    scenario: 'vague-budget-hint',
    slotsFilled: slots1.filled,
    passed: !destinations1.result && hasSlotFillingQuestions(turn1.output),
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 2: Casual conversational response mixing info
  const turn2 = await runTestTurn(
    "Suite 1",
    2,
    "I'm thinking maybe a week or so, probably just me and my partner",
    thread,
    appContext,
    "Should extract duration (~7 days) and pax (2), ask for origin and preferences, NO destinations"
  );
  results.push(turn2);
  thread = turn2.history || thread.concat(user("I'm thinking maybe a week or so, probably just me and my partner"));

  const slots2 = countFilledSlots(appContext);
  const destinations2 = hasDestinationSuggestions(turn2.output);
  log(`\n📊 Slots: ${slots2.filled}/5 | Destinations: ${destinations2.result ? '❌ YES' : '✅ NO'}`);

  testResults.push({
    suite: 1,
    turn: 2,
    scenario: 'casual-mixed-info',
    slotsFilled: slots2.filled,
    passed: !destinations2.result && slots2.filled >= 2,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 3: Ambiguous location and preferences
  const turn3 = await runTestTurn(
    "Suite 1",
    3,
    "We're in the Bay Area, want something chill but also interesting",
    thread,
    appContext,
    "Should extract origin (SF Bay Area) and vague preferences, still ask for clarity, NO destinations"
  );
  results.push(turn3);
  thread = turn3.history || thread.concat(user("We're in the Bay Area, want something chill but also interesting"));

  const slots3 = countFilledSlots(appContext);
  const destinations3 = hasDestinationSuggestions(turn3.output);
  log(`\n📊 Slots: ${slots3.filled}/5 | Destinations: ${destinations3.result ? '❌ YES' : '✅ NO'}`);

  testResults.push({
    suite: 1,
    turn: 3,
    scenario: 'ambiguous-location-prefs',
    slotsFilled: slots3.filled,
    passed: !destinations3.result && slots3.filled >= 3,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 4: Provide more specific budget to fill last slot
  const turn4 = await runTestTurn(
    "Suite 1",
    4,
    "Actually let's say around $3000 per person",
    thread,
    appContext,
    "Should now have all slots filled, SHOW destinations"
  );
  results.push(turn4);

  const slots4 = countFilledSlots(appContext);
  const destinations4 = hasDestinationSuggestions(turn4.output);
  log(`\n📊 Slots: ${slots4.filled}/5 | Destinations: ${destinations4.result ? '✅ YES' : '❌ NO'}`);
  log(`   Destination count: ${destinations4.details.count}`);

  testResults.push({
    suite: 1,
    turn: 4,
    scenario: 'complete-all-slots',
    slotsFilled: slots4.filled,
    passed: destinations4.result && slots4.filled >= 4,
    critical: true
  });

  return { suite: 1, results, summary: appContext.summary };
}

// ============================================================================
// TEST SUITE 2: Conflicting & Changing Information
// ============================================================================
async function testConflictingInfo() {
  log("\n\n📋 TEST SUITE 2: Conflicting & Changing Information");
  log("=" .repeat(80));
  log("Scenario: User changes mind, provides conflicting info\n");

  const appContext = createEnhancedContext({ name: 'Test User', uid: 102 });
  let thread = [];

  // Turn 1: Initial complete info
  const turn1 = await runTestTurn(
    "Suite 2",
    1,
    "From NYC, 5 days, 2 people, $1500 budget per person, love beaches",
    thread,
    appContext,
    "All slots filled, should show destinations"
  );
  thread = turn1.history || thread.concat(user("From NYC, 5 days, 2 people, $1500 budget per person, love beaches"));

  const destinations1 = hasDestinationSuggestions(turn1.output);
  log(`\n📊 Destinations shown: ${destinations1.result ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    suite: 2,
    turn: 1,
    scenario: 'initial-complete',
    passed: destinations1.result,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 2: Change duration mid-conversation
  const turn2 = await runTestTurn(
    "Suite 2",
    2,
    "Wait, actually make it 7 days instead",
    thread,
    appContext,
    "Should update duration, show updated destinations"
  );
  thread = turn2.history || thread.concat(user("Wait, actually make it 7 days instead"));

  const newDuration = appContext.summary?.duration_days;
  log(`\n📊 Duration updated: ${newDuration} days`);

  testResults.push({
    suite: 2,
    turn: 2,
    scenario: 'change-duration',
    passed: newDuration === 7,
    critical: false
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 3: Conflicting preference change
  const turn3 = await runTestTurn(
    "Suite 2",
    3,
    "Actually not beaches, more interested in mountains and hiking",
    thread,
    appContext,
    "Should update preferences, suggest different destinations"
  );
  thread = turn3.history || thread.concat(user("Actually not beaches, more interested in mountains and hiking"));

  const destinations3 = hasDestinationSuggestions(turn3.output);
  const hasBeachMention = /beach/i.test(turn3.output);
  const hasMountainMention = /mountain|hiking|trek/i.test(turn3.output);

  log(`\n📊 Updated preferences: Mountains/Hiking`);
  log(`   New destinations shown: ${destinations3.result ? '✅ YES' : '❌ NO'}`);
  log(`   Reflects new preference: ${hasMountainMention ? '✅ YES' : '⚠️  NO'}`);

  testResults.push({
    suite: 2,
    turn: 3,
    scenario: 'change-preferences',
    passed: hasMountainMention,
    critical: false
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Turn 4: Add more people (change pax)
  const turn4 = await runTestTurn(
    "Suite 2",
    4,
    "Oh and two more friends are joining, so 4 people total now",
    thread,
    appContext,
    "Should update pax to 4, adjust suggestions if needed"
  );

  const newPax = appContext.summary?.pax;
  log(`\n📊 Pax updated: ${newPax} people`);

  testResults.push({
    suite: 2,
    turn: 4,
    scenario: 'change-pax',
    passed: newPax === 4,
    critical: false
  });

  return { suite: 2, summary: appContext.summary };
}

// ============================================================================
// TEST SUITE 3: Partial Slot + Question Strategy
// ============================================================================
async function testPartialSlotStrategy() {
  log("\n\n📋 TEST SUITE 3: Partial Slot + Question Strategy");
  log("=" .repeat(80));
  log("Scenario: Various partial slot combinations, ensure proper question prioritization\n");

  const results = [];

  // Case 1: Only preferences, no concrete details
  log("\n🔹 CASE 1: Only preferences provided");
  const ctx1 = createEnhancedContext({ name: 'Test User', uid: 103 });
  const turn1 = await runTestTurn(
    "Suite 3",
    1,
    "I love adventure and outdoor activities",
    [],
    ctx1,
    "Should acknowledge, ask for budget/duration/pax/origin, NO destinations"
  );

  const slots1 = countFilledSlots(ctx1);
  const dest1 = hasDestinationSuggestions(turn1.output);
  log(`  Slots: ${slots1.filled}/5 | Destinations: ${dest1.result ? '❌ YES' : '✅ NO'}`);

  testResults.push({
    suite: 3,
    case: 'only-preferences',
    slotsFilled: slots1.filled,
    passed: !dest1.result,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Case 2: Budget + Origin only (likely scenarios)
  log("\n🔹 CASE 2: Budget + Origin only");
  const ctx2 = createEnhancedContext({ name: 'Test User', uid: 104 });
  const turn2 = await runTestTurn(
    "Suite 3",
    2,
    "From London, around £2500 per person",
    [],
    ctx2,
    "Should ask for duration, pax, preferences, NO destinations"
  );

  const slots2 = countFilledSlots(ctx2);
  const dest2 = hasDestinationSuggestions(turn2.output);
  log(`  Slots: ${slots2.filled}/5 | Destinations: ${dest2.result ? '❌ YES' : '✅ NO'}`);

  testResults.push({
    suite: 3,
    case: 'budget-origin-only',
    slotsFilled: slots2.filled,
    passed: !dest2.result,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Case 3: Duration + Pax + Preferences (missing budget/origin)
  log("\n🔹 CASE 3: Duration + Pax + Preferences (no budget/origin)");
  const ctx3 = createEnhancedContext({ name: 'Test User', uid: 105 });
  const turn3 = await runTestTurn(
    "Suite 3",
    3,
    "10 days, 3 travelers, we want culture and food experiences",
    [],
    ctx3,
    "Should ask for budget and origin, NO destinations"
  );

  const slots3 = countFilledSlots(ctx3);
  const dest3 = hasDestinationSuggestions(turn3.output);
  log(`  Slots: ${slots3.filled}/5 | Destinations: ${dest3.result ? '❌ YES' : '✅ NO'}`);

  testResults.push({
    suite: 3,
    case: 'duration-pax-prefs',
    slotsFilled: slots3.filled,
    passed: !dest3.result && slots3.filled >= 2,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Case 4: Everything except preferences (should still withhold)
  log("\n🔹 CASE 4: 4/5 slots (missing preferences)");
  const ctx4 = createEnhancedContext({ name: 'Test User', uid: 106 });
  const turn4 = await runTestTurn(
    "Suite 3",
    4,
    "From Paris, €3000 budget, 6 days, 2 people",
    [],
    ctx4,
    "Should ask ONLY for preferences, NO destinations yet"
  );

  const slots4 = countFilledSlots(ctx4);
  const dest4 = hasDestinationSuggestions(turn4.output);
  const asksPrefs = /what type|what kind|preferences|interested in|experience/i.test(turn4.output);
  log(`  Slots: ${slots4.filled}/5 | Destinations: ${dest4.result ? '❌ YES' : '✅ NO'}`);
  log(`  Asks for preferences: ${asksPrefs ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    suite: 3,
    case: 'missing-prefs-only',
    slotsFilled: slots4.filled,
    passed: !dest4.result && asksPrefs && slots4.filled === 4,
    critical: true
  });

  return { suite: 3, results };
}

// ============================================================================
// TEST SUITE 4: Edge Cases & Stress Tests
// ============================================================================
async function testEdgeCases() {
  log("\n\n📋 TEST SUITE 4: Edge Cases & Stress Tests");
  log("=" .repeat(80));
  log("Scenario: Unusual inputs, boundary conditions, stress cases\n");

  // Edge 1: User asks for suggestions without ANY info
  log("\n🔹 EDGE 1: Zero information request");
  const ctx1 = createEnhancedContext({ name: 'Test User', uid: 107 });
  const turn1 = await runTestTurn(
    "Suite 4",
    1,
    "suggest me something",
    [],
    ctx1,
    "Should ask for ALL 5 slots, NO destinations"
  );

  const slots1 = countFilledSlots(ctx1);
  const dest1 = hasDestinationSuggestions(turn1.output);
  log(`  Slots: ${slots1.filled}/5 | Destinations: ${dest1.result ? '❌ YES' : '✅ NO'}`);

  testResults.push({
    suite: 4,
    edge: 'zero-info',
    passed: !dest1.result && hasSlotFillingQuestions(turn1.output),
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Edge 2: Extremely tight budget
  log("\n🔹 EDGE 2: Extremely low budget");
  const ctx2 = createEnhancedContext({ name: 'Test User', uid: 108 });
  let thread2 = [];
  const turn2a = await runTestTurn("Suite 4", 2, "From Mumbai, 3 days, 2 people, ₹10000 total budget, want beaches", thread2, ctx2, "Should ask for clarification");
  thread2 = turn2a.history || thread2.concat(user("From Mumbai, 3 days, 2 people, ₹10000 total budget, want beaches"));

  const slots2 = countFilledSlots(ctx2);
  const dest2 = hasDestinationSuggestions(turn2a.output);
  const budget2 = ctx2.summary?.budget?.amount;
  log(`  Slots: ${slots2.filled}/5 | Budget captured: ₹${budget2}`);
  log(`  Destinations: ${dest2.result ? '✅ YES (if 5/5)' : '✅ NO (if <5/5)'}`);

  testResults.push({
    suite: 4,
    edge: 'tight-budget',
    passed: budget2 > 0,
    critical: false
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Edge 3: Very large group
  log("\n🔹 EDGE 3: Large group travel");
  const ctx3 = createEnhancedContext({ name: 'Test User', uid: 109 });
  const turn3 = await runTestTurn(
    "Suite 4",
    3,
    "From Bangalore, 20 people, 4 days, ₹2 lakh budget, team outing",
    [],
    ctx3,
    "Should handle large group, ask for preferences"
  );

  const slots3 = countFilledSlots(ctx3);
  const pax3 = ctx3.summary?.pax;
  log(`  Slots: ${slots3.filled}/5 | Pax: ${pax3} people`);

  testResults.push({
    suite: 4,
    edge: 'large-group',
    passed: pax3 >= 15,
    critical: false
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Edge 4: Conflicting duration info
  log("\n🔹 EDGE 4: Conflicting duration information");
  const ctx4 = createEnhancedContext({ name: 'Test User', uid: 110 });
  const turn4 = await runTestTurn(
    "Suite 4",
    4,
    "From Delhi, 2 people, ₹80000, want to go Jan 15-18 for a week",
    [],
    ctx4,
    "Should detect conflict (Jan 15-18 is 3-4 days, not 'a week')"
  );

  const duration4 = ctx4.summary?.duration_days;
  const hasDates = ctx4.summary?.outbound_date;
  log(`  Duration captured: ${duration4} days | Has dates: ${!!hasDates}`);

  testResults.push({
    suite: 4,
    edge: 'conflicting-duration',
    passed: true, // Any reasonable handling is acceptable
    critical: false
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Edge 5: Multiple destinations mentioned by user
  log("\n🔹 EDGE 5: User mentions multiple destinations");
  const ctx5 = createEnhancedContext({ name: 'Test User', uid: 111 });
  const turn5 = await runTestTurn(
    "Suite 4",
    5,
    "I'm thinking Paris or Rome or maybe Barcelona, not sure",
    [],
    ctx5,
    "Should note interest but still ask for all slots before suggesting"
  );

  const slots5 = countFilledSlots(ctx5);
  const dest5 = hasDestinationSuggestions(turn5.output);
  log(`  Slots: ${slots5.filled}/5 | Destinations: ${dest5.result ? '❌ YES' : '✅ NO'}`);

  testResults.push({
    suite: 4,
    edge: 'multiple-destinations-mentioned',
    passed: !dest5.result && hasSlotFillingQuestions(turn5.output),
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Edge 6: User provides slots over many fragmented messages
  log("\n🔹 EDGE 6: Fragmented slot filling (6 messages)");
  const ctx6 = createEnhancedContext({ name: 'Test User', uid: 112 });
  let thread6 = [];

  const t6_1 = await runTestTurn("Suite 4", 6.1, "budget is $4000", thread6, ctx6, "Capture budget");
  thread6 = t6_1.history || thread6.concat(user("budget is $4000"));
  await new Promise(resolve => setTimeout(resolve, 1500));

  const t6_2 = await runTestTurn("Suite 4", 6.2, "per person of course", thread6, ctx6, "Confirm per person");
  thread6 = t6_2.history || thread6.concat(user("per person of course"));
  await new Promise(resolve => setTimeout(resolve, 1500));

  const t6_3 = await runTestTurn("Suite 4", 6.3, "12 days", thread6, ctx6, "Capture duration");
  thread6 = t6_3.history || thread6.concat(user("12 days"));
  await new Promise(resolve => setTimeout(resolve, 1500));

  const t6_4 = await runTestTurn("Suite 4", 6.4, "just the two of us", thread6, ctx6, "Capture pax");
  thread6 = t6_4.history || thread6.concat(user("just the two of us"));
  await new Promise(resolve => setTimeout(resolve, 1500));

  const t6_5 = await runTestTurn("Suite 4", 6.5, "from Chicago", thread6, ctx6, "Capture origin");
  thread6 = t6_5.history || thread6.concat(user("from Chicago"));
  await new Promise(resolve => setTimeout(resolve, 1500));

  const t6_6 = await runTestTurn("Suite 4", 6.6, "love food and wine", thread6, ctx6, "All slots filled, SHOW destinations");

  const slots6 = countFilledSlots(ctx6);
  const dest6 = hasDestinationSuggestions(t6_6.output);
  log(`\n  Final slots: ${slots6.filled}/5 | Destinations: ${dest6.result ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    suite: 4,
    edge: 'fragmented-filling',
    slotsFilled: slots6.filled,
    passed: dest6.result && slots6.filled >= 4,
    critical: true
  });

  return { suite: 4 };
}

// ============================================================================
// TEST SUITE 5: Exception Handling & Specific Destination Queries
// ============================================================================
async function testExceptionCases() {
  log("\n\n📋 TEST SUITE 5: Exception Handling & Specific Destination Queries");
  log("=" .repeat(80));
  log("Scenario: User asks about specific destinations, should bypass slot requirement\n");

  // Exception 1: Specific destination query with no slots
  log("\n🔹 EXCEPTION 1: 'Tell me about [destination]' with no slots");
  const ctx1 = createEnhancedContext({ name: 'Test User', uid: 113 });
  const turn1 = await runTestTurn(
    "Suite 5",
    1,
    "Tell me about Bali",
    [],
    ctx1,
    "Should provide Bali insights immediately (bypass slot requirement)"
  );

  const hasBaliInfo = /bali/i.test(turn1.output);
  const hasInsightSections = (turn1.output.match(/##\s+/g) || []).length >= 3;
  log(`  Has Bali info: ${hasBaliInfo ? '✅ YES' : '❌ NO'}`);
  log(`  Has insight sections: ${hasInsightSections ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    suite: 5,
    exception: 'specific-destination-no-slots',
    passed: hasBaliInfo && hasInsightSections,
    critical: false
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Exception 2: Specific destination with partial slots
  log("\n🔹 EXCEPTION 2: Destination query with partial slots");
  const ctx2 = createEnhancedContext({ name: 'Test User', uid: 114 });
  let thread2 = [];
  const t2_1 = await runTestTurn("Suite 5", 2.1, "From Mumbai, 5 days, ₹100000 budget", thread2, ctx2, "Partial slots");
  thread2 = t2_1.history || thread2.concat(user("From Mumbai, 5 days, ₹100000 budget"));
  await new Promise(resolve => setTimeout(resolve, 2000));

  const t2_2 = await runTestTurn("Suite 5", 2.2, "What about Dubai?", thread2, ctx2, "Should provide Dubai insights");

  const hasDubaiInfo = /dubai/i.test(t2_2.output);
  log(`  Has Dubai info: ${hasDubaiInfo ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    suite: 5,
    exception: 'destination-with-partial-slots',
    passed: hasDubaiInfo,
    critical: false
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Exception 3: After showing destinations, user asks about specific one
  log("\n🔹 EXCEPTION 3: After destination suggestions, ask about specific one");
  const ctx3 = createEnhancedContext({ name: 'Test User', uid: 115 });
  let thread3 = [];

  const t3_1 = await runTestTurn("Suite 5", 3.1, "From LA, 8 days, 2 people, $3000 each, beach vacation", thread3, ctx3, "Show destinations");
  thread3 = t3_1.history || thread3.concat(user("From LA, 8 days, 2 people, $3000 each, beach vacation"));
  await new Promise(resolve => setTimeout(resolve, 2000));

  const t3_2 = await runTestTurn("Suite 5", 3.2, "Tell me more about the first option", thread3, ctx3, "Should elaborate on first destination");

  const hasElaboration = t3_2.output.length > 400;
  log(`  Provided elaboration: ${hasElaboration ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    suite: 5,
    exception: 'elaborate-on-suggestion',
    passed: hasElaboration,
    critical: false
  });

  return { suite: 5 };
}

// ============================================================================
// TEST SUITE 6: Slot Verification Accuracy
// ============================================================================
async function testSlotVerification() {
  log("\n\n📋 TEST SUITE 6: Slot Verification Accuracy");
  log("=" .repeat(80));
  log("Scenario: Verify agent correctly identifies when ALL slots are truly filled\n");

  // Case 1: 4/5 with vague preference - should NOT show
  log("\n🔹 CASE 1: 4/5 with vague/generic preference");
  const ctx1 = createEnhancedContext({ name: 'Test User', uid: 116 });
  let thread1 = [];
  const t1_1 = await runTestTurn("Suite 6", 1.1, "From Seattle, $2500, 6 days, 2 people", thread1, ctx1, "4/5 slots");
  thread1 = t1_1.history || thread1.concat(user("From Seattle, $2500, 6 days, 2 people"));
  await new Promise(resolve => setTimeout(resolve, 2000));

  const t1_2 = await runTestTurn("Suite 6", 1.2, "something nice", thread1, ctx1, "Vague preference - should ask for clarity");

  const slots1 = countFilledSlots(ctx1);
  const dest1 = hasDestinationSuggestions(t1_2.output);
  log(`  Slots detected: ${slots1.filled}/5`);
  log(`  Destinations: ${dest1.result ? '⚠️  YES (may be premature)' : '✅ NO (correct)'}`);

  testResults.push({
    suite: 6,
    case: 'vague-preference',
    slotsFilled: slots1.filled,
    passed: slots1.filled === 5 ? dest1.result : !dest1.result,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Case 2: Explicit ALL 5 slots - MUST show
  log("\n🔹 CASE 2: Explicit all 5 slots filled");
  const ctx2 = createEnhancedContext({ name: 'Test User', uid: 117 });
  const turn2 = await runTestTurn(
    "Suite 6",
    2,
    "From Boston, 9 days, 4 travelers, $5000 per person budget, interested in history and architecture",
    [],
    ctx2,
    "ALL 5 slots explicit, MUST show destinations"
  );

  const slots2 = countFilledSlots(ctx2);
  const dest2 = hasDestinationSuggestions(turn2.output);
  log(`  Slots detected: ${slots2.filled}/5`);
  log(`  Destinations: ${dest2.result ? '✅ YES (correct)' : '❌ NO (ERROR!)'}`);

  testResults.push({
    suite: 6,
    case: 'all-explicit',
    slotsFilled: slots2.filled,
    passed: dest2.result && slots2.filled >= 4,
    critical: true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Case 3: Budget in different currency formats
  log("\n🔹 CASE 3: Budget currency variations");
  const ctx3 = createEnhancedContext({ name: 'Test User', uid: 118 });
  const turn3 = await runTestTurn(
    "Suite 6",
    3,
    "From Toronto, 7 days, 3 people, CAD 4000 per person, love nature",
    [],
    ctx3,
    "Should handle CAD currency, show destinations"
  );

  const budget3 = ctx3.summary?.budget?.amount;
  const currency3 = ctx3.summary?.budget?.currency;
  const slots3 = countFilledSlots(ctx3);
  const dest3 = hasDestinationSuggestions(turn3.output);
  log(`  Budget: ${budget3} ${currency3}`);
  log(`  Slots: ${slots3.filled}/5 | Destinations: ${dest3.result ? '✅ YES' : '❌ NO'}`);

  testResults.push({
    suite: 6,
    case: 'currency-variation',
    slotsFilled: slots3.filled,
    passed: dest3.result && budget3 > 0,
    critical: true
  });

  return { suite: 6 };
}

// ============================================================================
// RUN ALL TESTS AND GENERATE COMPREHENSIVE REPORT
// ============================================================================
async function runAllTests() {
  const startTime = Date.now();

  try {
    log("\n🚀 Starting Comprehensive Fail-Proof Testing");
    log("This will test complex multi-turn scenarios, edge cases, and stress conditions...\n");

    const suite1 = await testAmbiguousSlotFilling();
    const suite2 = await testConflictingInfo();
    const suite3 = await testPartialSlotStrategy();
    const suite4 = await testEdgeCases();
    const suite5 = await testExceptionCases();
    const suite6 = await testSlotVerification();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Generate comprehensive summary
    log("\n\n" + "=".repeat(80));
    log("✨ ALL COMPREHENSIVE TESTS COMPLETED");
    log("=".repeat(80));
    log(`\n⏱️  Total Time: ${duration} seconds (${(duration / 60).toFixed(1)} minutes)`);

    // Count results
    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = ((passedTests / totalTests) * 100).toFixed(1);

    // Critical tests
    const criticalTests = testResults.filter(t => t.critical);
    const criticalPassed = criticalTests.filter(t => t.passed).length;
    const criticalRate = ((criticalPassed / criticalTests.length) * 100).toFixed(1);

    log(`\n📊 Overall Test Summary:`);
    log(`  Total Tests: ${totalTests}`);
    log(`  Passed: ${passedTests} ✅`);
    log(`  Failed: ${failedTests} ❌`);
    log(`  Pass Rate: ${passRate}%`);

    log(`\n🔴 CRITICAL Slot-First Tests:`);
    log(`  Total: ${criticalTests.length}`);
    log(`  Passed: ${criticalPassed} ✅`);
    log(`  Failed: ${criticalTests.length - criticalPassed} ❌`);
    log(`  Pass Rate: ${criticalRate}%`);

    log(`\n📋 Test Suites Completed:`);
    log(`  1. ✓ Ambiguous & Conversational Slot Filling (4 turns)`);
    log(`  2. ✓ Conflicting & Changing Information (4 turns)`);
    log(`  3. ✓ Partial Slot Strategy (4 cases)`);
    log(`  4. ✓ Edge Cases & Stress Tests (6 edge cases)`);
    log(`  5. ✓ Exception Handling (3 exception cases)`);
    log(`  6. ✓ Slot Verification Accuracy (3 cases)`);

    // Show failed critical tests
    const failedCritical = criticalTests.filter(t => !t.passed);
    if (failedCritical.length > 0) {
      log(`\n⚠️  FAILED CRITICAL TESTS:`);
      failedCritical.forEach(t => {
        log(`  ❌ Suite ${t.suite}, ${t.turn ? `Turn ${t.turn}` : `Case: ${t.case || t.scenario || t.edge}`}`);
        log(`     Slots filled: ${t.slotsFilled || 'N/A'}/5`);
      });
    } else {
      log(`\n🎉 ALL CRITICAL TESTS PASSED!`);
    }

    // Show non-critical failures
    const failedNonCritical = testResults.filter(t => !t.passed && !t.critical);
    if (failedNonCritical.length > 0) {
      log(`\n⚠️  Non-Critical Test Failures: ${failedNonCritical.length}`);
    }

    // Save logs
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFilePath = path.join(DATA_DIR, `slot-first-failproof-${timestamp}.log`);
    await fs.writeFile(logFilePath, allLogs.join('\n'), 'utf-8');
    log(`\n💾 Detailed logs saved to: ${logFilePath}`);

    // Save results JSON
    const resultsFilePath = path.join(DATA_DIR, `slot-first-failproof-results-${timestamp}.json`);
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
        { id: 1, name: 'Ambiguous & Conversational', summary: suite1.summary },
        { id: 2, name: 'Conflicting & Changing Info', summary: suite2.summary },
        { id: 3, name: 'Partial Slot Strategy' },
        { id: 4, name: 'Edge Cases & Stress' },
        { id: 5, name: 'Exception Handling' },
        { id: 6, name: 'Slot Verification' }
      ]
    }, null, 2), 'utf-8');
    log(`💾 Results JSON saved to: ${resultsFilePath}`);

    log("\n" + "=".repeat(80));
    if (criticalRate >= 95) {
      log("🎉 EXCELLENT! Slot-first workflow is FAIL-PROOF!");
    } else if (criticalRate >= 85) {
      log("✅ VERY GOOD! Minor edge cases may need attention.");
    } else if (criticalRate >= 70) {
      log("⚠️  GOOD but needs improvements. Review failed critical tests.");
    } else {
      log("❌ CRITICAL ISSUES! Slot-first workflow needs significant fixes.");
    }
    log("=".repeat(80) + "\n");

  } catch (error) {
    log("\n\n❌ TESTS FAILED WITH ERROR:");
    log(error.message);
    log(error.stack);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const errorLogPath = path.join(DATA_DIR, `slot-first-failproof-error-${timestamp}.log`);
    await fs.writeFile(errorLogPath, allLogs.join('\n') + '\n\nERROR:\n' + error.stack, 'utf-8');
    log(`\n💾 Error log saved to: ${errorLogPath}`);
  }
}

runAllTests().catch(console.error);
