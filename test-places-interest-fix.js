import 'dotenv/config';
import { runEnhancedManager } from './src/ai/enhanced-manager.js';

console.log("🧪 Testing placesOfInterest Population Fix\n");
console.log("=" .repeat(80));
console.log("Verifying that placesOfInterest remains EMPTY during slot gathering\n");

async function testPlacesOfInterestFix() {
  const chatId = `test-poi-fix-${Date.now()}`;

  console.log("📋 TEST: Initial vague request (no slots filled)");
  console.log("-".repeat(80));
  console.log("User: I want to go somewhere for vacation\n");

  const result1 = await runEnhancedManager("I want to go somewhere for vacation", chatId, []);

  console.log("✅ Agent Response:");
  console.log(result1.text.substring(0, 400) + "...\n");

  console.log("📊 Context Analysis:");
  console.log(`- Origin: ${result1.context?.summary?.origin?.city || 'NOT SET'}`);
  console.log(`- Budget: ${result1.context?.summary?.budget?.amount || 'NOT SET'}`);
  console.log(`- Duration: ${result1.context?.summary?.duration_days || 'NOT SET'}`);
  console.log(`- Pax: ${result1.context?.summary?.pax || 'NOT SET'}`);
  console.log(`- TripTypes: ${result1.context?.summary?.tripTypes?.join(', ') || 'NOT SET'}`);
  console.log(`- placesOfInterest: ${JSON.stringify(result1.context?.summary?.placesOfInterest || [])}`);

  const placesCount1 = result1.context?.summary?.placesOfInterest?.length || 0;

  if (placesCount1 === 0) {
    console.log("\n✅ PASS: placesOfInterest is EMPTY during slot gathering (correct!)");
  } else {
    console.log(`\n❌ FAIL: placesOfInterest has ${placesCount1} items (should be 0)`);
    console.log(`   Items: ${JSON.stringify(result1.context?.summary?.placesOfInterest)}`);
  }

  console.log("\n\n📋 TEST: Provide ALL slots at once");
  console.log("-".repeat(80));
  console.log("User: From Mumbai, ₹60000 budget for 5 days, 2 people, beaches and adventure\n");

  const history = [
    { role: 'user', content: 'I want to go somewhere for vacation' },
    { role: 'assistant', content: result1.text }
  ];

  const result2 = await runEnhancedManager(
    "From Mumbai, ₹60000 budget for 5 days, 2 people, beaches and adventure",
    chatId,
    history
  );

  console.log("✅ Agent Response (first 600 chars):");
  console.log(result2.text.substring(0, 600) + "...\n");

  console.log("📊 Context Analysis:");
  console.log(`- Origin: ${result2.context?.summary?.origin?.city || 'NOT SET'}`);
  console.log(`- Budget: ${result2.context?.summary?.budget?.amount || 'NOT SET'}`);
  console.log(`- Duration: ${result2.context?.summary?.duration_days || 'NOT SET'}`);
  console.log(`- Pax: ${result2.context?.summary?.pax || 'NOT SET'}`);
  console.log(`- TripTypes: ${result2.context?.summary?.tripTypes?.join(', ') || 'NOT SET'}`);
  console.log(`- placesOfInterest count: ${result2.context?.summary?.placesOfInterest?.length || 0}`);

  const placesCount2 = result2.context?.summary?.placesOfInterest?.length || 0;
  const hasDestinations = /##\s+[A-Z][a-z]+/m.test(result2.text) || /\d+\.\s+\*\*[A-Z][a-z]+/m.test(result2.text);

  if (placesCount2 > 0 && hasDestinations) {
    console.log(`\n✅ PASS: All slots filled → ${placesCount2} places of interest populated (correct!)`);
    console.log(`   Sample: ${result2.context?.summary?.placesOfInterest?.slice(0, 3).join(', ')}`);
  } else if (placesCount2 === 0 && hasDestinations) {
    console.log("\n⚠️  PARTIAL: Destinations shown but placesOfInterest NOT populated");
  } else {
    console.log("\n❌ FAIL: All slots filled but no destinations shown");
  }

  console.log("\n" + "=".repeat(80));
  console.log("🎯 SUMMARY");
  console.log("=".repeat(80));
  console.log(`Test 1 (Slot Gathering): ${placesCount1 === 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (All Slots Filled): ${placesCount2 > 0 && hasDestinations ? '✅ PASS' : '⚠️  CHECK'}`);
  console.log("\nExpected Behavior:");
  console.log("- During slot gathering: placesOfInterest should be [] (empty)");
  console.log("- After all slots filled: placesOfInterest should have landmarks from destinations");
  console.log("=".repeat(80) + "\n");
}

testPlacesOfInterestFix().catch(console.error);
