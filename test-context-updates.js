import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log("🧪 Testing Context Updates & Slot Filling\n");
console.log("=" .repeat(80));

const chatId = 'test-context-updates-' + Date.now();
let conversationHistory = [];

async function testSlotFilling() {
  console.log("\n📋 PHASE 1: Initial Request - Check Slot Filling");
  console.log("-".repeat(80));

  const msg1 = "Plan a 5-day trip to Goa from Mumbai for 2 people";
  conversationHistory.push({ role: 'user', content: msg1 });

  const result1 = await runMultiAgentSystem(msg1, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result1.finalOutput });

  console.log("\n✅ Agent Response (preview):");
  console.log(result1.finalOutput.substring(0, 300) + "...");

  console.log("\n📊 Summary Slots After Turn 1:");
  console.log(`  Origin: ${JSON.stringify(result1.context.summary?.origin)}`);
  console.log(`  Destination: ${JSON.stringify(result1.context.summary?.destination)}`);
  console.log(`  Duration: ${result1.context.summary?.duration_days} days`);
  console.log(`  Pax: ${result1.context.summary?.pax}`);
  console.log(`  Dates: ${result1.context.summary?.outbound_date} to ${result1.context.summary?.return_date}`);
  console.log(`  Budget: ${result1.context.summary?.budget?.amount} ${result1.context.summary?.budget?.currency}`);
  console.log(`  Trip Types: ${JSON.stringify(result1.context.summary?.tripTypes)}`);

  console.log("\n🔍 Validation:");
  console.log(`  ✓ Origin filled: ${result1.context.summary?.origin?.city ? '✅' : '❌'}`);
  console.log(`  ✓ Destination filled: ${result1.context.summary?.destination?.city ? '✅' : '❌'}`);
  console.log(`  ✓ Duration filled: ${result1.context.summary?.duration_days ? '✅' : '❌'}`);
  console.log(`  ✓ Pax filled: ${result1.context.summary?.pax ? '✅' : '❌'}`);

  return result1;
}

async function testDateAndBudgetFilling(prevResult) {
  console.log("\n\n📋 PHASE 2: Add Dates & Budget - Check Auto-Calculation");
  console.log("-".repeat(80));

  const msg2 = "From January 15-20, 2026, budget ₹50,000 total";
  conversationHistory.push({ role: 'user', content: msg2 });

  const result2 = await runMultiAgentSystem(msg2, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result2.finalOutput });

  console.log("\n✅ Agent Response (preview):");
  console.log(result2.finalOutput.substring(0, 300) + "...");

  console.log("\n📊 Summary Slots After Turn 2:");
  console.log(`  Outbound Date: ${result2.context.summary?.outbound_date}`);
  console.log(`  Return Date: ${result2.context.summary?.return_date}`);
  console.log(`  Duration: ${result2.context.summary?.duration_days} days`);
  console.log(`  Budget Amount: ${result2.context.summary?.budget?.amount}`);
  console.log(`  Budget Currency: ${result2.context.summary?.budget?.currency}`);
  console.log(`  Budget Per Person: ${result2.context.summary?.budget?.per_person}`);

  // Verify auto-calculation
  if (result2.context.summary?.outbound_date && result2.context.summary?.duration_days) {
    const outbound = new Date(result2.context.summary.outbound_date);
    const expected = new Date(outbound);
    expected.setDate(expected.getDate() + result2.context.summary.duration_days);
    const expectedReturn = expected.toISOString().split('T')[0];

    console.log("\n🔍 Return Date Auto-Calculation:");
    console.log(`  Expected: ${expectedReturn}`);
    console.log(`  Actual: ${result2.context.summary?.return_date}`);
    console.log(`  Match: ${result2.context.summary?.return_date === expectedReturn ? '✅ CORRECT' : '❌ WRONG'}`);
  }

  return result2;
}

async function testItineraryCreation(prevResult) {
  console.log("\n\n📋 PHASE 3: Confirm & Create Itinerary - Check Structure");
  console.log("-".repeat(80));

  const msg3 = "Yes, create the itinerary";
  conversationHistory.push({ role: 'user', content: msg3 });

  const result3 = await runMultiAgentSystem(msg3, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result3.finalOutput });

  console.log("\n✅ Agent Response (preview):");
  console.log(result3.finalOutput.substring(0, 400) + "...");

  console.log("\n📊 Itinerary Structure:");
  console.log(`  Number of Days: ${result3.context.itinerary?.days?.length || 0}`);
  console.log(`  Matches Duration: ${result3.context.itinerary?.computed?.matches_duration ? '✅' : '❌'}`);

  if (result3.context.itinerary?.days?.length > 0) {
    console.log("\n🔍 Day 1 Structure Check:");
    const day1 = result3.context.itinerary.days[0];
    console.log(`  Title: ${day1.title}`);
    console.log(`  Date: ${day1.date}`);
    console.log(`  Morning segments: ${day1.segments?.morning?.length || 0}`);
    console.log(`  Afternoon segments: ${day1.segments?.afternoon?.length || 0}`);
    console.log(`  Evening segments: ${day1.segments?.evening?.length || 0}`);

    // Check segment structure
    if (day1.segments?.morning?.[0]) {
      const morningSegment = day1.segments.morning[0];
      console.log("\n  Morning Segment Fields:");
      console.log(`    ✓ place: ${morningSegment.place ? '✅ "' + morningSegment.place + '"' : '❌ MISSING'}`);
      console.log(`    ✓ duration_hours: ${morningSegment.duration_hours !== undefined ? '✅ ' + morningSegment.duration_hours : '❌ MISSING'}`);
      console.log(`    ✓ descriptor: ${morningSegment.descriptor ? '✅ "' + morningSegment.descriptor + '"' : '❌ MISSING'}`);
    }
  }

  return result3;
}

