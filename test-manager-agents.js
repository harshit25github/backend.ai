import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log("🧪 Testing Manager Agents with Optimized Prompts\n");
console.log("=" .repeat(80));

// ============================================================================
// TEST 1: Destination Agent - Vague Request (Should Ask TEXT Questions)
// ============================================================================
async function testDestinationAgentVagueRequest() {
  console.log("\n📋 TEST 1: Destination Agent - Vague Request");
  console.log("=" .repeat(80));
  console.log("Expected: Agent provides suggestions AND asks TEXT questions to narrow down\n");

  const chatId = 'test-dest-vague-' + Date.now();
  const message = "I want to travel somewhere";

  console.log(`🔹 User: "${message}"`);
  console.log("-".repeat(80));

  const result = await runMultiAgentSystem(
    message,
    chatId,
    [{ role: 'user', content: message }]
  );

  console.log("\n✅ Agent Response:");
  console.log(result.finalOutput);

  console.log("\n\n📊 Validation Checks:");

  // Check 1: Did agent provide destination suggestions?
  const hasDestinations = result.finalOutput.includes('##') &&
                          (result.finalOutput.toLowerCase().includes('bali') ||
                           result.finalOutput.toLowerCase().includes('paris') ||
                           result.finalOutput.toLowerCase().includes('tokyo'));
  console.log(`  ${hasDestinations ? '✅' : '❌'} Provided destination suggestions`);

  // Check 2: Did agent ask TEXT questions?
  const hasTextQuestions = result.finalOutput.includes('?') &&
                          (result.finalOutput.toLowerCase().includes('where') ||
                           result.finalOutput.toLowerCase().includes('budget') ||
                           result.finalOutput.toLowerCase().includes('how many days') ||
                           result.finalOutput.toLowerCase().includes('what kind'));
  console.log(`  ${hasTextQuestions ? '✅' : '❌'} Asked conversational TEXT questions`);

  // Check 3: Did agent populate suggestedQuestions?
  const hasSuggestedQuestions = result.context.summary?.suggestedQuestions?.length > 0;
  console.log(`  ${hasSuggestedQuestions ? '✅' : '❌'} Populated suggestedQuestions array (${result.context.summary?.suggestedQuestions?.length || 0} questions)`);

  if (hasSuggestedQuestions) {
    console.log(`\n  📝 suggestedQuestions:`);
    result.context.summary.suggestedQuestions.slice(0, 3).forEach(q => {
      console.log(`     - "${q}"`);
    });
  }

  console.log("\n" + "=".repeat(80));

  return { hasDestinations, hasTextQuestions, hasSuggestedQuestions };
}

// ============================================================================
// TEST 2: Destination Agent - Specific Destination (Should Ask if Want Itinerary)
// ============================================================================
async function testDestinationAgentSpecificDestination() {
  console.log("\n\n📋 TEST 2: Destination Agent - Specific Destination");
  console.log("=" .repeat(80));
  console.log("Expected: Agent provides insights AND asks if user wants itinerary\n");

  const chatId = 'test-dest-specific-' + Date.now();
  const message = "Tell me about Paris";

  console.log(`🔹 User: "${message}"`);
  console.log("-".repeat(80));

  const result = await runMultiAgentSystem(
    message,
    chatId,
    [{ role: 'user', content: message }]
  );

  console.log("\n✅ Agent Response:");
  console.log(result.finalOutput);

  console.log("\n\n📊 Validation Checks:");

  // Check 1: Did agent provide Paris insights?
  const hasInsights = result.finalOutput.toLowerCase().includes('paris') &&
                     (result.finalOutput.toLowerCase().includes('eiffel') ||
                      result.finalOutput.toLowerCase().includes('louvre') ||
                      result.finalOutput.toLowerCase().includes('visa') ||
                      result.finalOutput.toLowerCase().includes('best time'));
  console.log(`  ${hasInsights ? '✅' : '❌'} Provided destination insights`);

  // Check 2: Did agent ask about creating itinerary?
  const asksAboutItinerary = result.finalOutput.includes('?') &&
                            (result.finalOutput.toLowerCase().includes('itinerary') ||
                             result.finalOutput.toLowerCase().includes('plan') ||
                             result.finalOutput.toLowerCase().includes('would you like'));
  console.log(`  ${asksAboutItinerary ? '✅' : '❌'} Asked if user wants itinerary`);

  // Check 3: Did agent populate suggestedQuestions?
  const hasSuggestedQuestions = result.context.summary?.suggestedQuestions?.length > 0;
  console.log(`  ${hasSuggestedQuestions ? '✅' : '❌'} Populated suggestedQuestions array (${result.context.summary?.suggestedQuestions?.length || 0} questions)`);

  if (hasSuggestedQuestions) {
    console.log(`\n  📝 suggestedQuestions:`);
    result.context.summary.suggestedQuestions.slice(0, 3).forEach(q => {
      console.log(`     - "${q}"`);
    });
  }

  console.log("\n" + "=".repeat(80));

  return { hasInsights, asksAboutItinerary, hasSuggestedQuestions };
}

