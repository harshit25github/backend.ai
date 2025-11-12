/**
 * Test: No Confirmation + Direct Execution
 *
 * This test verifies that:
 * 1. When all 6 fields are provided, agent creates itinerary immediately (no confirmation)
 * 2. Agent doesn't say "I'll create" without actually creating
 * 3. Tool is called in the SAME response when 6th field is provided
 * 4. No multi-turn delays
 */

import { ChatOpenAI } from '@langchain/openai';
import dotenv from 'dotenv';
import { AGENT_PROMPTS } from './src/ai/prompts.js';

dotenv.config();

const model = new ChatOpenAI({
  model: 'gpt-4',
  temperature: 0.7,
});

// Test 1: All fields provided at once - should create immediately
async function testDirectCreationAllFieldsAtOnce() {
  console.log('\n=== TEST 1: All Fields At Once (Direct Creation) ===\n');

  const userMessage = "Plan a 5-day trip to Paris from Mumbai for 2 people with ₹1L per person budget in March 2026";

  console.log('User:', userMessage);

  const response = await model.invoke([
    { role: 'system', content: AGENT_PROMPTS.TRIP_PLANNER },
    { role: 'user', content: userMessage }
  ]);

  const agentResponse = response.content;
  console.log('\nAgent Response:', agentResponse.substring(0, 500) + '...\n');

  // Check 1: Agent should NOT ask for confirmation
  const hasConfirmationQuestion = /ready|should I|shall I|would you like me to|do you want me to|confirm/i.test(agentResponse) && /\?/.test(agentResponse);

  // Check 2: Agent should NOT just promise without creating
  const bannedPhrases = [
    "I'll create your itinerary",
    "Let me create",
    "I'm creating your itinerary",
    "Creating your itinerary",
    "Give me a moment to create"
  ];

  const hasBannedPhrase = bannedPhrases.some(phrase =>
    agentResponse.toLowerCase().includes(phrase.toLowerCase())
  );

  // Check 3: Response should contain itinerary content (Day 1, Day 2, etc.)
  const hasItinerary = /Day \d+:/i.test(agentResponse) || /### Day \d+/i.test(agentResponse);

  console.log('✓ Checks:');
  console.log(`  - No confirmation question: ${!hasConfirmationQuestion ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - No banned phrases: ${!hasBannedPhrase ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - Contains itinerary: ${hasItinerary ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = !hasConfirmationQuestion && !hasBannedPhrase && hasItinerary;
  console.log(`\n${allPassed ? '✅ TEST 1 PASSED' : '❌ TEST 1 FAILED'}\n`);

  return allPassed;
}

// Test 2: Gradual field gathering - should create when 6th field is provided
async function testGradualGatheringWithDirectCreation() {
  console.log('\n=== TEST 2: Gradual Gathering (6th Field Triggers Creation) ===\n');

  const messages = [
    { role: 'system', content: AGENT_PROMPTS.TRIP_PLANNER },
  ];

  // Turn 1: User provides only destination
  console.log('Turn 1:');
  console.log('User: "I want to visit Tokyo"');
  messages.push({ role: 'user', content: 'I want to visit Tokyo' });

  let response = await model.invoke(messages);
  let agentResponse = response.content;
  messages.push({ role: 'assistant', content: agentResponse });

  console.log('Agent:', agentResponse.substring(0, 300) + '...\n');

  // Agent should ask for missing fields
  const asksForFields = /origin|from where|budget|how many|dates|when/i.test(agentResponse);
  console.log(`  - Agent asks for missing fields: ${asksForFields ? '✅ PASS' : '❌ FAIL'}`);

  // Turn 2: User provides all remaining 5 fields
  console.log('\nTurn 2:');
  const userTurn2 = 'From Delhi, 7 days, 2 people, 2L budget, April 15, 2026';
  console.log('User:', userTurn2);
  messages.push({ role: 'user', content: userTurn2 });

  response = await model.invoke(messages);
  agentResponse = response.content;

  console.log('Agent:', agentResponse.substring(0, 500) + '...\n');

  // Check 1: Agent should NOT ask for confirmation
  const hasConfirmationQuestion = /ready|should I|shall I|would you like me to|do you want me to|confirm/i.test(agentResponse) && /\?/.test(agentResponse);

  // Check 2: Agent should NOT just promise without creating
  const bannedPhrases = [
    "I'll create your itinerary",
    "Let me create",
    "I'm creating your itinerary",
    "Creating your itinerary",
    "Give me a moment to create"
  ];

  const hasBannedPhrase = bannedPhrases.some(phrase =>
    agentResponse.toLowerCase().includes(phrase.toLowerCase())
  );

  // Check 3: Response should contain itinerary content
  const hasItinerary = /Day \d+:/i.test(agentResponse) || /### Day \d+/i.test(agentResponse);

  console.log('✓ Checks:');
  console.log(`  - No confirmation question: ${!hasConfirmationQuestion ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - No banned phrases: ${!hasBannedPhrase ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - Contains itinerary (immediate): ${hasItinerary ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - Created in SAME turn (not next turn): ${hasItinerary ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = !hasConfirmationQuestion && !hasBannedPhrase && hasItinerary;
  console.log(`\n${allPassed ? '✅ TEST 2 PASSED' : '❌ TEST 2 FAILED'}\n`);

  return allPassed;
}

// Test 3: Verify no "I'll create" false promises
async function testNoFalsePromises() {
  console.log('\n=== TEST 3: No False Promises (Action = Immediate) ===\n');

  const userMessage = "Create a Bali trip for 2 people from Mumbai, 6 days, 1.5L, June 10, 2026";

  console.log('User:', userMessage);

  const response = await model.invoke([
    { role: 'system', content: AGENT_PROMPTS.TRIP_PLANNER },
    { role: 'user', content: userMessage }
  ]);

  const agentResponse = response.content;
  console.log('\nAgent Response:', agentResponse.substring(0, 500) + '...\n');

  // Check 1: Should NOT contain promise phrases without itinerary
  const hasPromise = /I'll create|let me create|I'm creating|creating your/i.test(agentResponse);
  const hasItinerary = /Day \d+:/i.test(agentResponse) || /### Day \d+/i.test(agentResponse);

  // If agent says "I'll create", itinerary MUST be present
  const isFalsePromise = hasPromise && !hasItinerary;

  console.log('✓ Checks:');
  console.log(`  - Contains itinerary: ${hasItinerary ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - No false promises: ${!isFalsePromise ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = hasItinerary && !isFalsePromise;
  console.log(`\n${allPassed ? '✅ TEST 3 PASSED' : '❌ TEST 3 FAILED'}\n`);

  return allPassed;
}

// Run all tests
async function runAllTests() {
  console.log('\n🚀 Starting Comprehensive Test Suite: No Confirmation + Direct Execution\n');
  console.log('=' .repeat(80));

  try {
    const test1Pass = await testDirectCreationAllFieldsAtOnce();
    const test2Pass = await testGradualGatheringWithDirectCreation();
    const test3Pass = await testNoFalsePromises();

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 FINAL RESULTS:\n');
    console.log(`  Test 1 (Direct Creation): ${test1Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Test 2 (Gradual Gathering): ${test2Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Test 3 (No False Promises): ${test3Pass ? '✅ PASS' : '❌ FAIL'}`);

    const allTestsPassed = test1Pass && test2Pass && test3Pass;

    if (allTestsPassed) {
      console.log('\n✅ ALL TESTS PASSED! No confirmation loop, immediate execution working correctly.\n');
    } else {
      console.log('\n❌ SOME TESTS FAILED. Review output above for details.\n');
    }

    process.exit(allTestsPassed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ ERROR during testing:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runAllTests();