async function testDurationModification(prevResult) {
  console.log("\n\n📋 PHASE 4: Modify Duration - Check Context Update");
  console.log("-".repeat(80));

  const originalDuration = prevResult.context.summary?.duration_days;
  const originalDays = prevResult.context.itinerary?.days?.length;
  const originalReturn = prevResult.context.summary?.return_date;

  const msg4 = "Actually, change it to 3 days instead of 5";
  conversationHistory.push({ role: 'user', content: msg4 });

  const result4 = await runMultiAgentSystem(msg4, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result4.finalOutput });

  console.log("\n✅ Agent Response (preview):");
  console.log(result4.finalOutput.substring(0, 400) + "...");

  console.log("\n📊 Context After Duration Change:");
  console.log(`  Duration: ${originalDuration} → ${result4.context.summary?.duration_days}`);
  console.log(`  Itinerary Days: ${originalDays} → ${result4.context.itinerary?.days?.length}`);
  console.log(`  Return Date: ${originalReturn} → ${result4.context.summary?.return_date}`);

  // Verify return date recalculated
  if (result4.context.summary?.outbound_date && result4.context.summary?.duration_days) {
    const outbound = new Date(result4.context.summary.outbound_date);
    const expected = new Date(outbound);
    expected.setDate(expected.getDate() + result4.context.summary.duration_days);
    const expectedReturn = expected.toISOString().split('T')[0];

    console.log("\n🔍 Return Date Re-Calculation:");
    console.log(`  Expected: ${expectedReturn}`);
    console.log(`  Actual: ${result4.context.summary?.return_date}`);
    console.log(`  Updated Correctly: ${result4.context.summary?.return_date === expectedReturn ? '✅ YES' : '❌ NO'}`);
  }

  console.log("\n🔍 Validation:");
  console.log(`  ✓ Duration updated: ${result4.context.summary?.duration_days === 3 ? '✅' : '❌'}`);
  console.log(`  ✓ Itinerary days synced: ${result4.context.itinerary?.days?.length === 3 ? '✅' : '❌'}`);
  console.log(`  ✓ Return date updated: ${result4.context.summary?.return_date !== originalReturn ? '✅' : '❌'}`);

  return result4;
}

async function testBudgetModification(prevResult) {
  console.log("\n\n📋 PHASE 5: Modify Budget - Check Context Update");
  console.log("-".repeat(80));

  const originalBudget = prevResult.context.summary?.budget?.amount;

  const msg5 = "Increase budget to ₹80,000 total";
  conversationHistory.push({ role: 'user', content: msg5 });

  const result5 = await runMultiAgentSystem(msg5, chatId, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: result5.finalOutput });

  console.log("\n✅ Agent Response (preview):");
  console.log(result5.finalOutput.substring(0, 300) + "...");

  console.log("\n📊 Context After Budget Change:");
  console.log(`  Budget: ₹${originalBudget} → ₹${result5.context.summary?.budget?.amount}`);
  console.log(`  Per Person: ${result5.context.summary?.budget?.per_person}`);

  console.log("\n🔍 Validation:");
  console.log(`  ✓ Budget updated: ${result5.context.summary?.budget?.amount === 80000 ? '✅' : '❌'}`);

  return result5;
}

async function runAllTests() {
  try {
    const result1 = await testSlotFilling();
    const result2 = await testDateAndBudgetFilling(result1);
    const result3 = await testItineraryCreation(result2);
    const result4 = await testDurationModification(result3);
    const result5 = await testBudgetModification(result4);

    console.log("\n\n" + "=".repeat(80));
    console.log("📊 FINAL SUMMARY");
    console.log("=".repeat(80));

    console.log("\n✅ All Phases Completed:");
    console.log("  1. ✓ Slot filling from initial request");
    console.log("  2. ✓ Date/budget capture with auto-calculation");
    console.log("  3. ✓ Itinerary creation with proper structure");
    console.log("  4. ✓ Duration modification with cascading updates");
    console.log("  5. ✓ Budget modification");

    console.log("\n📊 Final Context State:");
    console.log(JSON.stringify({
      summary: result5.context.summary,
      itinerary_days: result5.context.itinerary?.days?.length,
      matches_duration: result5.context.itinerary?.computed?.matches_duration
    }, null, 2));

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

runAllTests().catch(console.error);
