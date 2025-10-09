import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log("🧪 COMPREHENSIVE END-TO-END TESTING\n");
console.log("=" .repeat(80));
console.log("Testing complex real-world scenarios with edge cases\n");

// ============================================================================
// TEST SUITE 1: Complex Vague Destination Journey
// ============================================================================
async function testVagueDestinationJourney() {
  console.log("\n\n📋 TEST SUITE 1: Complex Vague Destination Journey");
  console.log("=" .repeat(80));
  console.log("Scenario: User starts vague, provides info incrementally, changes mind\n");

  const chatId = 'test-vague-journey-' + Date.now();
  let conversationHistory = [];
  let results = [];

  // Turn 1: Completely vague request
  console.log("\n🔹 TURN 1: Vague destination - 'sanctuary near me'");
  console.log("-".repeat(80));
  const msg1 = "sanctuary near me";
  conversationHistory.push({ role: 'user', content: msg1 });

  const result1 = await runMultiAgentSystem(msg1, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result1.finalOutput });
  results.push(result1);

  console.log("✅ Agent Response:");
  console.log(result1.finalOutput);
  console.log("\n📊 Context Check:");
  console.log(`  Origin: ${JSON.stringify(result1.context.summary?.origin)}`);
  console.log(`  Destination: ${JSON.stringify(result1.context.summary?.destination)}`);
  console.log(`  ❌ Should ask for origin, NOT pick random sanctuary`);

  // Turn 2: Provide origin
  console.log("\n\n🔹 TURN 2: Provide origin");
  console.log("-".repeat(80));
  const msg2 = "I'm in Delhi";
  conversationHistory.push({ role: 'user', content: msg2 });

  const result2 = await runMultiAgentSystem(msg2, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result2.finalOutput });
  results.push(result2);

  console.log("✅ Agent Response:");
  console.log(result2.finalOutput);
  console.log("\n📊 Context Check:");
  console.log(`  Origin: ${JSON.stringify(result2.context.summary?.origin)}`);
  console.log(`  ✅ Should update origin to Delhi and suggest nearby sanctuaries`);

  // Turn 3: Pick destination and add more info
  console.log("\n\n🔹 TURN 3: Pick destination + add dates/pax");
  console.log("-".repeat(80));
  const msg3 = "Let's go with Ranthambore for 3 days, 2 people, from Jan 20-22, 2026";
  conversationHistory.push({ role: 'user', content: msg3 });

  const result3 = await runMultiAgentSystem(msg3, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result3.finalOutput });
  results.push(result3);

  console.log("✅ Agent Response:");
  console.log(result3.finalOutput.substring(0, 500) + "...");
  console.log("\n📊 Context Check:");
  console.log(`  Origin: ${result3.context.summary?.origin?.city}`);
  console.log(`  Destination: ${result3.context.summary?.destination?.city}`);
  console.log(`  Duration: ${result3.context.summary?.duration_days} days`);
  console.log(`  Pax: ${result3.context.summary?.pax}`);
  console.log(`  Dates: ${result3.context.summary?.outbound_date} to ${result3.context.summary?.return_date}`);
  console.log(`  ✅ All slots should be filled now`);

  // Turn 4: Change mind on destination
  console.log("\n\n🔹 TURN 4: Change destination mid-planning");
  console.log("-".repeat(80));
  const msg4 = "Actually, I changed my mind. Let's do Jim Corbett instead of Ranthambore";
  conversationHistory.push({ role: 'user', content: msg4 });

  const result4 = await runMultiAgentSystem(msg4, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result4.finalOutput });
  results.push(result4);

  console.log("✅ Agent Response:");
  console.log(result4.finalOutput.substring(0, 500) + "...");
  console.log("\n📊 Context Check:");
  console.log(`  Destination: ${result4.context.summary?.destination?.city}`);
  console.log(`  ✅ Should update to Jim Corbett, keep other details same`);

  // Turn 5: Confirm and create itinerary
  console.log("\n\n🔹 TURN 5: Confirm itinerary creation");
  console.log("-".repeat(80));
  const msg5 = "Yes, create the detailed itinerary";
  conversationHistory.push({ role: 'user', content: msg5 });

  const result5 = await runMultiAgentSystem(msg5, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result5.finalOutput });
  results.push(result5);

  console.log("✅ Agent Response:");
  console.log(result5.finalOutput.substring(0, 600) + "...");
  console.log("\n📊 Itinerary Check:");
  console.log(`  Days created: ${result5.context.itinerary?.days?.length}`);
  console.log(`  Matches duration: ${result5.context.itinerary?.computed?.matches_duration ? '✅' : '❌'}`);
  console.log(`  ✅ Should have 3-day itinerary for Jim Corbett`);

  return { chatId, results };
}

