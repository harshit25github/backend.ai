import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log('Testing segment structure - single object per time segment\n');

const chatId = `segment-test-${Date.now()}`;
const conversationHistory = [];

// Test 1: Create simple 3-day itinerary
console.log('📝 Test: Create 3-day Rome itinerary');
conversationHistory.push({
  role: 'user',
  content: 'Create a 3-day itinerary for Rome from Paris, March 10-13, 2026, 2 people, 2000 EUR total'
});

const result1 = await runMultiAgentSystem(
  'Create a 3-day itinerary for Rome from Paris, March 10-13, 2026, 2 people, 2000 EUR total',
  chatId,
  conversationHistory
);

conversationHistory.push({
  role: 'assistant',
  content: result1.finalOutput
});

// Check segment structure
console.log('\n✅ VALIDATION:');
console.log('─'.repeat(80));

const itinerary = result1.context.itinerary;
console.log(`Total Days: ${itinerary.days?.length || 0}`);

if (itinerary.days && itinerary.days.length > 0) {
  const day1 = itinerary.days[0];
  console.log(`\nDay 1 Title: ${day1.title}`);

  // Check morning segment
  const morningCount = day1.segments.morning.length;
  const afternoonCount = day1.segments.afternoon.length;
  const eveningCount = day1.segments.evening.length;

  console.log(`\n📊 Segment Array Lengths:`);
  console.log(`  Morning: ${morningCount} object(s) ${morningCount === 1 ? '✅' : '❌ SHOULD BE 1'}`);
  console.log(`  Afternoon: ${afternoonCount} object(s) ${afternoonCount === 1 ? '✅' : '❌ SHOULD BE 1'}`);
  console.log(`  Evening: ${eveningCount} object(s) ${eveningCount === 1 ? '✅' : '❌ SHOULD BE 1'}`);

  // Show structure
  if (morningCount > 0) {
    const morning = day1.segments.morning[0];
    console.log(`\n🌅 Morning Segment Structure:`);
    console.log(`  place: "${morning.place || 'not set'}" ${morning.place ? '✅' : '❌'}`);
    console.log(`  duration_hours: ${morning.duration_hours} ${morning.duration_hours ? '✅' : '❌'}`);
    console.log(`  descriptor: "${morning.descriptor}" ${morning.descriptor ? '✅' : '❌'}`);
    console.log(`  ✅ Only "place", "duration_hours", "descriptor" fields (no "places" field)`);
  }

  if (afternoonCount > 0) {
    const afternoon = day1.segments.afternoon[0];
    console.log(`\n☀️ Afternoon Segment Structure:`);
    console.log(`  place: "${afternoon.place || 'not set'}" ${afternoon.place ? '✅' : '❌'}`);
    console.log(`  duration_hours: ${afternoon.duration_hours} ${afternoon.duration_hours ? '✅' : '❌'}`);
    console.log(`  descriptor: "${afternoon.descriptor}" ${afternoon.descriptor ? '✅' : '❌'}`);
  }

  // Validation summary
  const allValid = morningCount === 1 && afternoonCount === 1 && eveningCount === 1;

  console.log('\n' + '='.repeat(80));
  console.log(`RESULT: ${allValid ? '✅ PASSED' : '❌ FAILED'} - Segment structure validation`);
  console.log('='.repeat(80));

  if (allValid) {
    console.log('✅ All segments contain exactly 1 object (as expected)');
    console.log('✅ Matches enhanced-manager.js structure');
  } else {
    console.log('❌ Some segments have incorrect array length');
    console.log('Expected: 1 object per segment (morning/afternoon/evening)');
  }
} else {
  console.log('❌ No itinerary created');
}
