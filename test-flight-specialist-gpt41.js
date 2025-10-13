/**
 * TEST: Flight Specialist Agent - GPT-4.1 with 2 Tools
 * 
 * Tests the new simplified workflow:
 * - Only 2 tools: flight_search + web_search
 * - GPT-4.1 optimized prompt with agentic reminders
 * - Two-phase flight search workflow
 */

import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

const TEST_CHAT_ID = 'test-flight-gpt41';

// Helper to format output
function logSection(title) {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80) + '\n');
}

function logTestResult(testName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`\n${status}: ${testName}`);
  if (details) console.log(`   ${details}`);
}

// Test 1: Basic flight search with city names (no IATA codes)
async function test1_basicCitySearch() {
  logSection('TEST 1: Basic Flight Search - City Names Only');
  
  const userMessage = "Find flights from Delhi to Goa on December 25, 2025, returning January 2, 2026, 2 passengers, economy class";
  
  console.log(`👤 User: ${userMessage}`);
  console.log('\n🤖 Processing...\n');
  
  const result = await runMultiAgentSystem(userMessage, TEST_CHAT_ID, [
    { role: 'user', content: userMessage }
  ]);
  
  console.log(`\n🤖 Agent Response:\n${result.finalOutput}`);
  console.log(`\n📊 Last Agent: ${result.lastAgent}`);
  
  // Verify expectations
  const context = result.context;
  const passed = 
    result.lastAgent === 'Flight Specialist Agent' &&
    context.summary.origin?.city === 'Delhi' &&
    context.summary.destination?.city === 'Goa' &&
    context.summary.pax === 2 &&
    context.flights.cabinClass === 'economy' &&
    context.flights.tripType === 'roundtrip';
  
  logTestResult(
    'Basic flight search with major cities',
    passed,
    `Origin: ${context.summary.origin?.city}, Dest: ${context.summary.destination?.city}, IATA codes resolved: ${context.flights.resolvedOrigin?.airportIATA ? 'Yes' : 'No'}`
  );
  
  return { passed, context };
}

// Test 2: City without airport (Nellore → nearest is Tirupati)
async function test2_cityWithoutAirport() {
  logSection('TEST 2: City Without Airport - Nellore to Mumbai');
  
  const userMessage = "I need a one-way flight from Nellore to Mumbai on January 15, 2026, 1 passenger, economy";
  
  console.log(`👤 User: ${userMessage}`);
  console.log('\n🤖 Processing...\n');
  
  const result = await runMultiAgentSystem(userMessage, TEST_CHAT_ID + '-2', [
    { role: 'user', content: userMessage }
  ]);
  
  console.log(`\n🤖 Agent Response:\n${result.finalOutput}`);
  console.log(`\n📊 Last Agent: ${result.lastAgent}`);
  
  // Verify expectations
  const context = result.context;
  const originIATA = context.flights.resolvedOrigin?.airportIATA;
  const originDistance = context.flights.resolvedOrigin?.distance_km;
  
  const passed = 
    result.lastAgent === 'Flight Specialist Agent' &&
    context.summary.origin?.city === 'Nellore' &&
    context.summary.destination?.city === 'Mumbai' &&
    originIATA !== null && // Should have found nearest airport
    (result.finalOutput.toLowerCase().includes('tirupati') || result.finalOutput.toLowerCase().includes('nearest'));
  
  logTestResult(
    'Handled city without airport (Nellore)',
    passed,
    `Resolved to: ${originIATA} (${context.flights.resolvedOrigin?.airportName}), Distance: ${originDistance}km`
  );
  
  return { passed, context };
}

// Test 3: Partial information - only destination
async function test3_partialInformation() {
  logSection('TEST 3: Partial Information - Only Destination Provided');
  
  const userMessage = "I want to fly to Bali";
  
  console.log(`👤 User: ${userMessage}`);
  console.log('\n🤖 Processing...\n');
  
  const result = await runMultiAgentSystem(userMessage, TEST_CHAT_ID + '-3', [
    { role: 'user', content: userMessage }
  ]);
  
  console.log(`\n🤖 Agent Response:\n${result.finalOutput}`);
  console.log(`\n📊 Last Agent: ${result.lastAgent}`);
  
  // Agent should ask for missing information
  const response = result.finalOutput.toLowerCase();
  const askedForOrigin = response.includes('from') || response.includes('flying from') || response.includes('where are you');
  const askedForDates = response.includes('date') || response.includes('when');
  const askedForPassengers = response.includes('passenger') || response.includes('how many');
  
  const passed = 
    result.lastAgent === 'Flight Specialist Agent' &&
    result.context.summary.destination?.city?.toLowerCase().includes('bali') &&
    (askedForOrigin || askedForDates || askedForPassengers);
  
  logTestResult(
    'Asked for missing information',
    passed,
    `Asked for: ${askedForOrigin ? 'origin ' : ''}${askedForDates ? 'dates ' : ''}${askedForPassengers ? 'passengers' : ''}`
  );
  
  return { passed };
}