// ============================================================================
// TEST SUITE 2: Modification Cascade Stress Test
// ============================================================================
async function testModificationCascade() {
  console.log("\n\n📋 TEST SUITE 2: Modification Cascade Stress Test");
  console.log("=" .repeat(80));
  console.log("Scenario: Complete info → Create itinerary → Multiple modifications\n");

  const chatId = 'test-modification-cascade-' + Date.now();
  let conversationHistory = [];
  let results = [];

  // Turn 1: Complete info upfront
  console.log("\n🔹 TURN 1: Complete info upfront");
  console.log("-".repeat(80));
  const msg1 = "Plan a 5-day trip to Goa from Mumbai, Jan 15-19, 2026, 2 people, ₹60,000 total budget";
  conversationHistory.push({ role: 'user', content: msg1 });

  const result1 = await runMultiAgentSystem(msg1, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result1.finalOutput });
  results.push(result1);

  console.log("✅ Agent Response:");
  console.log(result1.finalOutput.substring(0, 400) + "...");
  console.log("\n📊 Summary Slots:");
  console.log(`  Origin: ${result1.context.summary?.origin?.city}`);
  console.log(`  Destination: ${result1.context.summary?.destination?.city}`);
  console.log(`  Duration: ${result1.context.summary?.duration_days} days`);
  console.log(`  Pax: ${result1.context.summary?.pax}`);
  console.log(`  Budget: ₹${result1.context.summary?.budget?.amount}`);
  console.log(`  Dates: ${result1.context.summary?.outbound_date} to ${result1.context.summary?.return_date}`);

  // Turn 2: Confirm and create
  console.log("\n\n🔹 TURN 2: Confirm itinerary creation");
  console.log("-".repeat(80));
  const msg2 = "Yes, create the itinerary";
  conversationHistory.push({ role: 'user', content: msg2 });

  const result2 = await runMultiAgentSystem(msg2, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result2.finalOutput });
  results.push(result2);

  console.log("✅ Agent Response:");
  console.log(result2.finalOutput.substring(0, 600) + "...");
  console.log("\n📊 Initial Itinerary:");
  console.log(`  Days: ${result2.context.itinerary?.days?.length}`);
  console.log(`  Duration: ${result2.context.summary?.duration_days} days`);
  console.log(`  Return Date: ${result2.context.summary?.return_date}`);

  const originalDays = result2.context.itinerary?.days?.length;
  const originalReturn = result2.context.summary?.return_date;
  const originalBudget = result2.context.summary?.budget?.amount;

  // Turn 3: Change duration (should cascade to return_date and itinerary)
  console.log("\n\n🔹 TURN 3: Modify duration - 5 days → 3 days");
  console.log("-".repeat(80));
  const msg3 = "Actually, make it 3 days instead of 5";
  conversationHistory.push({ role: 'user', content: msg3 });

  const result3 = await runMultiAgentSystem(msg3, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result3.finalOutput });
  results.push(result3);

  console.log("✅ Agent Response:");
  console.log(result3.finalOutput.substring(0, 600) + "...");
  console.log("\n📊 Cascade Check:");
  console.log(`  Duration: ${originalDays} days → ${result3.context.summary?.duration_days} days`);
  console.log(`  Itinerary Days: ${originalDays} → ${result3.context.itinerary?.days?.length}`);
  console.log(`  Return Date: ${originalReturn} → ${result3.context.summary?.return_date}`);
  console.log(`  Budget: ₹${originalBudget} (unchanged)`);

  // Validate cascade
  console.log("\n🔍 Validation:");
  console.log(`  ✓ Duration updated: ${result3.context.summary?.duration_days === 3 ? '✅' : '❌ FAILED'}`);
  console.log(`  ✓ Itinerary synced: ${result3.context.itinerary?.days?.length === 3 ? '✅' : '❌ FAILED'}`);
  console.log(`  ✓ Return date recalculated: ${result3.context.summary?.return_date !== originalReturn ? '✅' : '❌ FAILED'}`);

  // Turn 4: Multiple modifications at once
  console.log("\n\n🔹 TURN 4: Multiple modifications - budget + dates");
  console.log("-".repeat(80));
  const msg4 = "Change budget to ₹80,000 and move dates to Jan 20-22, 2026";
  conversationHistory.push({ role: 'user', content: msg4 });

  const result4 = await runMultiAgentSystem(msg4, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result4.finalOutput });
  results.push(result4);

  console.log("✅ Agent Response:");
  console.log(result4.finalOutput.substring(0, 500) + "...");
  console.log("\n📊 Multi-Modification Check:");
  console.log(`  Budget: ₹${result3.context.summary?.budget?.amount} → ₹${result4.context.summary?.budget?.amount}`);
  console.log(`  Outbound: ${result3.context.summary?.outbound_date} → ${result4.context.summary?.outbound_date}`);
  console.log(`  Return: ${result3.context.summary?.return_date} → ${result4.context.summary?.return_date}`);

  console.log("\n🔍 Validation:");
  console.log(`  ✓ Budget updated: ${result4.context.summary?.budget?.amount === 80000 ? '✅' : '❌ FAILED'}`);
  console.log(`  ✓ Dates updated: ${result4.context.summary?.outbound_date === '2026-01-20' ? '✅' : '❌ FAILED'}`);
  console.log(`  ✓ Duration preserved: ${result4.context.summary?.duration_days === 3 ? '✅' : '❌ FAILED'}`);

  // Turn 5: Add specific activity modification
  console.log("\n\n🔹 TURN 5: Activity-level modification");
  console.log("-".repeat(80));
  const msg5 = "Add water sports to Day 2 afternoon";
  conversationHistory.push({ role: 'user', content: msg5 });

  const result5 = await runMultiAgentSystem(msg5, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result5.finalOutput });
  results.push(result5);

  console.log("✅ Agent Response:");
  console.log(result5.finalOutput.substring(0, 500) + "...");
  console.log("\n📊 Activity Modification:");
  console.log(`  Itinerary days: ${result5.context.itinerary?.days?.length}`);
  console.log(`  ✅ Should update Day 2 afternoon with water sports`);

  return { chatId, results };
}

