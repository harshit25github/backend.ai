import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { run, user } from '@openai/agents';
import {
  createEnhancedContext,
  enhancedManagerAgent
} from './src/ai/enhanced-manager.js';

const DATA_DIR = './data';
await fs.mkdir(DATA_DIR, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(DATA_DIR, `enhanced-manager-test-${timestamp}.log`);
let logs = [];

function log(msg) {
  console.log(msg);
  logs.push(msg);
}

async function saveLogs() {
  await fs.writeFile(logFile, logs.join('\n'), 'utf-8');
  console.log(`\n💾 Logs saved to: ${logFile}`);
}

log("🧪 ENHANCED MANAGER - QUICK VALIDATION TEST\n");
log("=" .repeat(80));

const testResults = [];

// Test 1: Vague request with TEXT questions + suggestedQuestions
log("\n📋 TEST 1: Vague Request - Both Question Types");
log("=" .repeat(80));

const ctx1 = createEnhancedContext({ name: 'User', uid: 1 });
const res1 = await run(enhancedManagerAgent, [user("I want to travel somewhere")], { context: ctx1 });
const out1 = String(res1.finalOutput);

log(`\n✅ Response (first 500 chars):\n${out1.substring(0, 500)}...\n`);

const hasDestinations = /##\s+[A-Z]/m.test(out1) || /\b(Bali|Paris|Tokyo|Rome|Dubai)\b/i.test(out1);
const hasTextQ = out1.includes('?') && /where|budget|how many|when|what kind/i.test(out1);
const hasSuggestedQ = (ctx1.summary?.suggestedQuestions?.length || 0) > 0;

log("📊 Validation:");
log(`  ${hasDestinations ? '✅' : '❌'} Provided destination suggestions`);
log(`  ${hasTextQ ? '✅' : '❌'} Asked TEXT questions (Agent → User)`);
log(`  ${hasSuggestedQ ? '✅' : '❌'} Populated suggestedQuestions (User → Agent): ${ctx1.summary?.suggestedQuestions?.length || 0}`);

if (hasSuggestedQ) {
  log("\n  suggestedQuestions:");
  ctx1.summary.suggestedQuestions.forEach(q => log(`    - "${q}"`));
}

testResults.push({ test: 1, name: 'Vague Request', passed: hasDestinations && hasTextQ && hasSuggestedQ });

// Test 2: Missing required info - should ask in TEXT
log("\n\n📋 TEST 2: Itinerary Without Required Info");
log("=" .repeat(80));

const ctx2 = createEnhancedContext({ name: 'User', uid: 2 });
const res2 = await run(enhancedManagerAgent, [user("Create a Paris itinerary")], { context: ctx2 });
const out2 = String(res2.finalOutput);

log(`\n✅ Response (first 500 chars):\n${out2.substring(0, 500)}...\n`);

const asksForRequired = /how many days|duration|how many travelers|pax/i.test(out2);
const noPartialItinerary = !/Day 1:|### Morning/i.test(out2);
const hasTextQ2 = out2.includes('?');
const hasSuggestedQ2 = (ctx2.summary?.suggestedQuestions?.length || 0) > 0;

log("📊 Validation:");
log(`  ${asksForRequired ? '✅' : '❌'} Asked for missing required fields in TEXT`);
log(`  ${noPartialItinerary ? '✅' : '❌'} Did NOT create partial itinerary`);
log(`  ${hasTextQ2 ? '✅' : '❌'} Has TEXT questions`);
log(`  ${hasSuggestedQ2 ? '✅' : '❌'} Populated suggestedQuestions: ${ctx2.summary?.suggestedQuestions?.length || 0}`);

testResults.push({ test: 2, name: 'Missing Required Info', passed: asksForRequired && noPartialItinerary });

// Test 3: Complete info - should create full itinerary
log("\n\n📋 TEST 3: Complete Info - Full Itinerary");
log("=" .repeat(80));

const ctx3 = createEnhancedContext({ name: 'User', uid: 3 });
const res3 = await run(enhancedManagerAgent, [user("Create a 3-day Rome itinerary for 2 people, mid-range budget")], { context: ctx3 });
const out3 = String(res3.finalOutput);

log(`\n✅ Response (first 800 chars):\n${out3.substring(0, 800)}...\n`);

const hasFullItinerary = /Day 1:|Day 2:|Day 3:/gi.test(out3) && /### Morning|### Afternoon|### Evening/i.test(out3);
const hasDetails = /Duration:|Cost:|Transport:|Tip:/i.test(out3);
const itineraryDays = ctx3.itinerary?.days?.length || 0;
const hasSuggestedQ3 = (ctx3.summary?.suggestedQuestions?.length || 0) > 0;

log("📊 Validation:");
log(`  ${hasFullItinerary ? '✅' : '❌'} Created full 3-day itinerary`);
log(`  ${hasDetails ? '✅' : '❌'} Included transport/cost/duration details`);
log(`  ${itineraryDays > 0 ? '✅' : '❌'} Called update_itinerary tool: ${itineraryDays} days`);
log(`  ${hasSuggestedQ3 ? '✅' : '❌'} Populated suggestedQuestions: ${ctx3.summary?.suggestedQuestions?.length || 0}`);
log(`  Context: destination=${ctx3.summary?.destination?.city}, duration=${ctx3.summary?.duration_days}, pax=${ctx3.summary?.pax}`);

testResults.push({ test: 3, name: 'Full Itinerary', passed: hasFullItinerary && itineraryDays > 0 });

// Test 4: Specific destination insights
log("\n\n📋 TEST 4: Specific Destination Insights");
log("=" .repeat(80));

const ctx4 = createEnhancedContext({ name: 'User', uid: 4 });
const res4 = await run(enhancedManagerAgent, [user("Tell me about Dubai")], { context: ctx4 });
const out4 = String(res4.finalOutput);

log(`\n✅ Response (first 600 chars):\n${out4.substring(0, 600)}...\n`);

const hasDubaiInfo = /dubai/i.test(out4) && (/visa|weather|culture|attractions|burj/i.test(out4));
const asksForItinerary = /itinerary|plan|create|would you like|interested in/i.test(out4);
const hasSuggestedQ4 = (ctx4.summary?.suggestedQuestions?.length || 0) > 0;

log("📊 Validation:");
log(`  ${hasDubaiInfo ? '✅' : '❌'} Provided Dubai insights`);
log(`  ${asksForItinerary ? '✅' : '❌'} Asked if user wants itinerary (TEXT)`);
log(`  ${hasSuggestedQ4 ? '✅' : '❌'} Populated suggestedQuestions: ${ctx4.summary?.suggestedQuestions?.length || 0}`);

if (hasSuggestedQ4) {
  log("\n  Checking suggestedQuestions format (should be User → Agent):");
  const allCorrectFormat = ctx4.summary.suggestedQuestions.every(q => {
    const isCorrect = !/would you|do you want|should i|can i help/i.test(q);
    log(`    ${isCorrect ? '✅' : '❌'} "${q}"`);
    return isCorrect;
  });
  log(`  ${allCorrectFormat ? '✅' : '❌'} All questions are user-to-agent format`);
}

testResults.push({ test: 4, name: 'Destination Insights', passed: hasDubaiInfo && asksForItinerary && hasSuggestedQ4 });

// Test 5: Edge case - tight budget
log("\n\n📋 TEST 5: Edge Case - Tight Budget");
log("=" .repeat(80));

const ctx5 = createEnhancedContext({ name: 'User', uid: 5 });
const res5 = await run(enhancedManagerAgent, [user("Cheapest 2-day trip near Mumbai for 2 people, budget ₹5,000")], { context: ctx5 });
const out5 = String(res5.finalOutput);

log(`\n✅ Response (first 600 chars):\n${out5.substring(0, 600)}...\n`);

const acknowledgesBudget = /budget|affordable|cheap|economical|tight/i.test(out5);
const suggestsOptions = /lonavala|alibaug|mahabaleshwar|matheran|khandala/i.test(out5);
const budgetCaptured = ctx5.summary?.budget?.amount === 5000;

log("📊 Validation:");
log(`  ${acknowledgesBudget ? '✅' : '❌'} Acknowledges tight budget constraint`);
log(`  ${suggestsOptions ? '✅' : '❌'} Suggests budget-friendly nearby destinations`);
log(`  ${budgetCaptured ? '✅' : '❌'} Captured budget: ₹${ctx5.summary?.budget?.amount || 'NOT SET'}`);

testResults.push({ test: 5, name: 'Tight Budget', passed: acknowledgesBudget && suggestsOptions });

// Summary
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
  log("🎉 EXCELLENT! Optimized prompts working perfectly!");
} else if (passRate >= 70) {
  log("✅ GOOD! Most tests passed.");
} else {
  log("⚠️  NEEDS REVIEW");
}
log("=".repeat(80));

// Save results
await saveLogs();

const resultsPath = path.join(DATA_DIR, `enhanced-manager-results-${timestamp}.json`);
await fs.writeFile(resultsPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  totalTests,
  passedTests,
  failedTests,
  passRate,
  results: testResults,
  contexts: {
    test1: { suggestedQuestions: ctx1.summary?.suggestedQuestions },
    test2: { suggestedQuestions: ctx2.summary?.suggestedQuestions, destination: ctx2.summary?.destination },
    test3: {
      destination: ctx3.summary?.destination,
      duration: ctx3.summary?.duration_days,
      pax: ctx3.summary?.pax,
      itineraryDays: ctx3.itinerary?.days?.length,
      suggestedQuestions: ctx3.summary?.suggestedQuestions
    },
    test4: { suggestedQuestions: ctx4.summary?.suggestedQuestions, destination: ctx4.summary?.destination },
    test5: { budget: ctx5.summary?.budget, origin: ctx5.summary?.origin, suggestedQuestions: ctx5.summary?.suggestedQuestions }
  }
}, null, 2), 'utf-8');

log(`💾 Results JSON saved to: ${resultsPath}\n`);