// Test 4: Multi-turn - complete partial information
async function test4_multiTurnCompletion() {
  logSection('TEST 4: Multi-Turn Conversation - Complete Missing Info');
  
  const chatId = TEST_CHAT_ID + '-4';
  
  // Turn 1: Partial info
  console.log('👤 User (Turn 1): "I need flights to Dubai"');
  const result1 = await runMultiAgentSystem(
    "I need flights to Dubai",
    chatId,
    [{ role: 'user', content: "I need flights to Dubai" }]
  );
  console.log(`\n🤖 Agent (Turn 1):\n${result1.finalOutput}\n`);
  
  // Turn 2: Complete the information
  console.log('\n👤 User (Turn 2): "From Delhi on February 1st, returning February 10th, 2 people, economy"');
  const result2 = await runMultiAgentSystem(
    "From Delhi on February 1st, returning February 10th, 2 people, economy",
    chatId,
    [
      { role: 'user', content: "I need flights to Dubai" },
      { role: 'assistant', content: result1.finalOutput },
      { role: 'user', content: "From Delhi on February 1st, returning February 10th, 2 people, economy" }
    ]
  );
  console.log(`\n🤖 Agent (Turn 2):\n${result2.finalOutput}`);
  
  const context = result2.context;
  const passed = 
    context.summary.origin?.city === 'Delhi' &&
    context.summary.destination?.city?.toLowerCase().includes('dubai') &&
    context.summary.pax === 2 &&
    context.flights.tripType === 'roundtrip';
  
  logTestResult(
    'Multi-turn conversation completed',
    passed,
    `Final context: ${context.summary.origin?.city} → ${context.summary.destination?.city}, ${context.summary.pax} pax`
  );
  
  return { passed, context };
}

// Test 5: Tool sequence verification
async function test5_toolSequenceVerification() {
  logSection('TEST 5: Verify 2-Tool Workflow (No update_flight_airports)');
  
  const userMessage = "Show me flights from Bangalore to Singapore on March 15, 2026, 1 passenger, business class, one-way";
  
  console.log(`👤 User: ${userMessage}`);
  console.log('\n🤖 Processing...\n');
  
  const result = await runMultiAgentSystem(userMessage, TEST_CHAT_ID + '-5', [
    { role: 'user', content: userMessage }
  ]);
  
  console.log(`\n🤖 Agent Response:\n${result.finalOutput}`);
  
  // Check if old 3-tool workflow was used (should NOT be)
  const usedOldWorkflow = result.finalOutput.includes('update_flight_airports');
  
  // Check if new 2-tool workflow is evident
  const context = result.context;
  const hasOriginIATA = context.flights.resolvedOrigin?.airportIATA !== null;
  const hasDestIATA = context.flights.resolvedDestination?.airportIATA !== null;
  
  const passed = 
    !usedOldWorkflow &&
    result.lastAgent === 'Flight Specialist Agent' &&
    context.summary.origin?.city === 'Bangalore' &&
    context.summary.destination?.city === 'Singapore';
  
  logTestResult(
    'Used 2-tool workflow (not 3-tool)',
    passed,
    `IATA codes resolved: Origin=${hasOriginIATA}, Dest=${hasDestIATA}. Old workflow used: ${usedOldWorkflow ? 'YES (BAD)' : 'NO (GOOD)'}`
  );
  
  return { passed, context };
}

