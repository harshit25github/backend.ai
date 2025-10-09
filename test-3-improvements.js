import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log("🧪 Testing 3 Specific Improvements\n");
console.log("=" .repeat(80));

// ============================================================================
// TEST 1: Current Date Awareness
// ============================================================================
async function testDateAwareness() {
  console.log("\n📋 TEST 1: Current Date Awareness");
  console.log("=" .repeat(80));
  console.log("Testing: Agent should understand 'next month', 'next week', etc.\n");

  const chatId = 'test-date-awareness-' + Date.now();
  const testCases = [
    {
      message: "Plan a trip to Goa next month for 2 people",
      expected: "Should convert 'next month' to actual month and dates"
    },
    {
      message: "I want to go somewhere this weekend",
      expected: "Should identify upcoming Saturday/Sunday dates"
    },
    {
      message: "Trip to Manali in 2 weeks, 3 people",
      expected: "Should calculate date 14 days from today"
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🔹 Testing: "${testCase.message}"`);
    console.log("-".repeat(80));

    const result = await runMultiAgentSystem(
      testCase.message,
      chatId + '-' + Date.now(),
      [{ role: 'user', content: testCase.message }]
    );

    console.log("\n✅ Agent Response:");
    console.log(result.finalOutput.substring(0, 500) + "...\n");

    console.log("📊 Date Context Check:");
    console.log(`  Outbound Date: ${result.context.summary?.outbound_date || 'NOT SET'}`);
    console.log(`  Expected: ${testCase.expected}`);

    // Check if date was actually set
    if (result.context.summary?.outbound_date) {
      console.log(`  ✅ Date captured: ${result.context.summary.outbound_date}`);
    } else {
      console.log(`  ❌ FAILED: Date not captured`);
    }

    console.log("\n" + "=".repeat(80));

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// ============================================================================
// TEST 2: Diverse Suggestions
// ============================================================================
async function testDiverseSuggestions() {
  console.log("\n\n📋 TEST 2: Diverse Suggestions");
  console.log("=" .repeat(80));
  console.log("Testing: Agent should provide budget/mid-range/luxury options\n");

  const chatId = 'test-diverse-suggestions-' + Date.now();
  const message = "I want to go on a 5-day trip from Mumbai, suggest some destinations";

  console.log(`🔹 Testing: "${message}"`);
  console.log("-".repeat(80));

  const result = await runMultiAgentSystem(
    message,
    chatId,
    [{ role: 'user', content: message }]
  );

  console.log("\n✅ Agent Response:");
  console.log(result.finalOutput);

  console.log("\n\n📊 Diversity Check:");

  // Check for budget tiers
  const hasBudget = result.finalOutput.toLowerCase().includes('budget') ||
                    result.finalOutput.includes('₹10') ||
                    result.finalOutput.includes('₹15');
  const hasMidRange = result.finalOutput.toLowerCase().includes('mid-range') ||
                      result.finalOutput.toLowerCase().includes('mid range') ||
                      result.finalOutput.includes('₹25') ||
                      result.finalOutput.includes('₹30');
  const hasLuxury = result.finalOutput.toLowerCase().includes('luxury') ||
                    result.finalOutput.includes('₹50') ||
                    result.finalOutput.includes('₹60');

  console.log(`  Budget options mentioned: ${hasBudget ? '✅ YES' : '❌ NO'}`);
  console.log(`  Mid-range options mentioned: ${hasMidRange ? '✅ YES' : '❌ NO'}`);
  console.log(`  Luxury options mentioned: ${hasLuxury ? '✅ YES' : '❌ NO'}`);

  // Check for different experience types
  const hasBeach = result.finalOutput.toLowerCase().includes('beach') ||
                   result.finalOutput.toLowerCase().includes('goa') ||
                   result.finalOutput.toLowerCase().includes('gokarna');
  const hasMountain = result.finalOutput.toLowerCase().includes('mountain') ||
                      result.finalOutput.toLowerCase().includes('hill') ||
                      result.finalOutput.toLowerCase().includes('manali') ||
                      result.finalOutput.toLowerCase().includes('shimla');
  const hasCultural = result.finalOutput.toLowerCase().includes('cultural') ||
                      result.finalOutput.toLowerCase().includes('heritage') ||
                      result.finalOutput.toLowerCase().includes('jaipur') ||
                      result.finalOutput.toLowerCase().includes('udaipur');

  console.log(`\n  Experience diversity:`);
  console.log(`    Beach/Coastal: ${hasBeach ? '✅ YES' : '❌ NO'}`);
  console.log(`    Mountain/Hill: ${hasMountain ? '✅ YES' : '❌ NO'}`);
  console.log(`    Cultural/Heritage: ${hasCultural ? '✅ YES' : '❌ NO'}`);

  const diversityScore = [hasBudget, hasMidRange, hasLuxury, hasBeach, hasMountain, hasCultural]
    .filter(Boolean).length;

  console.log(`\n  Diversity Score: ${diversityScore}/6`);
  console.log(`  ${diversityScore >= 4 ? '✅ GOOD DIVERSITY' : '❌ NEEDS IMPROVEMENT'}`);

  console.log("\n" + "=".repeat(80));
}

// ============================================================================
// TEST 3: Emoji Usage
// ============================================================================
async function testEmojiUsage() {
  console.log("\n\n📋 TEST 3: Emoji Usage for Engagement");
  console.log("=" .repeat(80));
  console.log("Testing: Agent should use emojis to make responses engaging\n");

  const chatId = 'test-emoji-usage-' + Date.now();
  const message = "Plan a 3-day beach trip to Goa from Delhi, 2 people, budget ₹40,000";

  console.log(`🔹 Testing: "${message}"`);
  console.log("-".repeat(80));

  const result = await runMultiAgentSystem(
    message,
    chatId,
    [{ role: 'user', content: message }]
  );

  console.log("\n✅ Agent Response:");
  console.log(result.finalOutput);

  console.log("\n\n📊 Emoji Usage Check:");

  // Count emojis in response
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const emojis = result.finalOutput.match(emojiRegex) || [];
  const emojiCount = emojis.length;

  console.log(`  Total emojis used: ${emojiCount}`);
  console.log(`  Emojis found: ${emojis.slice(0, 10).join(' ')}${emojis.length > 10 ? '...' : ''}`);

  // Check for specific emoji types
  const hasTravel = /[✈️🌍🚗🚆]/u.test(result.finalOutput);
  const hasBeach = /[🏖️⛱️🌊]/u.test(result.finalOutput);
  const hasMoney = /[💰₹]/u.test(result.finalOutput);
  const hasFood = /[🍽️🍴]/u.test(result.finalOutput);
  const hasTime = /[⏰📅]/u.test(result.finalOutput);

  console.log(`\n  Emoji categories:`);
  console.log(`    Travel/Transport (✈️🌍🚗): ${hasTravel ? '✅ YES' : '❌ NO'}`);
  console.log(`    Beach/Activity (🏖️⛱️): ${hasBeach ? '✅ YES' : '❌ NO'}`);
  console.log(`    Money/Budget (💰₹): ${hasMoney ? '✅ YES' : '❌ NO'}`);
  console.log(`    Food/Dining (🍽️): ${hasFood ? '✅ YES' : '❌ NO'}`);
  console.log(`    Time/Dates (⏰📅): ${hasTime ? '✅ YES' : '❌ NO'}`);

  if (emojiCount >= 3) {
    console.log(`\n  ✅ GOOD: Response uses emojis for engagement (${emojiCount} total)`);
  } else {
    console.log(`\n  ❌ NEEDS IMPROVEMENT: Too few emojis (${emojiCount} total)`);
  }

  console.log("\n" + "=".repeat(80));
}

// ============================================================================
// RUN ALL IMPROVEMENT TESTS
// ============================================================================
async function runAllTests() {
  const startTime = Date.now();

  try {
    console.log("\n🚀 Starting Focused Tests for 3 Improvements\n");

    await testDateAwareness();
    await testDiverseSuggestions();
    await testEmojiUsage();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("\n\n" + "=".repeat(80));
    console.log("✨ ALL IMPROVEMENT TESTS COMPLETED");
    console.log("=".repeat(80));
    console.log(`\n⏱️  Total Time: ${duration} seconds`);
    console.log("\n📊 Tests Run:");
    console.log("  1. ✓ Current Date Awareness (3 scenarios)");
    console.log("  2. ✓ Diverse Suggestions (budget/mid/luxury)");
    console.log("  3. ✓ Emoji Usage for Engagement");
    console.log("\n🔍 Review output above for ✅/❌ validations\n");

  } catch (error) {
    console.error("\n\n❌ TESTS FAILED WITH ERROR:");
    console.error(error.message);
    console.error(error.stack);
  }
}

runAllTests().catch(console.error);
