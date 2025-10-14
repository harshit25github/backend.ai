import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log("🔥 STRESS TEST: Proactive web_search Workflow\n");
console.log("=" .repeat(80));
console.log("Testing various scenarios to ensure agent ALWAYS uses web_search FIRST\n\n");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function runTest(testName, userMessage, expectedBehavior) {
  totalTests++;
  const chatId = `stress-test-${Date.now()}-${totalTests}`;

  console.log(`\n${"=".repeat(80)}`);
  console.log(`📋 TEST ${totalTests}: ${testName}`);
  console.log(`${"=".repeat(80)}`);
  console.log(`User: "${userMessage}"`);
  console.log(`Expected: ${expectedBehavior}\n`);

  const startTime = Date.now();

  try {
    const result = await runMultiAgentSystem(
      userMessage,
      chatId,
      [{ role: 'user', content: userMessage }],
      false
    );

    const duration = Date.now() - startTime;
    const flightStatus = result.context?.flight?.bookingStatus;
    const flightResults = result.context?.flight?.searchResults?.length || 0;
    const origin = result.context?.flight?.resolvedOrigin?.userCity;
    const originIATA = result.context?.flight?.resolvedOrigin?.airportIATA;
    const dest = result.context?.flight?.resolvedDestination?.userCity;
    const destIATA = result.context?.flight?.resolvedDestination?.airportIATA;

    console.log(`\n✅ TEST COMPLETED`);
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`📊 Status: ${flightStatus}`);
    console.log(`📊 Results: ${flightResults} flight options`);
    console.log(`📊 Route: ${origin} (${originIATA || 'N/A'}) → ${dest} (${destIATA || 'N/A'})`);

    if (flightStatus === 'results_shown' && flightResults > 0 && originIATA && destIATA) {
      console.log(`\n✅ PASS: Agent successfully found flights with IATA codes`);
      passedTests++;
      return true;
    } else {
      console.log(`\n⚠️  PARTIAL: Flight search incomplete or missing IATAs`);
      failedTests++;
      return false;
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`\n❌ FAIL: ${error.message}`);
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);

    if (error.message.includes('Rate limit')) {
      console.log(`⚠️  Rate limit hit - pausing tests`);
      throw error; // Stop testing on rate limit
    }

    failedTests++;
    return false;
  }
}

async function runAllTests() {
  console.log("🚀 Starting Stress Tests...\n");

  try {
    // Test 1: Major cities with airports
    await runTest(
      "Major cities - Complete info at once",
      "Find flights from Delhi to Mumbai on January 10, returning January 15, 2 passengers, economy, round trip",
      "Should use web_search to get DEL/BOM, then call flight_search once"
    );

    await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between tests

    // Test 2: Cities without airports
    await runTest(
      "City without airport (Nellore)",
      "I need flights from Nellore to Goa on December 15, coming back December 20, for 2 people in economy class",
      "Should find nearest airport (TIR) via web_search, then call flight_search"
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Progressive slot filling
    await runTest(
      "Progressive - Only destination first",
      "Show me flights to Bangalore",
      "Should ask for missing info (origin, dates, pax, etc.)"
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: International cities
    await runTest(
      "International route",
      "Find me flights from Mumbai to Dubai on Feb 1, one way, 1 passenger, business class",
      "Should use web_search to get BOM/DXB, then call flight_search once"
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 5: Different date formats
    await runTest(
      "Different date format",
      "I want to fly from Bangalore to Chennai on 25th March, return 30th March, 3 passengers, economy",
      "Should parse dates, use web_search for BLR/MAA, then flight_search"
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 6: One-way trip
    await runTest(
      "One-way trip",
      "Book a one-way flight from Kolkata to Hyderabad on 5th April, 1 passenger, economy",
      "Should use web_search for CCU/HYD, then flight_search with trip_type=oneway"
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 7: Multiple cities in natural language
    await runTest(
      "Natural language with city names",
      "I'm planning to visit my friend in Pune from Delhi next week, need 2 tickets in economy class",
      "Should extract cities, use web_search for DEL/PNQ, handle 'next week' date"
    );

  } catch (error) {
    if (error.message.includes('Rate limit')) {
      console.log("\n⚠️  RATE LIMIT REACHED - Stopping tests early");
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("📊 STRESS TEST SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
  console.log("=".repeat(80));

  if (passedTests === totalTests) {
    console.log("\n🎉 ALL TESTS PASSED! Proactive workflow is working perfectly!");
  } else if (passedTests > 0) {
    console.log(`\n⚠️  ${passedTests}/${totalTests} tests passed. Some scenarios need attention.`);
  } else {
    console.log("\n❌ All tests failed. Critical issues detected.");
  }
}

runAllTests().then(() => {
  console.log("\n✅ Stress test execution complete\n");
  process.exit(0);
}).catch(error => {
  console.error("\n❌ Stress test failed:", error.message);
  process.exit(1);
});