// ============================================================================
// TEST 3: Itinerary Agent - Missing Required Fields (Should Ask in TEXT)
// ============================================================================
async function testItineraryAgentMissingFields() {
  console.log("\n\n📋 TEST 3: Itinerary Agent - Missing Required Fields");
  console.log("=" .repeat(80));
  console.log("Expected: Agent asks for missing fields in TEXT (no partial itinerary)\n");

  const chatId = 'test-itin-missing-' + Date.now();
  const message = "Create a Paris itinerary";

  console.log(`🔹 User: "${message}"`);
  console.log("-".repeat(80));

  const result = await runMultiAgentSystem(
    message,
    chatId,
    [{ role: 'user', content: message }]
  );

  console.log("\n✅ Agent Response:");
  console.log(result.finalOutput);

  console.log("\n\n📊 Validation Checks:");

  // Check 1: Did agent ask for missing required fields?
  const asksForRequiredFields = result.finalOutput.includes('?') &&
                               (result.finalOutput.toLowerCase().includes('how many days') ||
                                result.finalOutput.toLowerCase().includes('duration') ||
                                result.finalOutput.toLowerCase().includes('how many travelers') ||
                                result.finalOutput.toLowerCase().includes('pax'));
  console.log(`  ${asksForRequiredFields ? '✅' : '❌'} Asked for missing required fields in TEXT`);

  // Check 2: Did agent avoid creating partial itinerary?
  const noPartialItinerary = !result.finalOutput.includes('Day 1:') &&
                            !result.finalOutput.includes('### Morning');
  console.log(`  ${noPartialItinerary ? '✅' : '❌'} Did NOT create partial itinerary`);

  // Check 3: Did agent populate suggestedQuestions?
  const hasSuggestedQuestions = result.context.summary?.suggestedQuestions?.length > 0;
  console.log(`  ${hasSuggestedQuestions ? '✅' : '❌'} Populated suggestedQuestions array (${result.context.summary?.suggestedQuestions?.length || 0} questions)`);

  // Check 4: Did agent capture destination?
  const capturedDestination = result.context.summary?.destination?.city;
  console.log(`  ${capturedDestination ? '✅' : '❌'} Captured destination: ${capturedDestination || 'NOT SET'}`);

  if (hasSuggestedQuestions) {
    console.log(`\n  📝 suggestedQuestions:`);
    result.context.summary.suggestedQuestions.slice(0, 3).forEach(q => {
      console.log(`     - "${q}"`);
    });
  }

  console.log("\n" + "=".repeat(80));

  return { asksForRequiredFields, noPartialItinerary, hasSuggestedQuestions };
}