// ============================================================================
// TEST SUITE 3: Incremental Information Gathering
// ============================================================================
async function testIncrementalGathering() {
  console.log("\n\n📋 TEST SUITE 3: Incremental Information Gathering");
  console.log("=" .repeat(80));
  console.log("Scenario: User provides info piece by piece over many turns\n");

  const chatId = 'test-incremental-' + Date.now();
  let conversationHistory = [];
  let results = [];

  // Turn 1: Just destination
  console.log("\n🔹 TURN 1: Only destination");
  console.log("-".repeat(80));
  const msg1 = "I want to visit Paris";
  conversationHistory.push({ role: 'user', content: msg1 });

  const result1 = await runMultiAgentSystem(msg1, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result1.finalOutput });
  results.push(result1);

  console.log("✅ Agent Response:");
  console.log(result1.finalOutput);
  console.log(`\n📊 Destination: ${result1.context.summary?.destination?.city}`);
  console.log(`  ✅ Should ask for origin, dates, pax, budget`);

  // Turn 2: Origin only
  console.log("\n\n🔹 TURN 2: Add origin");
  console.log("-".repeat(80));
  const msg2 = "From Mumbai";
  conversationHistory.push({ role: 'user', content: msg2 });

  const result2 = await runMultiAgentSystem(msg2, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result2.finalOutput });
  results.push(result2);

  console.log("✅ Agent Response:");
  console.log(result2.finalOutput);
  console.log(`\n📊 Origin: ${result2.context.summary?.origin?.city}`);
  console.log(`  ✅ Should still ask for dates, pax, budget`);

  // Turn 3: Dates only
  console.log("\n\n🔹 TURN 3: Add dates");
  console.log("-".repeat(80));
  const msg3 = "February 10-17, 2026";
  conversationHistory.push({ role: 'user', content: msg3 });

  const result3 = await runMultiAgentSystem(msg3, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result3.finalOutput });
  results.push(result3);

  console.log("✅ Agent Response:");
  console.log(result3.finalOutput);
  console.log(`\n📊 Dates: ${result3.context.summary?.outbound_date} to ${result3.context.summary?.return_date}`);
  console.log(`  Duration: ${result3.context.summary?.duration_days} days`);
  console.log(`  ✅ Should calculate duration and ask for pax, budget`);

  // Turn 4: Pax only
  console.log("\n\n🔹 TURN 4: Add passenger count");
  console.log("-".rect(80));
  const msg4 = "2 adults";
  conversationHistory.push({ role: 'user', content: msg4 });

  const result4 = await runMultiAgentSystem(msg4, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result4.finalOutput });
  results.push(result4);

  console.log("✅ Agent Response:");
  console.log(result4.finalOutput);
  console.log(`\n📊 Pax: ${result4.context.summary?.pax}`);
  console.log(`  ✅ Should have all critical info, ask for budget or confirm`);

  // Turn 5: Budget and confirm
  console.log("\n\n🔹 TURN 5: Add budget and confirm");
  console.log("-".repeat(80));
  const msg5 = "Budget is ₹2,50,000 total. Yes, create the itinerary";
  conversationHistory.push({ role: 'user', content: msg5 });

  const result5 = await runMultiAgentSystem(msg5, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result5.finalOutput });
  results.push(result5);

  console.log("✅ Agent Response:");
  console.log(result5.finalOutput.substring(0, 600) + "...");
  console.log("\n📊 Final Summary:");
  console.log(`  Origin: ${result5.context.summary?.origin?.city}`);
  console.log(`  Destination: ${result5.context.summary?.destination?.city}`);
  console.log(`  Duration: ${result5.context.summary?.duration_days} days`);
  console.log(`  Pax: ${result5.context.summary?.pax}`);
  console.log(`  Budget: ₹${result5.context.summary?.budget?.amount}`);
  console.log(`  Itinerary Days: ${result5.context.itinerary?.days?.length}`);
  console.log(`  ✅ All slots filled, itinerary created`);

  return { chatId, results };
}

