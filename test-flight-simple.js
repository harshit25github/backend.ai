import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';
import fs from 'fs';

console.log('🧪 SIMPLE FLIGHT TEST - Chennai to Hyderabad\n');

const chatId = 'test-simple-' + Date.now();

async function test() {
  console.log('Test: "Find flights from Chennai to Hyderabad on March 20, 1 passenger, premium economy, one-way"\n');

  const userMessage = 'Find flights from Chennai to Hyderabad on March 20, 1 passenger, premium economy, one-way';
  const conversationHistory = [{ role: 'user', content: userMessage }];

  try {
    const result = await runMultiAgentSystem(
      userMessage,
      chatId,
      conversationHistory,
      false
    );

    const output = Array.isArray(result.finalOutput)
      ? result.finalOutput.map(String).join('\n')
      : String(result.finalOutput ?? '');

    console.log('\n📝 Agent Response:');
    console.log('='.repeat(80));
    console.log(output);
    console.log('='.repeat(80));

    // Check context
    const contextPath = `data/agent-context-${chatId}.json`;
    if (fs.existsSync(contextPath)) {
      const context = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));

      console.log('\n📊 Context Summary:');
      console.log('  Origin IATA:', context.flight.resolvedOrigin?.airportIATA || 'NOT RESOLVED');
      console.log('  Dest IATA:', context.flight.resolvedDestination?.airportIATA || 'NOT RESOLVED');
      console.log('  Search Results:', context.flight.searchResults?.length || 0);

      if (context.flight.searchResults?.length > 0) {
        console.log('\n✅ SUCCESS: Flights found!');
      } else {
        console.log('\n❌ ISSUE: No flights found');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
