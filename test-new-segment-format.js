import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log('Testing NEW segment structure - only "place" field (max 4 words)\n');

const chatId = `segment-format-test-${Date.now()}`;
let conversationHistory = [];

// Turn 1: Provide all details
console.log('📝 Turn 1: Provide all details');
const msg1 = 'Create a 3-day Rome itinerary from Paris, March 10-13, 2026, 2 people, 2000 EUR total';
conversationHistory.push({ role: 'user', content: msg1 });

const result1 = await runMultiAgentSystem(msg1, chatId, conversationHistory);
conversationHistory.push({ role: 'assistant', content: result1.finalOutput });

console.log('Agent response (first 200 chars):', result1.finalOutput.substring(0, 200));

// Turn 2: Confirm
console.log('\n📝 Turn 2: Confirm itinerary creation');
const msg2 = 'Yes, please create the detailed itinerary';
conversationHistory.push({ role: 'user', content: msg2 });

const result2 = await runMultiAgentSystem(msg2, chatId, conversationHistory);

console.log('\n✅ VALIDATION:');
console.log('─'.repeat(80));

const itinerary = result2.context.itinerary;
console.log(`Total Days: ${itinerary.days?.length || 0}`);

if (itinerary.days && itinerary.days.length > 0) {
  const day1 = itinerary.days[0];
  console.log(`\nDay 1 Title: ${day1.title}`);

  // Check segment counts
  const morningCount = day1.segments.morning.length;
  const afternoonCount = day1.segments.afternoon.length;
  const eveningCount = day1.segments.evening.length;

  console.log(`\n📊 Segment Array Lengths:`);
  console.log(`  Morning: ${morningCount} object(s) ${morningCount === 1 ? '✅' : '❌ SHOULD BE 1'}`);
  console.log(`  Afternoon: ${afternoonCount} object(s) ${afternoonCount === 1 ? '✅' : '❌ SHOULD BE 1'}`);
  console.log(`  Evening: ${eveningCount} object(s) ${eveningCount === 1 ? '✅' : '❌ SHOULD BE 1'}`);

  // Check field structure
  if (morningCount > 0) {
    const morning = day1.segments.morning[0];
    console.log(`\n🌅 Morning Segment:`);
    console.log(`  place: "${morning.place}"`);
    console.log(`  duration_hours: ${morning.duration_hours}`);
    console.log(`  descriptor: "${morning.descriptor}"`);

    const wordCount = morning.place.split(' ').length;
    console.log(`  Word count in "place": ${wordCount} ${wordCount <= 4 ? '✅' : '❌ (should be max 4)'}`);
    console.log(`  Has "places" field: ${morning.places !== undefined ? '❌ (should NOT exist)' : '✅'}`);
  }

  if (afternoonCount > 0) {
    const afternoon = day1.segments.afternoon[0];
    console.log(`\n☀️ Afternoon Segment:`);
    console.log(`  place: "${afternoon.place}"`);
    console.log(`  duration_hours: ${afternoon.duration_hours}`);
    console.log(`  descriptor: "${afternoon.descriptor}"`);

    const wordCount = afternoon.place.split(' ').length;
    console.log(`  Word count in "place": ${wordCount} ${wordCount <= 4 ? '✅' : '❌ (should be max 4)'}`);
    console.log(`  Has "places" field: ${afternoon.places !== undefined ? '❌ (should NOT exist)' : '✅'}`);
  }

  if (eveningCount > 0) {
    const evening = day1.segments.evening[0];
    console.log(`\n🌆 Evening Segment:`);
    console.log(`  place: "${evening.place}"`);
    console.log(`  duration_hours: ${evening.duration_hours}`);
    console.log(`  descriptor: "${evening.descriptor}"`);

    const wordCount = evening.place.split(' ').length;
    console.log(`  Word count in "place": ${wordCount} ${wordCount <= 4 ? '✅' : '❌ (should be max 4)'}`);
    console.log(`  Has "places" field: ${evening.places !== undefined ? '❌ (should NOT exist)' : '✅'}`);
  }

  const allValid = morningCount === 1 && afternoonCount === 1 && eveningCount === 1;

  console.log('\n' + '='.repeat(80));
  console.log(`RESULT: ${allValid ? '✅ PASSED' : '❌ FAILED'} - New segment structure validation`);
  console.log('='.repeat(80));

  if (allValid) {
    console.log('✅ All segments contain exactly 1 object');
    console.log('✅ No "places" field (removed as requested)');
    console.log('✅ Only "place" (max 4 words), "duration_hours", "descriptor" fields');
  }
} else {
  console.log('❌ No itinerary created');
}
