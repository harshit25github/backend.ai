import 'dotenv/config';
import { run, user } from '@openai/agents';
import {
  createEnhancedContext,
  enhancedManagerAgent
} from './src/ai/enhanced-manager.js';

console.log("🧪 Testing Enhanced Manager Agents with Optimized Prompts\n");
console.log("=" .repeat(80));

// Helper function to run a test
async function runTest(testName, message, expectedBehavior) {
  console.log(`\n📋 ${testName}`);
  console.log("=" .repeat(80));
  console.log(`Expected: ${expectedBehavior}\n`);
  console.log(`🔹 User: "${message}"`);
  console.log("-".repeat(80));

  const appContext = createEnhancedContext({ name: 'Test User', uid: 1 });
  const thread = [];

  try {
    const res = await run(
      enhancedManagerAgent,
      thread.concat(user(message)),
      { context: appContext }
    );

    console.log(`\n✅ Last Agent: ${res.lastAgent?.name ?? 'Unknown'}`);
    console.log("\n✅ Agent Response:");

    const output = Array.isArray(res.finalOutput)
      ? res.finalOutput.map(String).join('\n')
      : String(res.finalOutput ?? '');

    console.log(output);

    return {
      output,
      context: appContext,
      lastAgent: res.lastAgent?.name
    };
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// TEST 1: Destination Agent - Vague Request (Should Ask TEXT Questions)
// ============================================================================
async function testDestinationAgentVagueRequest() {
  const result = await runTest(
    "TEST 1: Destination Agent - Vague Request",
    "I want to travel somewhere",
    "Agent provides suggestions AND asks TEXT questions to narrow down"
  );

  console.log("\n\n📊 Validation Checks:");

  // Check 1: Did agent provide destination suggestions?
  const hasDestinations = result.output.includes('##') ||
                          /\b(Bali|Paris|Tokyo|Rome|Dubai|Thailand|Maldives)\b/i.test(result.output);
  console.log(`  ${hasDestinations ? '✅' : '❌'} Provided destination suggestions`);

  // Check 2: Did agent ask TEXT questions?
  const hasTextQuestions = result.output.includes('?') &&
                          (/where|budget|how many|when|what kind|which/i.test(result.output));
  console.log(`  ${hasTextQuestions ? '✅' : '❌'} Asked conversational TEXT questions`);

  // Check 3: Did agent populate suggestedQuestions?
  const suggestedQuestionsCount = result.context.summary?.suggestedQuestions?.length || 0;
  console.log(`  ${suggestedQuestionsCount > 0 ? '✅' : '❌'} Populated suggestedQuestions array (${suggestedQuestionsCount} questions)`);

  if (suggestedQuestionsCount > 0) {
    console.log(`\n  📝 suggestedQuestions:`);
    result.context.summary.suggestedQuestions.slice(0, 3).forEach(q => {
      console.log(`     - "${q}"`);
    });
  }

  // Check 4: Which agent handled this?
  console.log(`\n  🤖 Handled by: ${result.lastAgent}`);

  console.log("\n" + "=".repeat(80));
  return { hasDestinations, hasTextQuestions, hasSuggestedQuestions: suggestedQuestionsCount > 0 };
}

// ============================================================================
// TEST 2: Destination Agent - Specific Destination (Should Ask if Want Itinerary)
// ============================================================================
async function testDestinationAgentSpecificDestination() {
  const result = await runTest(
    "TEST 2: Destination Agent - Specific Destination",
    "Tell me about Paris",
    "Agent provides insights AND asks if user wants itinerary"
  );

  console.log("\n\n📊 Validation Checks:");

  // Check 1: Did agent provide Paris insights?
  const hasInsights = /paris/i.test(result.output) &&
                     (/eiffel|louvre|seine|notre|champs|versailles|sacré|montmartre/i.test(result.output));
  console.log(`  ${hasInsights ? '✅' : '❌'} Provided destination insights`);

  // Check 2: Did agent ask about creating itinerary?
  const asksAboutItinerary = result.output.includes('?') &&
                            (/itinerary|plan|create|would you like|interested in/i.test(result.output));
  console.log(`  ${asksAboutItinerary ? '✅' : '❌'} Asked if user wants itinerary`);

  // Check 3: Did agent populate suggestedQuestions?
  const suggestedQuestionsCount = result.context.summary?.suggestedQuestions?.length || 0;
  console.log(`  ${suggestedQuestionsCount > 0 ? '✅' : '❌'} Populated suggestedQuestions array (${suggestedQuestionsCount} questions)`);

  if (suggestedQuestionsCount > 0) {
    console.log(`\n  📝 suggestedQuestions:`);
    result.context.summary.suggestedQuestions.slice(0, 3).forEach(q => {
      console.log(`     - "${q}"`);
    });
  }

  // Check 4: Which agent handled this?
  console.log(`\n  🤖 Handled by: ${result.lastAgent}`);

  console.log("\n" + "=".repeat(80));
  return { hasInsights, asksAboutItinerary, hasSuggestedQuestions: suggestedQuestionsCount > 0 };
}

// ============================================================================
// TEST 3: Itinerary Agent - Missing Required Fields (Should Ask in TEXT)
// ============================================================================
async function testItineraryAgentMissingFields() {
  const result = await runTest(
    "TEST 3: Itinerary Agent - Missing Required Fields",
    "Create a Paris itinerary",
    "Agent asks for missing fields in TEXT (no partial itinerary)"
  );

  console.log("\n\n📊 Validation Checks:");

  // Check 1: Did agent ask for missing required fields?
  const asksForRequiredFields = result.output.includes('?') &&
                               (/how many days|duration|how many travelers|how many people|pax/i.test(result.output));
  console.log(`  ${asksForRequiredFields ? '✅' : '❌'} Asked for missing required fields in TEXT`);

  // Check 2: Did agent avoid creating partial itinerary?
  const noPartialItinerary = !/Day 1:|### Morning|## Day \d+:/i.test(result.output);
  console.log(`  ${noPartialItinerary ? '✅' : '❌'} Did NOT create partial itinerary`);

  // Check 3: Did agent populate suggestedQuestions?
  const suggestedQuestionsCount = result.context.summary?.suggestedQuestions?.length || 0;
  console.log(`  ${suggestedQuestionsCount > 0 ? '✅' : '❌'} Populated suggestedQuestions array (${suggestedQuestionsCount} questions)`);

  // Check 4: Did agent capture destination?
  const capturedDestination = result.context.summary?.destination?.city;
  console.log(`  ${capturedDestination ? '✅' : '❌'} Captured destination: ${capturedDestination || 'NOT SET'}`);

  if (suggestedQuestionsCount > 0) {
    console.log(`\n  📝 suggestedQuestions:`);
    result.context.summary.suggestedQuestions.slice(0, 3).forEach(q => {
      console.log(`     - "${q}"`);
    });
  }

  // Check 5: Which agent handled this?
  console.log(`\n  🤖 Handled by: ${result.lastAgent}`);

  console.log("\n" + "=".repeat(80));
  return { asksForRequiredFields, noPartialItinerary, hasSuggestedQuestions: suggestedQuestionsCount > 0 };
}

// ============================================================================
// TEST 4: Itinerary Agent - Complete Info (Should Create Full Itinerary)
// ============================================================================
async function testItineraryAgentCompleteInfo() {
  const result = await runTest(
    "TEST 4: Itinerary Agent - Complete Info",
    "Create a 3-day Rome itinerary for 2 people with mid-range budget",
    "Agent creates full detailed itinerary with all activities"
  );

  console.log("\n\n📊 Validation Checks:");

  // Check 1: Did agent create full itinerary?
  const hasFullItinerary = /Day 1:|Day 2:|Day 3:/gi.test(result.output) &&
                          /### Morning|### Afternoon|### Evening/i.test(result.output);
  console.log(`  ${hasFullItinerary ? '✅' : '❌'} Created full 3-day itinerary`);

  // Check 2: Does itinerary include practical details?
  const hasDetails = /Duration:|Cost:|Transport:|Tip:|€|₹/i.test(result.output);
  console.log(`  ${hasDetails ? '✅' : '❌'} Included transport/cost/duration details`);

  // Check 3: Did agent populate suggestedQuestions?
  const suggestedQuestionsCount = result.context.summary?.suggestedQuestions?.length || 0;
  console.log(`  ${suggestedQuestionsCount > 0 ? '✅' : '❌'} Populated suggestedQuestions array (${suggestedQuestionsCount} questions)`);

  // Check 4: Did agent call update_itinerary tool?
  const hasItineraryData = result.context.itinerary?.days?.length > 0;
  console.log(`  ${hasItineraryData ? '✅' : '❌'} Called update_itinerary tool (${result.context.itinerary?.days?.length || 0} days stored)`);

  // Check 5: Captured all trip details?
  const capturedDetails = {
    destination: result.context.summary?.destination?.city,
    duration: result.context.summary?.duration_days,
    pax: result.context.summary?.pax
  };
  console.log(`  ✅ Captured: destination=${capturedDetails.destination}, duration=${capturedDetails.duration}, pax=${capturedDetails.pax}`);

  if (suggestedQuestionsCount > 0) {
    console.log(`\n  📝 suggestedQuestions:`);
    result.context.summary.suggestedQuestions.slice(0, 3).forEach(q => {
      console.log(`     - "${q}"`);
    });
  }

  // Check 6: Which agent handled this?
  console.log(`\n  🤖 Handled by: ${result.lastAgent}`);

  console.log("\n" + "=".repeat(80));
  return { hasFullItinerary, hasDetails, hasSuggestedQuestions: suggestedQuestionsCount > 0, hasItineraryData };
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================
async function runAllTests() {
  const startTime = Date.now();

  try {
    console.log("\n🚀 Starting Enhanced Manager Agent Tests\n");

    const test1Results = await testDestinationAgentVagueRequest();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between tests

    const test2Results = await testDestinationAgentSpecificDestination();
    await new Promise(resolve => setTimeout(resolve, 2000));

    const test3Results = await testItineraryAgentMissingFields();
    await new Promise(resolve => setTimeout(resolve, 2000));

    const test4Results = await testItineraryAgentCompleteInfo();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Summary
    console.log("\n\n" + "=".repeat(80));
    console.log("✨ TEST SUMMARY");
    console.log("=".repeat(80));

    console.log("\n📊 Results:\n");

    console.log("TEST 1: Destination Agent - Vague Request");
    console.log(`  Provided Suggestions: ${test1Results.hasDestinations ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Asked TEXT Questions: ${test1Results.hasTextQuestions ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  suggestedQuestions Array: ${test1Results.hasSuggestedQuestions ? '✅ PASS' : '❌ FAIL'}`);

    console.log("\nTEST 2: Destination Agent - Specific Destination");
    console.log(`  Provided Insights: ${test2Results.hasInsights ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Asked About Itinerary: ${test2Results.asksAboutItinerary ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  suggestedQuestions Array: ${test2Results.hasSuggestedQuestions ? '✅ PASS' : '❌ FAIL'}`);

    console.log("\nTEST 3: Itinerary Agent - Missing Fields");
    console.log(`  Asked for Required Fields: ${test3Results.asksForRequiredFields ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  No Partial Itinerary: ${test3Results.noPartialItinerary ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  suggestedQuestions Array: ${test3Results.hasSuggestedQuestions ? '✅ PASS' : '❌ FAIL'}`);

    console.log("\nTEST 4: Itinerary Agent - Complete Info");
    console.log(`  Created Full Itinerary: ${test4Results.hasFullItinerary ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Included Details: ${test4Results.hasDetails ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  suggestedQuestions Array: ${test4Results.hasSuggestedQuestions ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  update_itinerary Called: ${test4Results.hasItineraryData ? '✅ PASS' : '❌ FAIL'}`);

    // Count passes
    const allChecks = [
      test1Results.hasDestinations, test1Results.hasTextQuestions, test1Results.hasSuggestedQuestions,
      test2Results.hasInsights, test2Results.asksAboutItinerary, test2Results.hasSuggestedQuestions,
      test3Results.asksForRequiredFields, test3Results.noPartialItinerary, test3Results.hasSuggestedQuestions,
      test4Results.hasFullItinerary, test4Results.hasDetails, test4Results.hasSuggestedQuestions, test4Results.hasItineraryData
    ];
    const passed = allChecks.filter(Boolean).length;
    const total = allChecks.length;

    console.log("\n" + "=".repeat(80));
    console.log(`✨ OVERALL: ${passed}/${total} checks passed (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`⏱️  Total Time: ${duration} seconds`);

    if (passed === total) {
      console.log("\n🎉 ALL TESTS PASSED! The optimized prompts are working perfectly!");
    } else if (passed >= total * 0.8) {
      console.log("\n✅ Most tests passed! Minor improvements needed.");
    } else {
      console.log("\n⚠️  Some tests failed. Review the output above for details.");
    }

    console.log("=".repeat(80) + "\n");

  } catch (error) {
    console.error("\n\n❌ TESTS FAILED WITH ERROR:");
    console.error(error.message);
    console.error(error.stack);
  }
}

runAllTests().catch(console.error);
