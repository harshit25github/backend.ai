import { enhancedManagerAgent, createEnhancedContext } from './src/ai/enhanced-manager.js';
import { run, user } from '@openai/agents';
import fs from 'fs';
import path from 'path';

const dataDir = './data';

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function saveTestResult(testName, data) {
  const filename = path.join(dataDir, `${testName}.json`);
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log(`✅ Saved: ${filename}`);
}

async function runTest(testName, messages, description) {
  console.log('\n' + '='.repeat(100));
  console.log(`TEST: ${testName}`);
  console.log(description);
  console.log('='.repeat(100));

  const appContext = createEnhancedContext({ name: 'Test User', uid: 1 });
  let thread = [];
  const testResults = {
    testName,
    description,
    timestamp: new Date().toISOString(),
    interactions: [],
    finalContext: null
  };

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    console.log(`\n[Turn ${i + 1}] USER: ${msg}`);
    console.log('-'.repeat(100));

    try {
      const res = await run(enhancedManagerAgent, thread.concat(user(msg)), { context: appContext });
      thread = res.history;

      const agentResponse = Array.isArray(res.finalOutput) ? res.finalOutput.join('\n') : res.finalOutput;

      // Log response preview
      const preview = agentResponse.substring(0, 300);
      console.log(`\n[Turn ${i + 1}] AGENT: ${preview}${agentResponse.length > 300 ? '...' : ''}`);
      console.log(`\n[Turn ${i + 1}] AGENT USED: ${res.lastAgent?.name}`);

      // Capture interaction
      testResults.interactions.push({
        turn: i + 1,
        userMessage: msg,
        agentName: res.lastAgent?.name,
        agentResponse: agentResponse,
        contextSnapshot: {
          summary: JSON.parse(JSON.stringify(appContext.summary)),
          itinerary: {
            daysCount: appContext.itinerary.days.length,
            computed: appContext.itinerary.computed,
            days: JSON.parse(JSON.stringify(appContext.itinerary.days))
          }
        }
      });

      // Log context changes
      console.log(`\n[Turn ${i + 1}] CONTEXT:`);
      console.log(`  - Destination: ${appContext.summary.destination.city || 'Not set'}`);
      console.log(`  - Duration: ${appContext.summary.duration_days || 'Not set'} days`);
      console.log(`  - Pax: ${appContext.summary.pax || 'Not set'}`);
      console.log(`  - Places of Interest: ${appContext.summary.placesOfInterest.length}`);
      console.log(`  - Suggested Questions: ${appContext.summary.suggestedQuestions.length}`);
      console.log(`  - Itinerary Days: ${appContext.itinerary.days.length}`);

    } catch (err) {
      console.error(`\n❌ ERROR in Turn ${i + 1}:`, err.message);
      testResults.interactions.push({
        turn: i + 1,
        userMessage: msg,
        error: err.message,
        stack: err.stack
      });
    }
  }

  // Final context
  testResults.finalContext = {
    summary: appContext.summary,
    itinerary: appContext.itinerary
  };

  // Save to file
  saveTestResult(testName, testResults);

  console.log('\n' + '='.repeat(100));
  console.log(`✅ TEST "${testName}" COMPLETE`);
  console.log('='.repeat(100));

  return testResults;
}

