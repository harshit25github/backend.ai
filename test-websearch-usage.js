import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log("🔍 Testing Web Search Usage\n");
console.log("=" .repeat(80));

const testCases = [
  {
    name: "Test 1: Should USE web search (festivals)",
    chatId: "test-websearch-festivals",
    message: "I'm planning a trip to Tokyo Jan 15-20, 2026. Are there any festivals during that time?",
    expectedBehavior: "Should use web_search to find current festival info"
  },
  {
    name: "Test 2: Should NOT use web search (basic attractions)",
    chatId: "test-websearch-attractions",
    message: "What are the top attractions to see in Paris?",
    expectedBehavior: "Should answer from knowledge, NOT search"
  },
  {
    name: "Test 3: Should USE web search (current weather)",
    chatId: "test-websearch-weather",
    message: "What's the weather like in Goa in December?",
    expectedBehavior: "Should use web_search for current weather patterns"
  },
  {
    name: "Test 4: Should NOT use web search (geography)",
    chatId: "test-websearch-distance",
    message: "How far is Agra from Delhi?",
    expectedBehavior: "Should answer from knowledge (~200-230 km)"
  }
];

async function runTests() {
  for (const testCase of testCases) {
    console.log(`\n📋 ${testCase.name}`);
    console.log(`Message: "${testCase.message}"`);
    console.log(`Expected: ${testCase.expectedBehavior}`);
    console.log("-".repeat(80));

    try {
      const result = await runMultiAgentSystem(
        testCase.message,
        testCase.chatId,
        [{ role: 'user', content: testCase.message }]
      );

      console.log("\n✅ Agent Response:");
      console.log(result.finalOutput.substring(0, 400) + "...");

      // Check if web search was used
      const usedWebSearch = result.fullResult?.state?._generatedItems?.some(item =>
        item.type === 'tool_call_item' && item.rawItem?.name === 'web_search'
      );

      console.log(`\n🔍 Web search used: ${usedWebSearch ? '✅ YES' : '❌ NO'}`);

    } catch (error) {
      console.error("❌ Test failed:", error.message);
    }

    console.log("\n" + "=".repeat(80));
  }

  console.log("\n✨ All tests completed!");
}

runTests().catch(console.error);
