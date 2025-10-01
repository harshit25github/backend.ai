import { enhancedManagerAgent, createEnhancedContext } from './src/ai/enhanced-manager.js';
import { run, user } from '@openai/agents';
import fs from 'fs';

async function testPlacesCapture() {
  console.log('='.repeat(80));
  console.log('TESTING PLACES OF INTEREST CAPTURE');
  console.log('='.repeat(80));

  const appContext = createEnhancedContext({ name: 'Test User', uid: 1 });
  let thread = [];

  const userMessage = "Create a 2-day Rome itinerary for 2 people with budget 1000 EUR";
  console.log('\nUSER:', userMessage);

  try {
    const res = await run(enhancedManagerAgent, thread.concat(user(userMessage)), { context: appContext });
    thread = res.history;

    console.log('\n' + '='.repeat(80));
    console.log('RESPONSE RECEIVED');
    console.log('='.repeat(80));

    // Check places captured
    console.log('\n✓ PLACES OF INTEREST CAPTURED:');
    console.log(`  Count: ${appContext.summary.placesOfInterest.length}`);
    if (appContext.summary.placesOfInterest.length > 0) {
      appContext.summary.placesOfInterest.forEach((place, idx) => {
        console.log(`  ${idx + 1}. ${place.placeName}`);
        console.log(`     ${place.placeDescription}`);
      });
    } else {
      console.log('  ❌ NO PLACES CAPTURED!');
    }

    // Check suggested questions
    console.log('\n✓ SUGGESTED QUESTIONS CAPTURED:');
    console.log(`  Count: ${appContext.summary.suggestedQuestions.length}`);
    if (appContext.summary.suggestedQuestions.length > 0) {
      appContext.summary.suggestedQuestions.forEach((q, idx) => {
        console.log(`  ${idx + 1}. ${q}`);
      });
    } else {
      console.log('  ❌ NO QUESTIONS CAPTURED!');
    }

    // Check itinerary
    console.log('\n✓ ITINERARY:');
    console.log(`  Days created: ${appContext.itinerary.days.length}`);
    console.log(`  Matches duration: ${appContext.itinerary.computed.matches_duration}`);

    // Validation
    const validation = {
      hasPlaces: appContext.summary.placesOfInterest.length > 0,
      hasQuestions: appContext.summary.suggestedQuestions.length > 0,
      hasItinerary: appContext.itinerary.days.length > 0,
      placesCount: appContext.summary.placesOfInterest.length,
      questionsCount: appContext.summary.suggestedQuestions.length
    };

    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION RESULT');
    console.log('='.repeat(80));
    console.log(`Places captured: ${validation.hasPlaces ? '✅ PASS' : '❌ FAIL'} (${validation.placesCount} places)`);
    console.log(`Questions captured: ${validation.hasQuestions ? '✅ PASS' : '❌ FAIL'} (${validation.questionsCount} questions)`);
    console.log(`Itinerary created: ${validation.hasItinerary ? '✅ PASS' : '❌ FAIL'}`);

    const overallPass = validation.hasPlaces && validation.hasQuestions && validation.hasItinerary;
    console.log(`\nOVERALL: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);

    // Save result
    const result = {
      timestamp: new Date().toISOString(),
      userMessage,
      validation,
      context: {
        summary: appContext.summary,
        itinerary: appContext.itinerary
      }
    };

    fs.writeFileSync('./data/test-places-capture.json', JSON.stringify(result, null, 2));
    console.log('\n✅ Result saved to: data/test-places-capture.json');

  } catch (err) {
    console.error('❌ ERROR:', err.message);
    console.error(err.stack);
  }
}

testPlacesCapture().catch(console.error);
