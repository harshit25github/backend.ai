import { enhancedManagerAgent, createEnhancedContext } from './src/ai/enhanced-manager.js';
import { run, user } from '@openai/agents';

async function testCompleteWorkflow() {
  console.log('='.repeat(80));
  console.log('TESTING COMPLETE WORKFLOW');
  console.log('='.repeat(80));

  const appContext = createEnhancedContext({ name: 'Test User', uid: 1 });
  let thread = [];

  // Test 1: Destination Discovery with minimal info
  console.log('\n\n[TEST 1] Destination Discovery - Minimal Info');
  console.log('-'.repeat(80));
  const test1 = "I want to go somewhere romantic but I don't know where";
  console.log('USER:', test1);

  try {
    const res1 = await run(enhancedManagerAgent, thread.concat(user(test1)), { context: appContext });
    thread = res1.history;
    console.log('\nAGENT:', res1.finalOutput);
    console.log('\n[CONTEXT AFTER TEST 1]');
    console.log('Summary:', JSON.stringify(appContext.summary, null, 2));
  } catch (err) {
    console.error('ERROR:', err.message);
  }

  // Test 2: Itinerary Creation with missing required fields
  console.log('\n\n[TEST 2] Itinerary Request - Missing Required Fields');
  console.log('-'.repeat(80));
  const test2 = "Create a Paris itinerary";
  console.log('USER:', test2);

  try {
    const res2 = await run(enhancedManagerAgent, thread.concat(user(test2)), { context: appContext });
    thread = res2.history;
    console.log('\nAGENT:', res2.finalOutput);
    console.log('\n[CONTEXT AFTER TEST 2]');
    console.log('Summary:', JSON.stringify(appContext.summary, null, 2));
  } catch (err) {
    console.error('ERROR:', err.message);
  }

  // Test 3: Provide missing information
  console.log('\n\n[TEST 3] Provide Missing Info');
  console.log('-'.repeat(80));
  const test3 = "5 days for 2 people";
  console.log('USER:', test3);

  try {
    const res3 = await run(enhancedManagerAgent, thread.concat(user(test3)), { context: appContext });
    thread = res3.history;
    console.log('\nAGENT:', Array.isArray(res3.finalOutput) ? res3.finalOutput.join('\n') : res3.finalOutput);
    console.log('\n[CONTEXT AFTER TEST 3]');
    console.log('Summary:', JSON.stringify(appContext.summary, null, 2));
    console.log('Itinerary Days:', appContext.itinerary.days.length);
    if (appContext.itinerary.days.length > 0) {
      console.log('Sample Day Structure:', JSON.stringify(appContext.itinerary.days[0], null, 2));
    }
  } catch (err) {
    console.error('ERROR:', err.message);
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('WORKFLOW TEST COMPLETE');
  console.log('='.repeat(80));
}

testCompleteWorkflow().catch(console.error);
