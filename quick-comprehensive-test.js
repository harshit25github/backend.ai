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
  console.log(`\n✅ Saved: ${filename}`);
}

async function runTest(testName, messages, description) {
  console.log('\n' + '='.repeat(80));
  console.log(`TEST: ${testName}`);
  console.log(description);
  console.log('='.repeat(80));

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

    try {
      const res = await run(enhancedManagerAgent, thread.concat(user(msg)), { context: appContext });
      thread = res.history;

      const agentResponse = Array.isArray(res.finalOutput) ? res.finalOutput.join('\n') : res.finalOutput;

      // Log response preview
      const preview = agentResponse.substring(0, 200);
      console.log(`[Turn ${i + 1}] AGENT: ${preview}...`);
      console.log(`[Turn ${i + 1}] AGENT USED: ${res.lastAgent?.name}`);

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
      console.log(`[Turn ${i + 1}] CONTEXT CAPTURED:`);
      console.log(`  Destination: ${appContext.summary.destination.city || 'Not set'}`);
      console.log(`  Duration: ${appContext.summary.duration_days || 'Not set'} days`);
      console.log(`  Pax: ${appContext.summary.pax || 'Not set'}`);
      console.log(`  Budget: ${appContext.summary.budget.amount || 'Not set'} ${appContext.summary.budget.currency}`);
      console.log(`  Places of Interest: ${appContext.summary.placesOfInterest.length}`);
      console.log(`  Suggested Questions: ${appContext.summary.suggestedQuestions.length}`);
      console.log(`  Itinerary Days: ${appContext.itinerary.days.length}`);

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

  // Validation summary
  const validation = {
    hasDestination: !!appContext.summary.destination.city,
    hasItinerary: appContext.itinerary.days.length > 0,
    itineraryStructureValid: true,
    structureErrors: []
  };

  // Validate itinerary structure if exists
  if (appContext.itinerary.days.length > 0) {
    appContext.itinerary.days.forEach((day, idx) => {
      ['morning', 'afternoon', 'evening'].forEach(segment => {
        const segmentArray = day.segments[segment];
        if (segmentArray.length > 1) {
          validation.itineraryStructureValid = false;
          validation.structureErrors.push(`Day ${idx + 1} ${segment}: has ${segmentArray.length} objects (should be 0 or 1)`);
        }
        if (segmentArray.length === 1) {
          const obj = segmentArray[0];
          const wordCount = obj.descriptor.split(' ').length;
          if (wordCount > 4) {
            validation.itineraryStructureValid = false;
            validation.structureErrors.push(`Day ${idx + 1} ${segment}: descriptor has ${wordCount} words (max 4)`);
          }
        }
      });
    });
  }

  testResults.validation = validation;

  // Save to file
  saveTestResult(testName, testResults);

  console.log('\n' + '='.repeat(80));
  console.log(`✅ TEST "${testName}" COMPLETE`);
  console.log(`   Validation: ${validation.itineraryStructureValid ? '✅ PASSED' : '❌ FAILED'}`);
  if (!validation.itineraryStructureValid) {
    console.log(`   Errors: ${validation.structureErrors.join(', ')}`);
  }
  console.log('='.repeat(80));

  return testResults;
}

async function runAllTests() {
  console.log('\n╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(20) + 'QUICK COMPREHENSIVE TEST SUITE' + ' '.repeat(28) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');

  const tests = [
    // Test 1: Direct Complete Itinerary
    {
      name: 'test1-direct-complete-itinerary',
      description: 'Direct itinerary request with all required fields',
      messages: [
        "Create a 3-day Paris itinerary for 2 people with budget 2000 EUR"
      ]
    },

    // Test 2: Missing Fields Flow
    {
      name: 'test2-missing-fields-flow',
      description: 'Itinerary request with missing fields, then provide them',
      messages: [
        "Create a Tokyo itinerary",
        "5 days for 2 people, budget 3000 USD per person"
      ]
    },

    // Test 3: Destination Discovery Flow
    {
      name: 'test3-destination-discovery',
      description: 'Destination discovery then itinerary creation',
      messages: [
        "I want to go somewhere romantic in Europe",
        "Venice sounds perfect!",
        "Create a 4-day itinerary for 2 people, budget 2500 EUR total"
      ]
    },

    // Test 4: Context Switching
    {
      name: 'test4-context-switching',
      description: 'Change destination mid-conversation',
      messages: [
        "I want to visit Barcelona",
        "Actually, let's do Lisbon instead",
        "Create a 6-day itinerary for 3 people, budget 1500 EUR per person"
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
      finalItineraryDays: r.finalContext?.itinerary?.days?.length || 0,
      validationPassed: r.validation?.itineraryStructureValid || false,
      structureErrors: r.validation?.structureErrors || []
    }))
  };

  saveTestResult('_test-summary', summary);

  console.log('\n\n╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(28) + 'ALL TESTS COMPLETE' + ' '.repeat(32) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  console.log(`\nTotal Tests: ${tests.length}`);
  console.log(`Passed: ${summary.results.filter(r => r.validationPassed && !r.hasError).length}`);
  console.log(`Failed: ${summary.results.filter(r => !r.validationPassed || r.hasError).length}`);
  console.log(`\nResults saved in: ${dataDir}/`);

  // Print summary table
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  summary.results.forEach((r, idx) => {
    const status = r.hasError ? '❌ ERROR' : (r.validationPassed ? '✅ PASS' : '❌ FAIL');
    console.log(`${idx + 1}. ${r.testName}`);
    console.log(`   Status: ${status}`);
    console.log(`   Destination: ${r.finalDestination || 'None'}`);
    console.log(`   Itinerary Days: ${r.finalItineraryDays}`);
    if (r.structureErrors.length > 0) {
      console.log(`   Errors: ${r.structureErrors.join('; ')}`);
    }
  });
  console.log('='.repeat(80));
}

runAllTests().catch(console.error);