// ============================================================================
// TEST 4: Itinerary Agent - Complete Info (Should Create Full Itinerary)
// ============================================================================
async function testItineraryAgentCompleteInfo() {
  console.log("\n\n📋 TEST 4: Itinerary Agent - Complete Info");
  console.log("=" .repeat(80));
  console.log("Expected: Agent creates full detailed itinerary with all activities\n");

  const chatId = 'test-itin-complete-' + Date.now();
  const message = "Create a 3-day Rome itinerary for 2 people with mid-range budget";

  console.log(`🔹 User: "${message}"`);
  console.log("-".repeat(80));

  const result = await runMultiAgentSystem(
    message,
    chatId,
    [{ role: 'user', content: message }]
  );

  console.log("\n✅ Agent Response:");
  console.log(result.finalOutput.substring(0, 1500) + "\n\n... (truncated for readability) ...\n");

  console.log("\n📊 Validation Checks:");

  // Check 1: Did agent create full itinerary?
  const hasFullItinerary = result.finalOutput.includes('Day 1:') &&
                          result.finalOutput.includes('Day 2:') &&
                          result.finalOutput.includes('Day 3:') &&
                          result.finalOutput.includes('### Morning');
  console.log(`  ${hasFullItinerary ? '✅' : '❌'} Created full 3-day itinerary`);

  // Check 2: Does itinerary include practical details?
  const hasDetails = result.finalOutput.includes('Duration:') ||
                    result.finalOutput.includes('Cost:') ||
                    result.finalOutput.includes('Transport:') ||
                    result.finalOutput.includes('Tip:');
  console.log(`  ${hasDetails ? '✅' : '❌'} Included transport/cost/duration details`);

  // Check 3: Did agent populate suggestedQuestions?
  const hasSuggestedQuestions = result.context.summary?.suggestedQuestions?.length > 0;
  console.log(`  ${hasSuggestedQuestions ? '✅' : '❌'} Populated suggestedQuestions array (${result.context.summary?.suggestedQuestions?.length || 0} questions)`);

  // Check 4: Did agent call update_itinerary tool?
  const hasItineraryData = result.context.itinerary?.days?.length > 0;
  console.log(`  ${hasItineraryData ? '✅' : '❌'} Called update_itinerary tool (${result.context.itinerary?.days?.length || 0} days stored)`);

  // Check 5: Captured all trip details?
  const capturedDetails = {
    destination: result.context.summary?.destination?.city,
    duration: result.context.summary?.duration_days,
    pax: result.context.summary?.pax
  };
  console.log(`  Captured: destination=${capturedDetails.destination}, duration=${capturedDetails.duration}, pax=${capturedDetails.pax}`);

  if (hasSuggestedQuestions) {
    console.log(`\n  📝 suggestedQuestions:`);
    result.context.summary.suggestedQuestions.slice(0, 3).forEach(q => {
      console.log(`     - "${q}"`);
    });
  }

  console.log("\n" + "=".repeat(80));

  return { hasFullItinerary, hasDetails, hasSuggestedQuestions, hasItineraryData };
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================
async function runAllTests() {
  const startTime = Date.now();

  try {
    console.log("\n🚀 Starting Manager Agent Tests\n");

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
    console.log(`  Provided Suggestions: ${test1Results.hasDestinations ? '✅' : '❌'}`);
    console.log(`  Asked TEXT Questions: ${test1Results.hasTextQuestions ? '✅' : '❌'}`);
    console.log(`  suggestedQuestions Array: ${test1Results.hasSuggestedQuestions ? '✅' : '❌'}`);

    console.log("\nTEST 2: Destination Agent - Specific Destination");
    console.log(`  Provided Insights: ${test2Results.hasInsights ? '✅' : '❌'}`);
    console.log(`  Asked About Itinerary: ${test2Results.asksAboutItinerary ? '✅' : '❌'}`);
    console.log(`  suggestedQuestions Array: ${test2Results.hasSuggestedQuestions ? '✅' : '❌'}`);

    console.log("\nTEST 3: Itinerary Agent - Missing Fields");
    console.log(`  Asked for Required Fields: ${test3Results.asksForRequiredFields ? '✅' : '❌'}`);
    console.log(`  No Partial Itinerary: ${test3Results.noPartialItinerary ? '✅' : '❌'}`);
    console.log(`  suggestedQuestions Array: ${test3Results.hasSuggestedQuestions ? '✅' : '❌'}`);

    console.log("\nTEST 4: Itinerary Agent - Complete Info");
    console.log(`  Created Full Itinerary: ${test4Results.hasFullItinerary ? '✅' : '❌'}`);
    console.log(`  Included Details: ${test4Results.hasDetails ? '✅' : '❌'}`);
    console.log(`  suggestedQuestions Array: ${test4Results.hasSuggestedQuestions ? '✅' : '❌'}`);
    console.log(`  update_itinerary Called: ${test4Results.hasItineraryData ? '✅' : '❌'}`);

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
    console.log("=".repeat(80) + "\n");

  } catch (error) {
    console.error("\n\n❌ TESTS FAILED WITH ERROR:");
    console.error(error.message);
    console.error(error.stack);
  }
}

runAllTests().catch(console.error);
