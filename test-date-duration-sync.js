import { enhancedManagerAgent, createEnhancedContext } from './src/ai/enhanced-manager.js';
import { run, user } from '@openai/agents';
import fs from 'fs';

async function testDateAndDurationSync() {
  console.log('='.repeat(100));
  console.log('TESTING DATE AUTO-CALCULATION & DURATION SYNC');
  console.log('='.repeat(100));

  // TEST 1: Auto-calculate return_date
  console.log('\n\n[TEST 1] Auto-calculate return_date from outbound_date + duration');
  console.log('-'.repeat(100));

  const appContext1 = createEnhancedContext({ name: 'Test User', uid: 1 });
  let thread1 = [];

  const msg1 = "Create a 5-day Paris itinerary for 2 people starting January 15, 2025, budget 2000 EUR";
  console.log('USER:', msg1);

  try {
    const res1 = await run(enhancedManagerAgent, thread1.concat(user(msg1)), { context: appContext1 });
    thread1 = res1.history;

    console.log('\n✓ CONTEXT CAPTURED:');
    console.log('  Outbound Date:', appContext1.summary.outbound_date || 'Not set');
    console.log('  Duration:', appContext1.summary.duration_days, 'days');
    console.log('  Return Date:', appContext1.summary.return_date || 'Not set');

    // Validation
    const hasOutbound = !!appContext1.summary.outbound_date;
    const hasDuration = appContext1.summary.duration_days > 0;
    const hasReturn = !!appContext1.summary.return_date;
    const returnDateCorrect = appContext1.summary.return_date === '2025-01-20'; // Jan 15 + 5 days = Jan 20

    console.log('\n✓ VALIDATION:');
    console.log('  Outbound date captured:', hasOutbound ? '✅' : '❌');
    console.log('  Duration captured:', hasDuration ? '✅' : '❌');
    console.log('  Return date auto-calculated:', hasReturn ? '✅' : '❌');
    console.log('  Return date correct (Jan 20):', returnDateCorrect ? '✅' : '❌');

    const test1Pass = hasOutbound && hasDuration && hasReturn && returnDateCorrect;
    console.log(`\n[TEST 1] ${test1Pass ? '✅ PASS' : '❌ FAIL'}`);

    // Save result
    fs.writeFileSync('./data/test-date-calculation.json', JSON.stringify({
      test: 'Auto-calculate return_date',
      userMessage: msg1,
      context: appContext1.summary,
      validation: { hasOutbound, hasDuration, hasReturn, returnDateCorrect, passed: test1Pass }
    }, null, 2));

  } catch (err) {
    console.error('❌ ERROR:', err.message);
  }

  // TEST 2: Duration sync when changing itinerary
  console.log('\n\n[TEST 2] Duration sync when changing itinerary length');
  console.log('-'.repeat(100));

  const appContext2 = createEnhancedContext({ name: 'Test User', uid: 1 });
  let thread2 = [];

  const msg2a = "Create a 15-day Thailand itinerary for 1 person, budget 1500 USD";
  console.log('\n[Turn 1] USER:', msg2a);

  try {
    const res2a = await run(enhancedManagerAgent, thread2.concat(user(msg2a)), { context: appContext2 });
    thread2 = res2a.history;

    console.log('[Turn 1] CONTEXT:');
    console.log('  Duration:', appContext2.summary.duration_days, 'days');
    console.log('  Itinerary Days:', appContext2.itinerary.days.length);

    const msg2b = "Actually, change it to 8 days instead";
    console.log('\n[Turn 2] USER:', msg2b);

    const res2b = await run(enhancedManagerAgent, thread2.concat(user(msg2b)), { context: appContext2 });
    thread2 = res2b.history;

    console.log('[Turn 2] CONTEXT AFTER CHANGE:');
    console.log('  Duration:', appContext2.summary.duration_days, 'days');
    console.log('  Itinerary Days:', appContext2.itinerary.days.length);

    // Validation
    const durationUpdated = appContext2.summary.duration_days === 8;
    const itineraryUpdated = appContext2.itinerary.days.length === 8;
    const durationMatches = appContext2.summary.duration_days === appContext2.itinerary.days.length;
    const computedMatches = appContext2.itinerary.computed.matches_duration === true;

    console.log('\n✓ VALIDATION:');
    console.log('  Duration updated to 8:', durationUpdated ? '✅' : '❌');
    console.log('  Itinerary updated to 8 days:', itineraryUpdated ? '✅' : '❌');
    console.log('  Duration matches itinerary length:', durationMatches ? '✅' : '❌');
    console.log('  Computed matches_duration flag:', computedMatches ? '✅' : '❌');

    const test2Pass = durationUpdated && itineraryUpdated && durationMatches && computedMatches;
    console.log(`\n[TEST 2] ${test2Pass ? '✅ PASS' : '❌ FAIL'}`);

    // Save result
    fs.writeFileSync('./data/test-duration-sync.json', JSON.stringify({
      test: 'Duration sync when changing itinerary',
      turn1: { message: msg2a, duration: 15, itineraryDays: 15 },
      turn2: { message: msg2b, duration: appContext2.summary.duration_days, itineraryDays: appContext2.itinerary.days.length },
      context: appContext2.summary,
      itinerary: { daysCount: appContext2.itinerary.days.length, computed: appContext2.itinerary.computed },
      validation: { durationUpdated, itineraryUpdated, durationMatches, computedMatches, passed: test2Pass }
    }, null, 2));

  } catch (err) {
    console.error('❌ ERROR:', err.message);
  }

  console.log('\n' + '='.repeat(100));
  console.log('ALL TESTS COMPLETE');
  console.log('='.repeat(100));
}

testDateAndDurationSync().catch(console.error);