async function runAllTests() {
  console.log('\n\n');
  console.log('╔' + '═'.repeat(98) + '╗');
  console.log('║' + ' '.repeat(30) + 'COMPREHENSIVE TEST SUITE' + ' '.repeat(44) + '║');
  console.log('╚' + '═'.repeat(98) + '╝');

  const tests = [
    // Test 1: Destination Discovery
    {
      name: 'test1-destination-discovery',
      description: 'Test destination discovery with vague requirements and follow-up questions',
      messages: [
        "I want to travel somewhere with good food and beaches",
        "I love Italian cuisine and want something relaxing",
        "Amalfi Coast sounds perfect!"
      ]
    },

    // Test 2: Complete Itinerary Flow
    {
      name: 'test2-complete-itinerary-flow',
      description: 'Test complete flow from destination to itinerary creation',
      messages: [
        "I want to visit Japan but not sure which city",
        "Tokyo sounds great, I want to see both traditional and modern sites",
        "Create a 5-day itinerary for 2 people with a budget of 1500 USD per person"
      ]
    },

    // Test 3: Missing Required Fields
    {
      name: 'test3-missing-required-fields',
      description: 'Test itinerary request with missing required information',
      messages: [
        "Create a Barcelona itinerary",
        "4 days for 3 people, budget 800 EUR per person"
      ]
    },

    // Test 4: Direct Itinerary with All Info
    {
      name: 'test4-direct-itinerary-complete',
      description: 'Test direct itinerary creation with all required fields provided upfront',
      messages: [
        "Create a 3-day romantic Paris itinerary for 2 people with a budget of 2000 EUR total"
      ]
    },

    // Test 5: Budget Travel
    {
      name: 'test5-budget-travel',
      description: 'Test budget-conscious trip planning',
      messages: [
        "I want to backpack through Southeast Asia on a tight budget",
        "Thailand, I have 30 days and 1500 USD total budget for 1 person",
        "Create an itinerary focusing on Bangkok, Chiang Mai, and the islands"
      ]
    },

    // Test 6: Family Trip
    {
      name: 'test6-family-trip',
      description: 'Test family-friendly destination and itinerary',
      messages: [
        "Looking for a family-friendly destination with kids activities",
        "Singapore looks good, 7 days for 4 people (2 adults, 2 kids aged 8 and 10)"
      ]
    },

    // Test 7: Multi-City Adventure
    {
      name: 'test7-multi-city-adventure',
      description: 'Test complex multi-city itinerary request',
      messages: [
        "I want to visit multiple cities in Europe",
        "London, Paris, and Amsterdam - 10 days for 2 people, budget 3000 EUR per person"
      ]
    },

    // Test 8: Luxury Travel
    {
      name: 'test8-luxury-travel',
      description: 'Test high-end luxury travel planning',
      messages: [
        "I want a luxury honeymoon experience",
        "Maldives, 7 days, 2 people, budget is flexible around 10000 USD",
        "Focus on overwater villas, spa experiences, and fine dining"
      ]
    },

    // Test 9: Context Switching
    {
      name: 'test9-context-switching',
      description: 'Test changing destination mid-conversation',
      messages: [
        "I want to go to New York",
        "Actually, let me think about Dubai instead",
        "Yes Dubai, create a 4-day luxury itinerary for 2 people"
      ]
    },

    // Test 10: Weekend Getaway
    {
      name: 'test10-weekend-getaway',
      description: 'Test short weekend trip planning',
      messages: [
        "Quick weekend getaway ideas from Mumbai?",
        "Goa sounds perfect, 2 days for 4 friends, budget 15000 INR per person"
      ]
    }
  ];

  const allResults = [];

  for (const test of tests) {
    try {
      const result = await runTest(test.name, test.messages, test.description);
      allResults.push(result);
    } catch (err) {
      console.error(`\n❌ Test "${test.name}" failed:`, err.message);
      allResults.push({
        testName: test.name,
        description: test.description,
        error: err.message,
        stack: err.stack
      });
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Save summary
  const summary = {
    timestamp: new Date().toISOString(),
    totalTests: tests.length,
    results: allResults.map(r => ({
      testName: r.testName,
      description: r.description,
      interactionCount: r.interactions?.length || 0,
      hasError: !!r.error,
      finalDestination: r.finalContext?.summary?.destination?.city || null,
      finalItineraryDays: r.finalContext?.itinerary?.days?.length || 0
    }))
  };

  saveTestResult('_test-summary', summary);

  console.log('\n\n');
  console.log('╔' + '═'.repeat(98) + '╗');
  console.log('║' + ' '.repeat(35) + 'ALL TESTS COMPLETE' + ' '.repeat(45) + '║');
  console.log('╚' + '═'.repeat(98) + '╝');
  console.log(`\nTotal Tests: ${tests.length}`);
  console.log(`Results saved in: ${dataDir}/`);
  console.log('\nFiles created:');
  allResults.forEach(r => {
    console.log(`  - ${r.testName}.json`);
  });
  console.log(`  - _test-summary.json`);
}

runAllTests().catch(console.error);
