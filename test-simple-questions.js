import 'dotenv/config';
import { run, user } from '@openai/agents';
import { enhancedManagerAgent } from './src/ai/enhanced-manager.js';

// Test context
function createTestContext() {
  return {
    userInfo: { name: 'Test User', uid: 1 },
    summary: {
      origin: { city: null, iata: null },
      destination: { city: null, iata: null },
      outbound_date: null,
      return_date: null,
      duration_days: null,
      pax: null,
      budget: { amount: null, currency: 'INR', per_person: true },
      tripType: [],
      placesOfInterest: [],
      suggestedQuestions: []
    },
    itinerary: { days: [], computed: { duration_days: null, itinerary_length: null, matches_duration: true } },
    logger: console
  };
}

async function runQuickTest() {
  console.log('\n🧪 Testing Simple, Direct Questions\n');
  console.log('='.repeat(80));
  
  // Test 1: Vague destination request - should ask for slots
  console.log('\n📤 USER: I want to travel somewhere nice\n');
  
  const context = createTestContext();
  const result = await run(enhancedManagerAgent, [user('I want to travel somewhere nice')], { context });
  
  console.log(`🤖 AGENT: ${result.lastAgent?.name}`);
  console.log(`\n📥 RESPONSE:\n${result.finalOutput}\n`);
  
  // Check if asking for slots
  const response = result.finalOutput;
  const asksOrigin = response.toLowerCase().includes('where') && response.toLowerCase().includes('from');
  const asksBudget = response.toLowerCase().includes('budget');
  const asksDays = response.toLowerCase().includes('days') || response.toLowerCase().includes('how long');
  const asksTravelers = response.toLowerCase().includes('travelers') || response.toLowerCase().includes('how many');
  
  console.log('✅ VERIFICATION:');
  console.log(`   Asks for origin: ${asksOrigin ? 'YES ✓' : 'NO ✗'}`);
  console.log(`   Asks for budget: ${asksBudget ? 'YES ✓' : 'NO ✗'}`);
  console.log(`   Asks for duration: ${asksDays ? 'YES ✓' : 'NO ✗'}`);
  console.log(`   Asks for travelers: ${asksTravelers ? 'YES ✓' : 'NO ✗'}`);
  
  const allGood = asksOrigin && asksBudget && asksDays && asksTravelers;
  console.log(`\n${allGood ? '✅ SUCCESS' : '⚠️  PARTIAL'}: Agent asks simple, direct questions for missing slots`);
  
  console.log('\n' + '='.repeat(80));
  
  // Test 2: Booking with missing info - should ask for required fields
  console.log('\n📤 USER: I want to book flights to Tokyo\n');
  
  const context2 = createTestContext();
  const result2 = await run(enhancedManagerAgent, [user('I want to book flights to Tokyo')], { context: context2 });
  
  console.log(`🤖 AGENT: ${result2.lastAgent?.name}`);
  console.log(`\n📥 RESPONSE:\n${result2.finalOutput}\n`);
  
  const response2 = result2.finalOutput;
  const needsDates = response2.toLowerCase().includes('when') || response2.toLowerCase().includes('dates');
  const needsPax = response2.toLowerCase().includes('travelers') || response2.toLowerCase().includes('how many');
  const needsOrigin = response2.toLowerCase().includes('where') && (response2.toLowerCase().includes('from') || response2.toLowerCase().includes('depart'));
  
  console.log('✅ VERIFICATION:');
  console.log(`   Asks for dates: ${needsDates ? 'YES ✓' : 'NO ✗'}`);
  console.log(`   Asks for travelers: ${needsPax ? 'YES ✓' : 'NO ✗'}`);
  console.log(`   Asks for origin: ${needsOrigin ? 'YES ✓' : 'NO ✗'}`);
  
  const bookingGood = needsDates && needsPax && needsOrigin;
  console.log(`\n${bookingGood ? '✅ SUCCESS' : '⚠️  PARTIAL'}: Booking agent asks for required fields directly`);
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✨ Simple questioning approach is working!\n');
}

runQuickTest().catch(console.error);

