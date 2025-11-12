/**
 * Test: Multi-Turn Information Gathering with Immediate Execution
 *
 * This test verifies that:
 * 1. Agent accumulates information across multiple turns
 * 2. When 6th field is provided, itinerary is created IMMEDIATELY in that turn
 * 3. No "I'll create" promises - just immediate execution
 */

import { ChatOpenAI } from '@langchain/openai';
import dotenv from 'dotenv';
import { AGENT_PROMPTS } from './src/ai/prompts.js';

dotenv.config();

const model = new ChatOpenAI({
  model: 'gpt-4',
  temperature: 0.7,
});

async function testMultiTurnGradualGathering() {
  console.log('\n=== MULTI-TURN TEST: Gradual Information Gathering ===\n');
  console.log('Testing that agent accumulates info across turns and creates when 6th field arrives\n');
  console.log('='.repeat(80) + '\n');

  const messages = [
    { role: 'system', content: AGENT_PROMPTS.TRIP_PLANNER },
  ];

  // Turn 1: User provides only destination
  console.log('📍 TURN 1: User provides destination only');
  console.log('User: "I want to visit Tokyo"\n');

  messages.push({ role: 'user', content: 'I want to visit Tokyo' });
  let response = await model.invoke(messages);
  let agentResponse = response.content;
  messages.push({ role: 'assistant', content: agentResponse });

  console.log('Agent:', agentResponse.substring(0, 300) + '...\n');

  const asksForMissingFields = /origin|from|where.*from|budget|how many|when|dates/i.test(agentResponse);
  const doesNotCreateYet = !/Day \d+:/i.test(agentResponse);

  console.log(`✓ Agent asks for missing fields: ${asksForMissingFields ? '✅' : '❌'}`);
  console.log(`✓ Agent does NOT create yet (missing fields): ${doesNotCreateYet ? '✅' : '❌'}`);
  console.log('\n' + '-'.repeat(80) + '\n');

  // Turn 2: User provides origin only
  console.log('📍 TURN 2: User provides origin');
  console.log('User: "From Delhi"\n');

  messages.push({ role: 'user', content: 'From Delhi' });
  response = await model.invoke(messages);
  agentResponse = response.content;
  messages.push({ role: 'assistant', content: agentResponse });

  console.log('Agent:', agentResponse.substring(0, 300) + '...\n');

  const acknowledgesOrigin = /delhi|got it|understood/i.test(agentResponse);
  const stillAsksForRemaining = /budget|how many|when|dates|days/i.test(agentResponse);
  const stillDoesNotCreate = !/Day \d+:/i.test(agentResponse);

  console.log(`✓ Agent acknowledges origin: ${acknowledgesOrigin ? '✅' : '❌'}`);
  console.log(`✓ Agent asks for remaining fields: ${stillAsksForRemaining ? '✅' : '❌'}`);
  console.log(`✓ Agent still does NOT create (still missing fields): ${stillDoesNotCreate ? '✅' : '❌'}`);
  console.log('\n' + '-'.repeat(80) + '\n');

  // Turn 3: User provides remaining 4 fields (duration, pax, budget, date)
  console.log('📍 TURN 3: User provides final 4 fields (completes all 6)');
  console.log('User: "7 days, 2 people, ₹2L, April 15, 2026"\n');

  messages.push({ role: 'user', content: '7 days, 2 people, ₹2L, April 15, 2026' });
  response = await model.invoke(messages);
  agentResponse = response.content;

  console.log('Agent Response (first 800 chars):\n');
  console.log(agentResponse.substring(0, 800) + '...\n');
  console.log('='.repeat(80) + '\n');

  // Critical checks for Turn 3
  const hasItinerary = /Day \d+:/i.test(agentResponse) || /### Day \d+/i.test(agentResponse);

  const bannedPhrases = [
    "I'll create your itinerary",
    "Let me create",
    "I'm creating your itinerary",
    "Ready for me to create",
    "Shall I create",
    "Would you like me to create"
  ];

  const hasBannedPhrase = bannedPhrases.some(phrase =>
    agentResponse.toLowerCase().includes(phrase.toLowerCase())
  );

  const createdImmediately = hasItinerary && !hasBannedPhrase;

  console.log('📊 FINAL CHECKS (Turn 3 - when 6th field provided):\n');
  console.log(`✓ Contains itinerary (Day 1, Day 2, etc.): ${hasItinerary ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`✓ No banned "I'll create" phrases: ${!hasBannedPhrase ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`✓ Created IMMEDIATELY (not promised for later): ${createdImmediately ? '✅ PASS' : '❌ FAIL'}`);

  if (hasBannedPhrase) {
    console.log('\n⚠️  Found banned phrase - agent is discussing instead of doing!');
  }

  console.log('\n' + '='.repeat(80));

  const allPassed = asksForMissingFields && doesNotCreateYet &&
                     acknowledgesOrigin && stillAsksForRemaining && stillDoesNotCreate &&
                     hasItinerary && !hasBannedPhrase;

  if (allPassed) {
    console.log('\n✅ MULTI-TURN TEST PASSED!');
    console.log('   - Agent accumulated info across 3 turns');
    console.log('   - When 6th field arrived, creation was IMMEDIATE');
    console.log('   - No false promises or delays\n');
  } else {
    console.log('\n❌ MULTI-TURN TEST FAILED!');
    console.log('   Review output above for specific failures\n');
  }

  return allPassed;
}

// Run the test
async function runTest() {
  console.log('\n🚀 Testing Multi-Turn Gradual Information Gathering\n');

  try {
    const passed = await testMultiTurnGradualGathering();
    process.exit(passed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ ERROR during testing:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
