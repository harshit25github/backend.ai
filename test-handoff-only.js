import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log('🧪 Testing Trip Planner → Flight Specialist Handoff\n');
console.log('='.repeat(80));

const chatId = `handoff-test-${Date.now()}`;
const conversationHistory = [];

async function testHandoff() {
  console.log('\n📋 Test Scenario:');
  console.log('1. User provides complete trip info');
  console.log('2. User asks for flights');
  console.log('3. Expected: Handoff to Flight Specialist Agent\n');
  console.log('='.repeat(80));

  try {
    // Turn 1: Provide all trip info
    console.log('\n🔄 TURN 1: Provide trip details');
    console.log('User: "I want to go to Goa from Delhi, Dec 15-20, 2 people"\n');

    conversationHistory.push({
      role: 'user',
      content: 'I want to go to Goa from Delhi, Dec 15-20, 2 people'
    });

    let result = await runMultiAgentSystem(
      'I want to go to Goa from Delhi, Dec 15-20, 2 people',
      chatId,
      conversationHistory
    );

    conversationHistory.push({ role: 'assistant', content: result.finalOutput });
    console.log(`Agent: ${result.lastAgent}`);
    console.log(`Response: ${result.finalOutput.substring(0, 200)}...\n`);

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Turn 2: Ask for flights - should trigger handoff
    console.log('\n🔄 TURN 2: Request flights (should trigger handoff)');
    console.log('User: "Find me flights for these dates in economy class"\n');

    conversationHistory.push({
      role: 'user',
      content: 'Find me flights for these dates in economy class'
    });

    result = await runMultiAgentSystem(
      'Find me flights for these dates in economy class',
      chatId,
      conversationHistory
    );

    conversationHistory.push({ role: 'assistant', content: result.finalOutput });

    console.log('='.repeat(80));
    console.log('\n📊 RESULT:');
    console.log(`✓ Last Agent: ${result.lastAgent}`);
    console.log(`✓ Response: ${result.finalOutput.substring(0, 300)}...`);
    console.log(`✓ Flight Status: ${result.context.flight.bookingStatus}`);
    console.log(`✓ Flight Results: ${result.context.flight.searchResults.length} options`);
    console.log('='.repeat(80));

    // Check if handoff happened
    if (result.lastAgent === 'Flight Specialist Agent') {
      console.log('\n✅ SUCCESS: Handoff to Flight Specialist worked!');

      if (result.context.flight.searchResults.length > 0) {
        console.log('✅ SUCCESS: Flights were searched!');
      } else {
        console.log('⚠️  WARNING: Handoff worked but no flights found');
      }
    } else {
      console.log(`\n❌ FAIL: Expected Flight Specialist Agent, got ${result.lastAgent}`);
    }

  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    throw error;
  }
}

testHandoff().catch(console.error);
