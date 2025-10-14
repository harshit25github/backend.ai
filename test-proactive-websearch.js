import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log("🧪 TESTING PROACTIVE WEB_SEARCH WORKFLOW\n");
console.log("=" .repeat(80));
console.log("Testing that agent uses web_search FIRST before calling flight_search\n\n");

const chatId = `test-proactive-${Date.now()}`;

async function testProactiveWorkflow() {
  console.log("📋 TEST: User provides all info at once with major cities\n");
  console.log("User message: 'Find flights from Delhi to Mumbai on Jan 10, returning Jan 15, 2 passengers, economy, round trip'\n");
  console.log("Expected behavior: Agent should use web_search FIRST to get IATA codes, then call flight_search with IATAs\n");
  console.log("-".repeat(80));

  try {
    const userMessage = 'Find flights from Delhi to Mumbai on Jan 10, returning Jan 15, 2 passengers, economy, round trip';
    const result = await runMultiAgentSystem(
      userMessage,
      chatId,
      [{ role: 'user', content: userMessage }],
      false
    );

    console.log("\n✅ Test completed successfully!");
    console.log(`\n📊 Final Agent: ${result.lastAgent}`);
    console.log(`📊 Flight Status: ${result.context?.flight?.bookingStatus || 'N/A'}`);
    console.log(`📊 Flight Results: ${result.context?.flight?.searchResults?.length || 0} options`);

    const output = Array.isArray(result.finalOutput)
      ? result.finalOutput.map(String).join('\n')
      : String(result.finalOutput ?? '');

    console.log(`\n📝 Agent Response (first 600 chars):`);
    console.log(output.substring(0, 600));

    if (result.context?.flight?.bookingStatus === 'results_shown') {
      console.log("\n✅ SUCCESS: Agent successfully found and presented flights!");
    } else {
      console.log("\n⚠️  PARTIAL: Agent did not complete the flight search");
    }

  } catch (error) {
    console.error("\n❌ Test failed with error:");
    console.error(error.message);
    if (error.message.includes('Rate limit')) {
      console.log("\n⚠️  Rate limit hit. Please wait and try again.");
    }
  }
}

console.log("🚀 Starting proactive web_search workflow test...\n");
await testProactiveWorkflow();
console.log("\n" + "=".repeat(80));
console.log("✅ Test execution complete");
