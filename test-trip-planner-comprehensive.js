import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

const DATA_DIR = './data';
await fs.mkdir(DATA_DIR, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(DATA_DIR, `trip-planner-test-${timestamp}.log`);
let logs = [];

function log(msg) {
  console.log(msg);
  logs.push(msg);
}

async function saveLogs() {
  await fs.writeFile(logFile, logs.join('\n'), 'utf-8');
  console.log(`\n💾 Logs saved to: ${logFile}`);
}

log("🧪 TRIP PLANNER - COMPREHENSIVE VALIDATION TEST\n");
log("=" .repeat(80));

const testResults = [];

// ============================================================================
// TEST 1: Vague Request - Should Ask TEXT Questions + Populate suggestedQuestions
// ============================================================================
log("\n📋 TEST 1: Vague Request - Both Question Types");
log("=" .repeat(80));

const chatId1 = 'test-trip-vague-' + Date.now();
const res1 = await runMultiAgentSystem("I want to travel somewhere", chatId1, [
  { role: 'user', content: "I want to travel somewhere" }
]);
const out1 = String(res1.finalOutput);

log(`\n✅ Response (first 600 chars):\n${out1.substring(0, 600)}...\n`);

const hasDestinations1 = /\b(Bali|Paris|Tokyo|Rome|Dubai|Goa|Kerala|Maldives|Thailand)\b/i.test(out1);
const hasTextQ1 = out1.includes('?') && /where|budget|how many|when|what kind|which|traveling from/i.test(out1);
const hasSuggestedQ1 = (res1.context.summary?.suggestedQuestions?.length || 0) > 0;
const hasEmojis1 = /[✈️🏖️💰📅🍽️🏔️🌍]/u.test(out1);

log("📊 Validation:");
log(`  ${hasDestinations1 ? '✅' : '❌'} Provided destination suggestions`);
log(`  ${hasTextQ1 ? '✅' : '❌'} Asked TEXT questions (Agent → User)`);
log(`  ${hasSuggestedQ1 ? '✅' : '❌'} Populated suggestedQuestions: ${res1.context.summary?.suggestedQuestions?.length || 0}`);
log(`  ${hasEmojis1 ? '✅' : '❌'} Used emojis for engagement`);

if (hasSuggestedQ1) {
  log("\n  suggestedQuestions:");
  res1.context.summary.suggestedQuestions.slice(0, 3).forEach(q => log(`    - "${q}"`));
}

testResults.push({
  test: 1,
  name: 'Vague Request',
  passed: hasDestinations1 && hasTextQ1 && hasSuggestedQ1
});

await new Promise(resolve => setTimeout(resolve, 2000));

// ============================================================================
// TEST 2: Missing Required Info - Should Ask Before Creating Itinerary
// ============================================================================
log("\n\n📋 TEST 2: Missing Required Info - Should Ask, Not Create Partial");
log("=" .repeat(80));

const chatId2 = 'test-trip-missing-' + Date.now();
const res2 = await runMultiAgentSystem("Plan a trip to Paris", chatId2, [
  { role: 'user', content: "Plan a trip to Paris" }
]);
const out2 = String(res2.finalOutput);

log(`\n✅ Response (first 600 chars):\n${out2.substring(0, 600)}...\n`);

const asksForRequired2 = /origin|from|where.*traveling|how many days|duration|how many people|travelers|pax|when|dates/i.test(out2);
const noPartialItinerary2 = !/Day 1:|### Morning|#### Morning/i.test(out2);
const hasTextQ2 = out2.includes('?');
const hasSuggestedQ2 = (res2.context.summary?.suggestedQuestions?.length || 0) > 0;

log("📊 Validation:");
log(`  ${asksForRequired2 ? '✅' : '❌'} Asked for missing required info in TEXT`);
log(`  ${noPartialItinerary2 ? '✅' : '❌'} Did NOT create partial itinerary`);
log(`  ${hasTextQ2 ? '✅' : '❌'} Has TEXT questions`);
log(`  ${hasSuggestedQ2 ? '✅' : '❌'} Populated suggestedQuestions: ${res2.context.summary?.suggestedQuestions?.length || 0}`);
log(`  Destination captured: ${res2.context.summary?.destination?.city || 'NOT SET'}`);

testResults.push({
  test: 2,
  name: 'Missing Required Info',
  passed: asksForRequired2 && noPartialItinerary2
});

await new Promise(resolve => setTimeout(resolve, 2000));

// ============================================================================
// TEST 3: Complete Info - Should Create Full Itinerary
// ============================================================================
log("\n\n📋 TEST 3: Complete Info - Full Itinerary Creation");
log("=" .repeat(80));

const chatId3 = 'test-trip-complete-' + Date.now();
const res3 = await runMultiAgentSystem(
  "Plan a 4-day trip to Goa from Mumbai, 2 people, budget ₹40,000 total",
  chatId3,
  [{ role: 'user', content: "Plan a 4-day trip to Goa from Mumbai, 2 people, budget ₹40,000 total" }]
);
const out3 = String(res3.finalOutput);

log(`\n✅ Response (first 800 chars):\n${out3.substring(0, 800)}...\n`);

const hasFullItinerary3 = /Day \d+:/gi.test(out3) && (/### Morning|### Afternoon|#### Morning|#### Afternoon/i.test(out3));
const hasDetails3 = /Duration:|Cost:|Transport:|Tip:/i.test(out3) || /₹|hours/i.test(out3);
const itineraryDays3 = res3.context.itinerary?.days?.length || 0;
const hasSuggestedQ3 = (res3.context.summary?.suggestedQuestions?.length || 0) > 0;
const hasEmojis3 = /[✈️🏖️💰📅🍽️🏔️🌍]/u.test(out3);

log("📊 Validation:");
log(`  ${hasFullItinerary3 ? '✅' : '❌'} Created full day-by-day itinerary`);
log(`  ${hasDetails3 ? '✅' : '❌'} Included transport/cost/duration details`);
log(`  ${itineraryDays3 > 0 ? '✅' : '❌'} Called update_itinerary tool: ${itineraryDays3} days`);
log(`  ${hasSuggestedQ3 ? '✅' : '❌'} Populated suggestedQuestions: ${res3.context.summary?.suggestedQuestions?.length || 0}`);
log(`  ${hasEmojis3 ? '✅' : '❌'} Used emojis for engagement`);
log(`\n  Context: origin=${res3.context.summary?.origin?.city}, destination=${res3.context.summary?.destination?.city}`);
log(`           duration=${res3.context.summary?.duration_days}, pax=${res3.context.summary?.pax}, budget=₹${res3.context.summary?.budget?.amount}`);

testResults.push({
  test: 3,
  name: 'Full Itinerary',
  passed: hasFullItinerary3 && itineraryDays3 > 0
});

await new Promise(resolve => setTimeout(resolve, 2000));

// ============================================================================
// TEST 4: Date Awareness - Relative Dates
// ============================================================================
log("\n\n📋 TEST 4: Date Awareness - Relative Date Handling");
log("=" .repeat(80));

const chatId4 = 'test-trip-dates-' + Date.now();
const res4 = await runMultiAgentSystem(
  "Plan a trip to Manali next month for 3 people, 5 days",
  chatId4,
  [{ role: 'user', content: "Plan a trip to Manali next month for 3 people, 5 days" }]
);
const out4 = String(res4.finalOutput);

log(`\n✅ Response (first 600 chars):\n${out4.substring(0, 600)}...\n`);

const capturedDates4 = res4.context.summary?.outbound_date;
const capturedDuration4 = res4.context.summary?.duration_days;
const hasCalculatedDate = capturedDates4 && capturedDates4.length > 0 && capturedDates4 !== '';
const asksForOrigin4 = /from|where.*traveling|origin|starting/i.test(out4);

log("📊 Validation:");
log(`  ${hasCalculatedDate ? '✅' : '❌'} Captured date: ${capturedDates4 || 'NOT SET'}`);
log(`  ${capturedDuration4 === 5 ? '✅' : '❌'} Captured duration: ${capturedDuration4} days`);
log(`  ${asksForOrigin4 ? '✅' : '❌'} Asks for missing origin`);
log(`  Destination: ${res4.context.summary?.destination?.city || 'NOT SET'}`);
log(`  Pax: ${res4.context.summary?.pax || 'NOT SET'}`);

testResults.push({
  test: 4,
  name: 'Date Awareness',
  passed: capturedDuration4 === 5
});

await new Promise(resolve => setTimeout(resolve, 2000));

// ============================================================================
// TEST 5: Diverse Suggestions - Budget Tiers
// ============================================================================
log("\n\n📋 TEST 5: Diverse Suggestions - Budget Tiers");
log("=" .repeat(80));

const chatId5 = 'test-trip-diverse-' + Date.now();
const res5 = await runMultiAgentSystem(
  "Suggest 3-day trip destinations from Delhi",
  chatId5,
  [{ role: 'user', content: "Suggest 3-day trip destinations from Delhi" }]
);
const out5 = String(res5.finalOutput);

log(`\n✅ Response (first 800 chars):\n${out5.substring(0, 800)}...\n`);

const hasBudgetTier = /budget|₹\d|affordable|mid-range|luxury|cheap/i.test(out5);
const hasMultipleDestinations = (out5.match(/\b(Goa|Jaipur|Agra|Manali|Rishikesh|Shimla|Kerala|Udaipur)\b/gi) || []).length >= 3;
const hasExperienceTypes = /beach|mountain|cultural|adventure|relaxation/i.test(out5);
const hasEmojis5 = /[✈️🏖️💰📅🍽️🏔️🌍]/u.test(out5);

log("📊 Validation:");
log(`  ${hasBudgetTier ? '✅' : '❌'} Mentioned budget tiers/affordability`);
log(`  ${hasMultipleDestinations ? '✅' : '❌'} Provided multiple destination options`);
log(`  ${hasExperienceTypes ? '✅' : '❌'} Mentioned different experience types`);
log(`  ${hasEmojis5 ? '✅' : '❌'} Used emojis for engagement`);

testResults.push({
  test: 5,
  name: 'Diverse Suggestions',
  passed: hasBudgetTier && hasMultipleDestinations
});

await new Promise(resolve => setTimeout(resolve, 2000));

// ============================================================================
// TEST 6: Vague Destination - "Near Me" Handling
// ============================================================================
log("\n\n📋 TEST 6: Vague Destination - 'Near Me' Handling");
log("=" .repeat(80));

const chatId6 = 'test-trip-vague-dest-' + Date.now();
const res6 = await runMultiAgentSystem(
  "Find me a beach resort near me",
  chatId6,
  [{ role: 'user', content: "Find me a beach resort near me" }]
);
const out6 = String(res6.finalOutput);

log(`\n✅ Response (first 600 chars):\n${out6.substring(0, 600)}...\n`);

const asksForLocation6 = /where.*you|which city|location|from|currently in|based in/i.test(out6);
const doesNotAssumeLocation = !/goa|mumbai|chennai|bangalore/i.test(out6) || asksForLocation6;
const hasTextQ6 = out6.includes('?');

log("📊 Validation:");
log(`  ${asksForLocation6 ? '✅' : '❌'} Asks for user's location before suggesting`);
log(`  ${doesNotAssumeLocation ? '✅' : '❌'} Does not assume location`);
log(`  ${hasTextQ6 ? '✅' : '❌'} Has TEXT questions`);

testResults.push({
  test: 6,
  name: 'Vague Destination',
  passed: asksForLocation6 && hasTextQ6
});

await new Promise(resolve => setTimeout(resolve, 2000));

// ============================================================================
// TEST 7: Modification Handling
// ============================================================================
log("\n\n📋 TEST 7: Modification Handling - Duration Change");
log("=" .repeat(80));

// First create an itinerary
const chatId7 = 'test-trip-modification-' + Date.now();
const res7a = await runMultiAgentSystem(
  "Create 5-day Jaipur trip from Delhi, 2 people, ₹30,000",
  chatId7,
  [{ role: 'user', content: "Create 5-day Jaipur trip from Delhi, 2 people, ₹30,000" }]
);

log(`\n✅ Initial itinerary created: ${res7a.context.itinerary?.days?.length || 0} days`);
log(`   Duration in summary: ${res7a.context.summary?.duration_days} days`);

await new Promise(resolve => setTimeout(resolve, 2000));

// Now modify it
const res7b = await runMultiAgentSystem(
  "Make it 3 days instead of 5",
  chatId7,
  [
    { role: 'user', content: "Create 5-day Jaipur trip from Delhi, 2 people, ₹30,000" },
    { role: 'assistant', content: String(res7a.finalOutput) },
    { role: 'user', content: "Make it 3 days instead of 5" }
  ]
);
const out7b = String(res7b.finalOutput);

log(`\n✅ After modification (first 600 chars):\n${out7b.substring(0, 600)}...\n`);

const newDuration7 = res7b.context.summary?.duration_days;
const newItineraryDays7 = res7b.context.itinerary?.days?.length || 0;
const hasModifiedItinerary7 = /Day 1:|Day 2:|Day 3:/gi.test(out7b);

log("📊 Validation:");
log(`  Duration updated: 5 → ${newDuration7} days ${newDuration7 === 3 ? '✅' : '❌'}`);
log(`  Itinerary synced: ${newItineraryDays7} days ${newItineraryDays7 === 3 ? '✅' : '❌'}`);
log(`  ${hasModifiedItinerary7 ? '✅' : '❌'} Generated modified itinerary in text`);

testResults.push({
  test: 7,
  name: 'Modification Handling',
  passed: newDuration7 === 3 && newItineraryDays7 === 3
});

await new Promise(resolve => setTimeout(resolve, 2000));

// ============================================================================
// TEST 8: Edge Case - Tight Budget
// ============================================================================
log("\n\n📋 TEST 8: Edge Case - Tight Budget");
log("=" .repeat(80));

const chatId8 = 'test-trip-tight-budget-' + Date.now();
const res8 = await runMultiAgentSystem(
  "Plan 3-day trip to Dubai from Mumbai, 2 people, budget ₹20,000 total",
  chatId8,
  [{ role: 'user', content: "Plan 3-day trip to Dubai from Mumbai, 2 people, budget ₹20,000 total" }]
);
const out8 = String(res8.finalOutput);

log(`\n✅ Response (first 600 chars):\n${out8.substring(0, 600)}...\n`);

const acknowledgesBudget8 = /budget|tight|limited|affordable|cheap|economical/i.test(out8);
const suggestsAlternatives8 = /instead|alternative|consider|perhaps|might want/i.test(out8) ||
                              /goa|jaipur|kerala|nearby|closer/i.test(out8);
const budgetCaptured8 = res8.context.summary?.budget?.amount === 20000;

log("📊 Validation:");
log(`  ${acknowledgesBudget8 ? '✅' : '❌'} Acknowledges budget constraint`);
log(`  ${suggestsAlternatives8 ? '✅' : '❌'} Suggests alternatives or adjustments`);
log(`  ${budgetCaptured8 ? '✅' : '❌'} Captured budget: ₹${res8.context.summary?.budget?.amount || 'NOT SET'}`);

testResults.push({
  test: 8,
  name: 'Tight Budget',
  passed: acknowledgesBudget8 && budgetCaptured8
});

await new Promise(resolve => setTimeout(resolve, 2000));

// ============================================================================
// TEST 9: Incremental Information Gathering
// ============================================================================
log("\n\n📋 TEST 9: Incremental Information Gathering");
log("=" .repeat(80));

const chatId9 = 'test-trip-incremental-' + Date.now();

// Turn 1: Just destination
const res9a = await runMultiAgentSystem("I want to visit Kerala", chatId9, [
  { role: 'user', content: "I want to visit Kerala" }
]);

log(`\n✅ Turn 1 - Only destination provided`);
log(`   Captured: destination=${res9a.context.summary?.destination?.city}`);
log(`   Asks for more info: ${/from|origin|how many|days|budget|when/i.test(String(res9a.finalOutput)) ? 'YES ✅' : 'NO ❌'}`);

await new Promise(resolve => setTimeout(resolve, 2000));

// Turn 2: Add origin and duration
const res9b = await runMultiAgentSystem("From Bangalore, 5 days", chatId9, [
  { role: 'user', content: "I want to visit Kerala" },
  { role: 'assistant', content: String(res9a.finalOutput) },
  { role: 'user', content: "From Bangalore, 5 days" }
]);

log(`\n✅ Turn 2 - Added origin and duration`);
log(`   Captured: origin=${res9b.context.summary?.origin?.city}, duration=${res9b.context.summary?.duration_days}`);
log(`   Asks for more: ${/how many people|travelers|pax|budget/i.test(String(res9b.finalOutput)) ? 'YES ✅' : 'NO ❌'}`);

await new Promise(resolve => setTimeout(resolve, 2000));

// Turn 3: Add pax and confirm
const res9c = await runMultiAgentSystem("2 people, yes create the itinerary", chatId9, [
  { role: 'user', content: "I want to visit Kerala" },
  { role: 'assistant', content: String(res9a.finalOutput) },
  { role: 'user', content: "From Bangalore, 5 days" },
  { role: 'assistant', content: String(res9b.finalOutput) },
  { role: 'user', content: "2 people, yes create the itinerary" }
]);

const hasItinerary9 = (res9c.context.itinerary?.days?.length || 0) > 0;

log(`\n✅ Turn 3 - Confirmed with pax`);
log(`   Captured: pax=${res9c.context.summary?.pax}`);
log(`   Created itinerary: ${hasItinerary9 ? `YES ✅ (${res9c.context.itinerary?.days?.length} days)` : 'NO ❌'}`);

testResults.push({
  test: 9,
  name: 'Incremental Gathering',
  passed: hasItinerary9 && res9c.context.summary?.pax === 2
});

// ============================================================================
// SUMMARY
// ============================================================================
log("\n\n" + "=".repeat(80));
log("✨ TEST SUMMARY");
log("=".repeat(80));

const totalTests = testResults.length;
const passedTests = testResults.filter(t => t.passed).length;
const failedTests = totalTests - passedTests;
const passRate = ((passedTests / totalTests) * 100).toFixed(1);

log(`\nTotal Tests: ${totalTests}`);
log(`Passed: ${passedTests} ✅`);
log(`Failed: ${failedTests} ❌`);
log(`Pass Rate: ${passRate}%`);

log("\n📋 Detailed Results:");
testResults.forEach(t => {
  log(`  ${t.passed ? '✅' : '❌'} Test ${t.test}: ${t.name}`);
});

log("\n" + "=".repeat(80));
if (passRate >= 90) {
  log("🎉 EXCELLENT! Trip Planner working great!");
} else if (passRate >= 70) {
  log("✅ GOOD! Most tests passed.");
} else {
  log("⚠️  NEEDS REVIEW");
}
log("=".repeat(80));

// Save logs and results
await saveLogs();

const resultsPath = path.join(DATA_DIR, `trip-planner-results-${timestamp}.json`);
await fs.writeFile(resultsPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  totalTests,
  passedTests,
  failedTests,
  passRate,
  results: testResults,
  contexts: {
    test1: { suggestedQuestions: res1.context.summary?.suggestedQuestions },
    test3: {
      destination: res3.context.summary?.destination,
      duration: res3.context.summary?.duration_days,
      pax: res3.context.summary?.pax,
      budget: res3.context.summary?.budget,
      itineraryDays: res3.context.itinerary?.days?.length,
      suggestedQuestions: res3.context.summary?.suggestedQuestions
    },
    test7: {
      beforeDuration: 5,
      afterDuration: res7b.context.summary?.duration_days,
      itineraryDays: res7b.context.itinerary?.days?.length
    },
    test9: {
      finalState: {
        origin: res9c.context.summary?.origin,
        destination: res9c.context.summary?.destination,
        duration: res9c.context.summary?.duration_days,
        pax: res9c.context.summary?.pax,
        itineraryDays: res9c.context.itinerary?.days?.length
      }
    }
  }
}, null, 2), 'utf-8');

log(`💾 Results JSON saved to: ${resultsPath}\n`);
