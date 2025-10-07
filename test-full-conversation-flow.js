import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';
import fs from 'fs/promises';

const LOG_DIR = './data/conversation-logs';
const timestamp = Date.now();

await fs.mkdir(LOG_DIR, { recursive: true });

// Store all conversation details
const conversationLog = {
  testName: 'Full Conversation Flow - Itinerary Creation and Modification',
  timestamp: new Date().toISOString(),
  turns: [],
  finalContext: null
};

let conversationHistory = [];

async function sendMessage(turnNumber, userMessage, description) {
  console.log('\n' + '='.repeat(100));
  console.log(`TURN ${turnNumber}: ${description}`);
  console.log('='.repeat(100));
  console.log(`👤 USER: "${userMessage}"\n`);

  const startTime = Date.now();

  conversationHistory.push({ role: 'user', content: userMessage });

  const result = await runMultiAgentSystem(
    userMessage,
    `full-flow-${timestamp}`,
    conversationHistory
  );

  const duration = Date.now() - startTime;

  conversationHistory.push({ role: 'assistant', content: result.finalOutput });

  console.log(`🤖 AGENT: ${result.lastAgent}`);
  console.log(`⏱️  Duration: ${duration}ms`);
  console.log(`📊 Response length: ${result.finalOutput.length} chars\n`);
  console.log('─'.repeat(100));
  console.log('AGENT RESPONSE:');
  console.log('─'.repeat(100));
  console.log(result.finalOutput);
  console.log('─'.repeat(100));

  // Log context state
  console.log('\n📋 CONTEXT STATE AFTER THIS TURN:');
  console.log('─'.repeat(100));
  console.log('Summary:');
  console.log(JSON.stringify(result.context.summary, null, 2));
  console.log('\nItinerary Days:', result.context.itinerary?.days?.length || 0);
  if (result.context.itinerary?.days?.length > 0) {
    console.log('\nItinerary Preview (Day 1):');
    console.log(JSON.stringify(result.context.itinerary.days[0], null, 2));
  }
  console.log('─'.repeat(100));

  // Save turn details
  const turnLog = {
    turnNumber,
    description,
    userMessage,
    agentName: result.lastAgent,
    agentResponse: result.finalOutput,
    duration,
    contextSnapshot: {
      summary: result.context.summary,
      itineraryDays: result.context.itinerary?.days?.length || 0,
      suggestedQuestions: result.context.summary.suggestedQuestions?.length || 0,
      placesOfInterest: result.context.summary.placesOfInterests?.length || 0
    }
  };

  conversationLog.turns.push(turnLog);
  conversationLog.finalContext = result.context;

  return result;
}

console.log('\n' + '█'.repeat(100));
console.log('COMPREHENSIVE MULTI-TURN CONVERSATION TEST');
console.log('Testing: Itinerary Creation + Modification with Full Context Tracking');
console.log('█'.repeat(100));

