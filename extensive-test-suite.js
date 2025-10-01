import { enhancedManagerAgent, createEnhancedContext } from './src/ai/enhanced-manager.js';
import { run, user } from '@openai/agents';
import fs from 'fs';
import path from 'path';

const dataDir = './data';

function saveTestResult(testName, data) {
  const filename = path.join(dataDir, `${testName}.json`);
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log(`✅ Saved: ${filename}`);
}

async function runTest(testName, messages, description, expectedBehavior) {
  console.log('\n' + '='.repeat(100));
  console.log(`TEST: ${testName}`);
  console.log(`DESCRIPTION: ${description}`);
  console.log('='.repeat(100));

  const appContext = createEnhancedContext({ name: 'Test User', uid: 1 });
  let thread = [];
  const testResults = {
    testName,
    description,
    expectedBehavior,
    timestamp: new Date().toISOString(),
    interactions: [],
    finalContext: null,
    validation: {}
  };

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    console.log(`\n[Turn ${i + 1}] USER: ${msg}`);

    try {
      const res = await run(enhancedManagerAgent, thread.concat(user(msg)), { context: appContext });
      thread = res.history;

      const agentResponse = Array.isArray(res.finalOutput) ? res.finalOutput.join('\n') : res.finalOutput;
      const preview = agentResponse.substring(0, 200);

      console.log(`[Turn ${i + 1}] AGENT: ${res.lastAgent?.name}`);
      console.log(`[Turn ${i + 1}] RESPONSE: ${preview}...`);

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

      // Log context
      console.log(`[Turn ${i + 1}] CONTEXT:`);
      console.log(`  Destination: ${appContext.summary.destination.city || 'Not set'}`);
      console.log(`  Duration: ${appContext.summary.duration_days || 'Not set'} days`);
      console.log(`  Pax: ${appContext.summary.pax || 'Not set'}`);
      console.log(`  Budget: ${appContext.summary.budget.amount || 'Not set'} ${appContext.summary.budget.currency}`);
      console.log(`  Places of Interest: ${appContext.summary.placesOfInterest.length}`);
      console.log(`  Suggested Questions: ${appContext.summary.suggestedQuestions.length}`);
      console.log(`  Itinerary Days: ${appContext.itinerary.days.length}`);

    } catch (err) {
      console.error(`[Turn ${i + 1}] ERROR: ${err.message}`);
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

  // Validation
  const validation = {
    hasDestination: !!appContext.summary.destination.city,
    hasItinerary: appContext.itinerary.days.length > 0,
    placesCount: appContext.summary.placesOfInterest.length,
    questionsCount: appContext.summary.suggestedQuestions.length,
    itineraryStructureValid: true,
    structureErrors: []
  };

  // Validate itinerary structure
  if (appContext.itinerary.days.length > 0) {
    appContext.itinerary.days.forEach((day, idx) => {
      ['morning', 'afternoon', 'evening'].forEach(segment => {
        const segmentArray = day.segments[segment];
        if (segmentArray.length > 1) {
          validation.itineraryStructureValid = false;
          validation.structureErrors.push(`Day ${idx + 1} ${segment}: ${segmentArray.length} objects (should be 0 or 1)`);
        }
        if (segmentArray.length === 1) {
          const obj = segmentArray[0];
          const wordCount = obj.descriptor.split(' ').length;
          if (wordCount > 4) {
            validation.itineraryStructureValid = false;
            validation.structureErrors.push(`Day ${idx + 1} ${segment}: descriptor "${obj.descriptor}" has ${wordCount} words (max 4)`);
          }
        }
      });
    });
  }

  testResults.validation = validation;
  saveTestResult(testName, testResults);

  console.log('\n' + '='.repeat(100));
  console.log('VALIDATION RESULT');
  console.log('='.repeat(100));
  console.log(`✓ Destination: ${validation.hasDestination ? '✅' : '❌'} (${appContext.summary.destination.city || 'None'})`);
  console.log(`✓ Itinerary: ${validation.hasItinerary ? '✅' : '❌'} (${appContext.itinerary.days.length} days)`);
  console.log(`✓ Structure: ${validation.itineraryStructureValid ? '✅' : '❌'}`);
  console.log(`✓ Places: ${validation.placesCount} places captured`);
  console.log(`✓ Questions: ${validation.questionsCount} questions captured`);

  if (!validation.itineraryStructureValid) {
    console.log('\n❌ Structure Errors:');
    validation.structureErrors.forEach(err => console.log(`  - ${err}`));
  }

  const overallPass = validation.hasDestination &&
                      validation.itineraryStructureValid &&
                      (!validation.hasItinerary || validation.questionsCount > 0);

  console.log(`\nOVERALL: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(100));

  return testResults;
}

async function runAllTests() {
  console.log('\n\n');
  console.log('╔' + '═'.repeat(98) + '╗');
  console.log('║' + ' '.repeat(30) + 'EXTENSIVE TEST SUITE' + ' '.repeat(48) + '║');
  console.log('╚' + '═'.repeat(98) + '╝');

  const tests = [
    {
      name: 'test1-destination-discovery-vague',
      description: 'Destination discovery with vague request',
      expectedBehavior: 'Destination Agent should provide multiple destination suggestions with placesOfInterest and suggestedQuestions',
      messages: [
        "I want to go somewhere with beaches and good food"
      ]
    },

    {
      name: 'test2-destination-discovery-specific',
      description: 'Destination discovery with specific preferences',
      expectedBehavior: 'Destination Agent should provide targeted suggestions with placesOfInterest and suggestedQuestions',
      messages: [
        "I want a romantic European destination with history and culture",
        "Venice sounds perfect!"
      ]
    },

    {
      name: 'test3-direct-complete-itinerary',
      description: 'Direct itinerary request with all required fields',
      expectedBehavior: 'Itinerary Agent should create full itinerary with suggestedQuestions (NOT placesOfInterest)',
      messages: [
        "Create a 3-day Paris itinerary for 2 people with budget 2000 EUR"
      ]
    },

    {
      name: 'test4-itinerary-missing-fields',
      description: 'Itinerary request missing required fields',
      expectedBehavior: 'Itinerary Agent should ask for missing fields, then create itinerary with suggestedQuestions',
      messages: [
        "Create a Barcelona itinerary",
        "4 days for 2 people, budget 1500 EUR"
      ]
    },

    {
      name: 'test5-destination-then-itinerary',
      description: 'Full flow: destination discovery → finalize → create itinerary',
      expectedBehavior: 'Destination Agent populates placesOfInterest, Itinerary Agent only adds suggestedQuestions',
      messages: [
        "I want to travel to Asia but not sure where",
        "Tokyo sounds great!",
        "Create a 5-day itinerary for 2 people, budget 3000 USD per person"
      ]
    },

    {
      name: 'test6-budget-travel',
      description: 'Budget-conscious backpacking trip',
      expectedBehavior: 'Should create budget-focused itinerary with relevant suggestedQuestions',
      messages: [
        "Plan a 7-day budget backpacking trip to Thailand for 1 person with 800 USD total"
      ]
    },

    {
      name: 'test7-luxury-trip',
      description: 'Luxury honeymoon itinerary',
      expectedBehavior: 'Should create luxury-focused itinerary with relevant suggestedQuestions',
      messages: [
        "Create a luxury 5-day Maldives honeymoon for 2 people, budget 8000 USD"
      ]
    },

    {
      name: 'test8-family-trip',
      description: 'Family trip with kids',
      expectedBehavior: 'Should create family-friendly itinerary with kid-focused suggestedQuestions',
      messages: [
        "Plan a 6-day family trip to Orlando for 2 adults and 2 kids (ages 8, 10), budget 4000 USD"
      ]
    },

    {
      name: 'test9-short-weekend',
      description: 'Quick weekend getaway',
      expectedBehavior: 'Should create compact 2-day itinerary with suggestedQuestions',
      messages: [
        "Quick 2-day weekend trip to Amsterdam for 2 people, budget 800 EUR"
      ]
    },

    {
      name: 'test10-multi-city',
      description: 'Multi-city European tour',
      expectedBehavior: 'Should handle multi-city request and create appropriate itinerary',
      messages: [
        "I want to visit London, Paris, and Rome in 10 days for 2 people"
      ]
    }
  ];

  const allResults = [];

  for (const test of tests) {
    try {
      const result = await runTest(test.name, test.messages, test.description, test.expectedBehavior);
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

  // Generate summary
  const summary = {
    timestamp: new Date().toISOString(),
    totalTests: tests.length,
    results: allResults.map(r => ({
      testName: r.testName,
      description: r.description,
      expectedBehavior: r.expectedBehavior,
      hasError: !!r.error,
      finalDestination: r.finalContext?.summary?.destination?.city || null,
      finalItineraryDays: r.finalContext?.itinerary?.days?.length || 0,
      placesCount: r.validation?.placesCount || 0,
      questionsCount: r.validation?.questionsCount || 0,
      structureValid: r.validation?.itineraryStructureValid !== false,
      structureErrors: r.validation?.structureErrors || []
    }))
  };

  saveTestResult('_extensive-test-summary', summary);

  // Print summary
  console.log('\n\n');
  console.log('╔' + '═'.repeat(98) + '╗');
  console.log('║' + ' '.repeat(35) + 'TEST SUMMARY' + ' '.repeat(51) + '║');
  console.log('╚' + '═'.repeat(98) + '╝');

  let passed = 0, failed = 0;

  summary.results.forEach((r, idx) => {
    const status = r.hasError ? '❌ ERROR' :
                   (!r.structureValid ? '❌ STRUCTURE FAIL' :
                   (r.finalItineraryDays > 0 && r.questionsCount === 0 ? '⚠️  NO QUESTIONS' : '✅ PASS'));

    if (status === '✅ PASS') passed++;
    else failed++;

    console.log(`\n${idx + 1}. ${r.testName}`);
    console.log(`   Status: ${status}`);
    console.log(`   Destination: ${r.finalDestination || 'None'}`);
    console.log(`   Itinerary: ${r.finalItineraryDays} days`);
    console.log(`   Places: ${r.placesCount} | Questions: ${r.questionsCount}`);
    if (r.structureErrors.length > 0) {
      console.log(`   Errors: ${r.structureErrors.join('; ')}`);
    }
  });

  console.log('\n' + '='.repeat(100));
  console.log(`TOTAL: ${tests.length} tests | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('='.repeat(100));
}

runAllTests().catch(console.error);
