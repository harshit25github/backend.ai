import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

// Test cases for TRIP_PLANNER_MODIFIED prompt
const testCases = [
  {
    name: "Test 1: Vague destination - sanctuary near me",
    chatId: "test-vague-sanctuary",
    messages: [
      { role: "user", content: "sanctuary near me" }
    ],
    expectedBehavior: "Should ask for origin city first, NOT suggest random sanctuary"
  },
  {
    name: "Test 2: Complete info upfront",
    chatId: "test-complete-info",
    messages: [
      { role: "user", content: "Plan 5 days in Goa from Mumbai, Jan 15-20, 2 people, ₹50k total" }
    ],
    expectedBehavior: "Should CONFIRM first before creating itinerary"
  },
  {
    name: "Test 3: Vague destination - nearest hill station",
    chatId: "test-nearest-hill",
    messages: [
      { role: "user", content: "nearest hill station" }
    ],
    expectedBehavior: "Should ask for starting city first"
  },
  {
    name: "Test 4: Vague destination - romantic place",
    chatId: "test-romantic-place",
    messages: [
      { role: "user", content: "romantic place for anniversary" }
    ],
    expectedBehavior: "Should ask for origin and preferences"
  },
  {
    name: "Test 5: Unrealistic budget",
    chatId: "test-low-budget",
    messages: [
      { role: "user", content: "Plan 7 days in Paris from Delhi for 2 people, ₹20k total" }
    ],
    expectedBehavior: "Should acknowledge tight budget and offer budget-focused options"
  }
];

async function runTests() {
  console.log("🧪 Testing TRIP_PLANNER_MODIFIED Prompt\n");
  console.log("=" .repeat(80));

  for (const testCase of testCases) {
    console.log(`\n📋 ${testCase.name}`);
    console.log(`Chat ID: ${testCase.chatId}`);
    console.log(`Expected: ${testCase.expectedBehavior}`);
    console.log("-".repeat(80));

    try {
      const result = await runMultiAgentSystem(
        testCase.messages[0].content,
        testCase.chatId,
        testCase.messages
      );

      console.log("\n✅ Agent Response:");
      console.log(result.finalOutput);

      console.log("\n📊 Context State:");
      console.log(`Origin: ${result.context.summary?.origin?.city || 'NOT SET'}`);
      console.log(`Destination: ${result.context.summary?.destination?.city || 'NOT SET'}`);
      console.log(`Dates: ${result.context.summary?.outbound_date || 'NOT SET'} to ${result.context.summary?.return_date || 'NOT SET'}`);
      console.log(`Pax: ${result.context.summary?.pax || 'NOT SET'}`);
      console.log(`Budget: ${result.context.summary?.budget?.amount || 'NOT SET'} ${result.context.summary?.budget?.currency || ''}`);
      console.log(`Itinerary days: ${result.context.itinerary?.days?.length || 0}`);

    } catch (error) {
      console.error("❌ Test failed:", error.message);
    }

    console.log("\n" + "=".repeat(80));
  }

  console.log("\n✨ All tests completed!");
}

// Run tests
runTests().catch(console.error);