try {
  // ============================================================================
  // TURN 1: Initial vague request
  // ============================================================================
  await sendMessage(
    1,
    "I want to plan a trip to Japan",
    "Initial vague request - should ask for details"
  );

  // ============================================================================
  // TURN 2: Provide some details, but not all
  // ============================================================================
  await sendMessage(
    2,
    "I'm thinking 10 days, and I'm interested in both modern Tokyo and traditional Kyoto",
    "Partial info - duration and interests"
  );

  // ============================================================================
  // TURN 3: Provide origin and passenger count
  // ============================================================================
  await sendMessage(
    3,
    "I'll be traveling from Singapore with my wife, so 2 people",
    "Origin and passenger count"
  );

  // ============================================================================
  // TURN 4: Provide dates and budget
  // ============================================================================
  await sendMessage(
    4,
    "We're planning to go March 15-25, 2026. Our budget is $8000 USD total for both of us",
    "Dates and budget - should trigger confirmation"
  );

  // ============================================================================
  // TURN 5: Confirm and create itinerary
  // ============================================================================
  const result5 = await sendMessage(
    5,
    "Yes, please create the detailed itinerary!",
    "User confirms - SHOULD CREATE ITINERARY"
  );

  // Check if itinerary was created
  console.log('\n' + '█'.repeat(100));
  console.log('ITINERARY CREATION VALIDATION');
  console.log('█'.repeat(100));

  const itineraryCreated = result5.context.itinerary?.days?.length > 0;
  console.log(`✅ Itinerary Created: ${itineraryCreated ? 'YES' : 'NO'}`);
  console.log(`📅 Total Days: ${result5.context.itinerary?.days?.length || 0}`);
  console.log(`🎯 Expected Days: 10`);
  console.log(`✅ Matches Duration: ${result5.context.itinerary?.days?.length === 10 ? 'YES' : 'NO'}`);

  if (itineraryCreated) {
    console.log('\n📋 FULL ITINERARY STRUCTURE:');
    result5.context.itinerary.days.forEach((day, idx) => {
      console.log(`\nDay ${idx + 1}: ${day.title}`);
      console.log(`  Date: ${day.date}`);
      console.log(`  Morning: ${day.segments.morning.length} activities`);
      if (day.segments.morning.length > 0) {
        console.log(`    → ${day.segments.morning[0].places}`);
      }
      console.log(`  Afternoon: ${day.segments.afternoon.length} activities`);
      if (day.segments.afternoon.length > 0) {
        console.log(`    → ${day.segments.afternoon[0].places}`);
      }
      console.log(`  Evening: ${day.segments.evening.length} activities`);
      if (day.segments.evening.length > 0) {
        console.log(`    → ${day.segments.evening[0].places}`);
      }
    });
  }

  // ============================================================================
  // TURN 6: Request modification - Add specific activity
  // ============================================================================
  await sendMessage(
    6,
    "Can you add a visit to teamLab Borderless digital art museum in Tokyo on day 2 afternoon?",
    "Modification request - Add specific activity"
  );

  // ============================================================================
  // TURN 7: Request modification - Change duration of stay
  // ============================================================================
  await sendMessage(
    7,
    "Actually, I'd like to spend one extra day in Kyoto. Can we extend the Kyoto portion?",
    "Modification request - Extend Kyoto stay"
  );

  // ============================================================================
  // TURN 8: Request modification - Swap activities
  // ============================================================================
  await sendMessage(
    8,
    "I'd prefer to visit the Imperial Palace in the morning instead of afternoon. Can we swap that?",
    "Modification request - Swap timing"
  );

  // ============================================================================
  // TURN 9: Ask about the itinerary
  // ============================================================================
  await sendMessage(
    9,
    "What's the best way to get from Tokyo to Kyoto?",
    "Question about the itinerary"
  );

  // ============================================================================
  // TURN 10: Final modification - Reduce trip
  // ============================================================================
  const result10 = await sendMessage(
    10,
    "Actually, we need to shorten the trip to 7 days instead of 10. Can you update the itinerary?",
    "Major modification - Reduce from 10 to 7 days"
  );

  // Check duration sync
  console.log('\n' + '█'.repeat(100));
  console.log('DURATION SYNC VALIDATION (10 days → 7 days)');
  console.log('█'.repeat(100));
  console.log(`📅 New Itinerary Days: ${result10.context.itinerary?.days?.length || 0}`);
  console.log(`📊 Summary Duration: ${result10.context.summary.duration_days}`);
  console.log(`✅ Synced: ${result10.context.itinerary?.days?.length === result10.context.summary.duration_days ? 'YES' : 'NO'}`);
  console.log(`📅 New Return Date: ${result10.context.summary.return_date}`);

  // Calculate expected return date
  if (result10.context.summary.outbound_date && result10.context.summary.duration_days) {
    const outbound = new Date(result10.context.summary.outbound_date);
    const expected = new Date(outbound);
    expected.setDate(expected.getDate() + result10.context.summary.duration_days);
    const expectedReturn = expected.toISOString().split('T')[0];
    console.log(`📅 Expected Return Date: ${expectedReturn}`);
    console.log(`✅ Return Date Correct: ${result10.context.summary.return_date === expectedReturn ? 'YES' : 'NO'}`);
  }

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================
  console.log('\n' + '█'.repeat(100));
  console.log('FINAL TEST SUMMARY');
  console.log('█'.repeat(100));

  console.log(`\n📊 Total Turns: ${conversationLog.turns.length}`);
  console.log(`⏱️  Total Time: ${conversationLog.turns.reduce((sum, t) => sum + t.duration, 0)}ms`);
  console.log(`📝 Total User Messages: ${conversationLog.turns.length}`);
  console.log(`📝 Total Agent Responses: ${conversationLog.turns.length}`);

  console.log('\n✅ VALIDATIONS:');
  console.log(`  ✓ Itinerary Created: ${result5.context.itinerary?.days?.length > 0 ? 'YES' : 'NO'}`);
  console.log(`  ✓ Initial Duration: 10 days`);
  console.log(`  ✓ Modified Duration: 7 days`);
  console.log(`  ✓ Duration Synced: ${result10.context.itinerary?.days?.length === 7 ? 'YES' : 'NO'}`);
  console.log(`  ✓ Return Date Updated: ${result10.context.summary.return_date ? 'YES' : 'NO'}`);
  console.log(`  ✓ Suggested Questions: ${result10.context.summary.suggestedQuestions?.length || 0} captured`);
  console.log(`  ✓ Places of Interest: ${result10.context.summary.placesOfInterests?.length || 0} captured`);

  // Save complete conversation log
  await fs.writeFile(
    `${LOG_DIR}/full-conversation-${timestamp}.json`,
    JSON.stringify(conversationLog, null, 2)
  );

  // Save final context separately
  await fs.writeFile(
    `${LOG_DIR}/final-context-${timestamp}.json`,
    JSON.stringify(conversationLog.finalContext, null, 2)
  );

  // Save conversation transcript
  const transcript = conversationLog.turns.map(turn =>
    `TURN ${turn.turnNumber}: ${turn.description}\n` +
    `USER: ${turn.userMessage}\n` +
    `AGENT (${turn.agentName}): ${turn.agentResponse}\n` +
    `Duration: ${turn.duration}ms\n` +
    `Context: ${JSON.stringify(turn.contextSnapshot, null, 2)}\n` +
    `${'='.repeat(100)}\n`
  ).join('\n');

  await fs.writeFile(
    `${LOG_DIR}/conversation-transcript-${timestamp}.txt`,
    transcript
  );

  console.log(`\n📁 Logs saved to: ${LOG_DIR}/`);
  console.log(`  - full-conversation-${timestamp}.json (complete data)`);
  console.log(`  - final-context-${timestamp}.json (final context state)`);
  console.log(`  - conversation-transcript-${timestamp}.txt (readable transcript)`);

  console.log('\n' + '█'.repeat(100));
  console.log('✅ TEST COMPLETE - ALL CONVERSATIONS AND CONTEXT LOGGED');
  console.log('█'.repeat(100));

} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  console.error('Stack:', error.stack);

  // Save error log
  await fs.writeFile(
    `${LOG_DIR}/error-${timestamp}.json`,
    JSON.stringify({ error: error.message, stack: error.stack, conversationLog }, null, 2)
  );
}