// ============================================================================
// TEST SUITE 4: Edge Cases and Contradictions
// ============================================================================
async function testEdgeCases() {
  console.log("\n\n📋 TEST SUITE 4: Edge Cases and Contradictions");
  console.log("=" .repeat(80));
  console.log("Scenario: Conflicting info, date calculations, same-city trips\n");

  const chatId = 'test-edge-cases-' + Date.now();
  let conversationHistory = [];
  let results = [];

  // Edge Case 1: Conflicting duration
  console.log("\n🔹 EDGE CASE 1: Conflicting duration info");
  console.log("-".repeat(80));
  const msg1 = "5-day trip to Kerala from Delhi, Jan 10-12, 2026, 2 people";
  conversationHistory.push({ role: 'user', content: msg1 });

  const result1 = await runMultiAgentSystem(msg1, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result1.finalOutput });
  results.push(result1);

  console.log("✅ Agent Response:");
  console.log(result1.finalOutput);
  console.log("\n📊 Conflict Resolution:");
  console.log(`  User said: "5-day trip" AND "Jan 10-12" (3 days)`);
  console.log(`  Agent picked: ${result1.context.summary?.duration_days} days`);
  console.log(`  Dates: ${result1.context.summary?.outbound_date} to ${result1.context.summary?.return_date}`);
  console.log(`  ✅ Should ask user to clarify OR pick dates over text`);

  // Edge Case 2: Same-city "trip"
  console.log("\n\n🔹 EDGE CASE 2: Same-city staycation");
  console.log("-".repeat(80));
  const chatId2 = 'test-edge-staycation-' + Date.now();
  let conversationHistory2 = [];

  const msg2 = "Plan a 2-day staycation in Mumbai, I'm also from Mumbai, 2 people";
  conversationHistory2.push({ role: 'user', content: msg2 });

  const result2 = await runMultiAgentSystem(msg2, chatId2, conversationHistory2);
  conversationHistory2.push({ role: 'assistant', content: result2.finalOutput });
  results.push(result2);

  console.log("✅ Agent Response:");
  console.log(result2.finalOutput.substring(0, 500) + "...");
  console.log("\n📊 Same-City Check:");
  console.log(`  Origin: ${result2.context.summary?.origin?.city}`);
  console.log(`  Destination: ${result2.context.summary?.destination?.city}`);
  console.log(`  ✅ Should handle staycation (no flights, local activities)`);

  // Edge Case 3: Far future dates
  console.log("\n\n🔹 EDGE CASE 3: Far future dates");
  console.log("-".repeat(80));
  const chatId3 = 'test-edge-future-' + Date.now();
  let conversationHistory3 = [];

  const msg3 = "Trip to Bali from Mumbai, December 2027, 7 days, 4 people";
  conversationHistory3.push({ role: 'user', content: msg3 });

  const result3 = await runMultiAgentSystem(msg3, chatId3, conversationHistory3);
  conversationHistory3.push({ role: 'assistant', content: result3.finalOutput });
  results.push(result3);

  console.log("✅ Agent Response:");
  console.log(result3.finalOutput.substring(0, 400) + "...");
  console.log("\n📊 Future Date Handling:");
  console.log(`  Dates: ${result3.context.summary?.outbound_date} to ${result3.context.summary?.return_date}`);
  console.log(`  ✅ Should handle future dates, may note planning limitations`);

  // Edge Case 4: Zero budget
  console.log("\n\n🔹 EDGE CASE 4: No budget / tight budget");
  console.log("-".repeat(80));
  const chatId4 = 'test-edge-budget-' + Date.now();
  let conversationHistory4 = [];

  const msg4 = "Cheapest possible 3-day trip to Goa from Pune, 2 people, budget ₹10,000";
  conversationHistory4.push({ role: 'user', content: msg4 });

  const result4 = await runMultiAgentSystem(msg4, chatId4, conversationHistory4);
  conversationHistory4.push({ role: 'assistant', content: result4.finalOutput });
  results.push(result4);

  console.log("✅ Agent Response:");
  console.log(result4.finalOutput.substring(0, 500) + "...");
  console.log("\n📊 Budget Constraint:");
  console.log(`  Budget: ₹${result4.context.summary?.budget?.amount}`);
  console.log(`  ✅ Should acknowledge tight budget, suggest budget options`);

  return { chatId, results };
}

