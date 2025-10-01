import { enhancedManagerAgent, createEnhancedContext } from './src/ai/enhanced-manager.js';
import { run, user } from '@openai/agents';

console.log('='.repeat(80));
console.log('VERIFYING BOTH FIXES');
console.log('='.repeat(80));

// Test 1: Return date calculation
console.log('\n[TEST 1] Return date auto-calculation');
console.log('Input: "Create 5-day Paris itinerary starting January 15, 2025"');
console.log('Expected: outbound=2025-01-15, return=2025-01-20 (15+5=20)');

const ctx1 = createEnhancedContext({ name: 'Test', uid: 1 });
await run(enhancedManagerAgent, [{ role: 'user', content: 'Create a 5-day Paris itinerary for 2 people starting January 15, 2025, budget 2000 EUR' }], { context: ctx1 });

console.log('Result:');
console.log('  Outbound:', ctx1.summary.outbound_date);
console.log('  Duration:', ctx1.summary.duration_days, 'days');
console.log('  Return:', ctx1.summary.return_date);
console.log('  ✅ PASS' if ctx1.summary.return_date === '2025-01-20' else '  ❌ FAIL');

// Test 2: Duration sync
console.log('\n[TEST 2] Duration sync when changing itinerary');
console.log('Step 1: Create 15-day itinerary');
console.log('Step 2: Change to 8 days');
console.log('Expected: duration_days updates from 15 → 8');

const ctx2 = createEnhancedContext({ name: 'Test', uid: 1 });
let thread2 = [];

const res2a = await run(enhancedManagerAgent, thread2.concat({ role: 'user', content: 'Create a 15-day Thailand itinerary for 1 person, budget 1500 USD' }), { context: ctx2 });
thread2 = res2a.history;

console.log('\nAfter step 1:');
console.log('  Duration:', ctx2.summary.duration_days, 'days');
console.log('  Itinerary:', ctx2.itinerary.days.length, 'days');

const res2b = await run(enhancedManagerAgent, thread2.concat({ role: 'user', content: 'Change it to 8 days instead' }), { context: ctx2 });

console.log('\nAfter step 2:');
console.log('  Duration:', ctx2.summary.duration_days, 'days');
console.log('  Itinerary:', ctx2.itinerary.days.length, 'days');
console.log('  Match:', ctx2.summary.duration_days === ctx2.itinerary.days.length ? '✅' : '❌');
console.log('  ' + (ctx2.summary.duration_days === 8 ? '✅ PASS' : '❌ FAIL'));

console.log('\n' + '='.repeat(80));