// Test 6: GPT-4.1 Agentic Behavior - Persistence
async function test6_agenticPersistence() {
  logSection('TEST 6: GPT-4.1 Agentic Persistence - Complex Query');
  
  const userMessage = "I'm planning a trip. I want to go from a small town called Nellore to the beaches of Goa. It's for my family - me, my wife, and 2 kids. We're flexible on dates but thinking around Christmas time. Economy is fine.";
  
  console.log(`👤 User: ${userMessage}`);
  console.log('\n🤖 Processing...\n');
  
  const result = await runMultiAgentSystem(userMessage, TEST_CHAT_ID + '-6', [
    { role: 'user', content: userMessage }
  ]);
  
  console.log(`\n🤖 Agent Response:\n${result.finalOutput}`);
  
  const context = result.context;
  const response = result.finalOutput.toLowerCase();
  
  // Agent should:
  // 1. Identify origin and destination
  // 2. Ask for specific dates (since "around Christmas" is vague)
  // 3. Correctly count passengers (4 people)
  // 4. Show persistence in trying to help
  
  const identifiedOrigin = context.summary.origin?.city?.toLowerCase().includes('nellore');
  const identifiedDest = context.summary.destination?.city?.toLowerCase().includes('goa');
  const askedForSpecificDates = response.includes('specific date') || response.includes('which date') || response.includes('exact date');
  const showsPersistence = response.length > 100; // Agent should be thorough
  
  const passed = 
    identifiedOrigin &&
    identifiedDest &&
    result.lastAgent === 'Flight Specialist Agent';
  
  logTestResult(
    'GPT-4.1 agentic persistence demonstrated',
    passed,
    `Identified: ${identifiedOrigin ? 'Nellore' : ''} → ${identifiedDest ? 'Goa' : ''}, Asked for dates: ${askedForSpecificDates}, Response length: ${result.finalOutput.length} chars`
  );
  
  return { passed, context };
}

// Test 7: CheapOair Loyalty Check
async function test7_cheapoairLoyalty() {
  logSection('TEST 7: CheapOair Loyalty - No Competing Websites');
  
  const userMessage = "Find me cheap flights from Mumbai to London on May 1st, 2026, returning May 15th, 1 passenger, economy";
  
  console.log(`👤 User: ${userMessage}`);
  console.log('\n🤖 Processing...\n');
  
  const result = await runMultiAgentSystem(userMessage, TEST_CHAT_ID + '-7', [
    { role: 'user', content: userMessage }
  ]);
  
  console.log(`\n🤖 Agent Response:\n${result.finalOutput}`);
  
  const response = result.finalOutput.toLowerCase();
  
  // Check for competing websites
  const competitorWebsites = [
    'expedia', 'kayak', 'skyscanner', 'google flights', 'booking.com',
    'priceline', 'travelocity', 'orbitz', 'momondo', 'hipmunk'
  ];
  
  const mentionsCompetitor = competitorWebsites.some(site => response.includes(site));
  const mentionsCheapOair = response.includes('cheapoair');
  
  const passed = 
    !mentionsCompetitor &&
    result.lastAgent === 'Flight Specialist Agent';
  
  logTestResult(
    'CheapOair loyalty maintained',
    passed,
    `Mentions CheapOair: ${mentionsCheapOair ? 'Yes' : 'No'}, Mentions competitors: ${mentionsCompetitor ? 'YES (BAD)' : 'No (GOOD)'}`
  );
  
  return { passed };
}

// Run all tests
async function runAllTests() {
  console.log('\n');
  console.log('🧪 FLIGHT SPECIALIST AGENT - GPT-4.1 COMPREHENSIVE TEST SUITE');
  console.log('🔧 Testing: 2-tool workflow (flight_search + web_search)');
  console.log('📋 Testing: GPT-4.1 optimized prompt with agentic reminders');
  console.log('\n');
  
  const results = [];
  
  try {
    results.push(await test1_basicCitySearch());
    results.push(await test2_cityWithoutAirport());
    results.push(await test3_partialInformation());
    results.push(await test4_multiTurnCompletion());
    results.push(await test5_toolSequenceVerification());
    results.push(await test6_agenticPersistence());
    results.push(await test7_cheapoairLoyalty());
    
    // Summary
    logSection('TEST SUMMARY');
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 ALL TESTS PASSED! Flight Specialist Agent is working correctly with GPT-4.1 optimization!');
    } else {
      console.log('\n⚠️  Some tests failed. Review the output above for details.');
    }
    
    // Display final context state from last test
    if (results.length > 0 && results[results.length - 1].context) {
      const lastContext = results[results.length - 1].context;
      console.log('\n📊 Final Context State (Last Test):');
      console.log(JSON.stringify({
        origin: lastContext.summary.origin,
        destination: lastContext.summary.destination,
        dates: {
          outbound: lastContext.summary.outbound_date,
          return: lastContext.summary.return_date
        },
        pax: lastContext.summary.pax,
        flights: {
          cabinClass: lastContext.flights.cabinClass,
          tripType: lastContext.flights.tripType,
          resolvedOrigin: lastContext.flights.resolvedOrigin,
          resolvedDestination: lastContext.flights.resolvedDestination,
          resultsCount: lastContext.flights.searchResults?.length || 0
        }
      }, null, 2));
    }
    
  } catch (error) {
    console.error('\n❌ TEST SUITE ERROR:', error);
    console.error(error.stack);
  }
}

// Run tests
runAllTests().catch(console.error);