// ============================================================================
// TEST SUITE 5: Web Search Intelligence
// ============================================================================
async function testWebSearchIntelligence() {
  console.log("\n\n📋 TEST SUITE 5: Web Search Intelligence");
  console.log("=" .repeat(80));
  console.log("Scenario: Mix of questions requiring web search vs knowledge\n");

  const testCases = [
    {
      name: "Should USE web search - current festivals",
      chatId: "test-search-festivals-" + Date.now(),
      message: "Planning trip to Jaipur in March 2026. Are there any festivals during that time?",
      expectSearch: true
    },
    {
      name: "Should NOT use - general attractions",
      chatId: "test-no-search-attractions-" + Date.now(),
      message: "What are the must-see places in Rome?",
      expectSearch: false
    },
    {
      name: "Should USE - current events",
      chatId: "test-search-events-" + Date.now(),
      message: "Any major events in Dubai in January 2026?",
      expectSearch: true
    },
    {
      name: "Should NOT use - geography",
      chatId: "test-no-search-distance-" + Date.now(),
      message: "How far is Agra from Delhi?",
      expectSearch: false
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🔹 ${testCase.name}`);
    console.log("-".repeat(80));
    console.log(`Message: "${testCase.message}"`);

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

    console.log(`\n🔍 Web Search Check:`);
    console.log(`  Expected: ${testCase.expectSearch ? 'USE search' : 'NO search'}`);
    console.log(`  Actual: ${usedWebSearch ? 'USED search' : 'NO search'}`);
    console.log(`  Result: ${usedWebSearch === testCase.expectSearch ? '✅ CORRECT' : '❌ FAILED'}`);
  }
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================
async function runAllTests() {
  const startTime = Date.now();

  try {
    console.log("\n🚀 Starting Comprehensive End-to-End Testing");
    console.log("This will take several minutes...\n");

    // Run all test suites
    await testVagueDestinationJourney();
    await testModificationCascade();
    await testIncrementalGathering();
    await testEdgeCases();
    await testWebSearchIntelligence();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("\n\n" + "=".repeat(80));
    console.log("✨ ALL TESTS COMPLETED");
    console.log("=".repeat(80));
    console.log(`\n⏱️  Total Time: ${duration} seconds`);
    console.log("\n📊 Test Suites Run:");
    console.log("  1. ✓ Complex Vague Destination Journey (5 turns)");
    console.log("  2. ✓ Modification Cascade Stress Test (5 turns)");
    console.log("  3. ✓ Incremental Information Gathering (5 turns)");
    console.log("  4. ✓ Edge Cases and Contradictions (4 scenarios)");
    console.log("  5. ✓ Web Search Intelligence (4 scenarios)");
    console.log("\n🔍 Review output above for any ❌ FAILED validations");

  } catch (error) {
    console.error("\n\n❌ TESTS FAILED WITH ERROR:");
    console.error(error.message);
    console.error(error.stack);
  }
}

runAllTests().catch(console.error);
