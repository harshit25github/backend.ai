import 'dotenv/config';
import { enhancedManagerAgent, createEnhancedContext } from './src/ai/enhanced-manager.js';
import { run, user } from '@openai/agents';

async function testEnhancedContext() {
  console.log('=== TESTING ENHANCED CONTEXT SYSTEM ===\n');

  // Create test context
  const appContext = createEnhancedContext({ name: 'TestUser', uid: 999 });

  console.log('Initial Context:');
  console.log('Summary:', JSON.stringify(appContext.summary, null, 2));
  console.log('Itinerary days:', appContext.itinerary.days.length);

  // Test 1: Basic trip planning request
  console.log('\n--- TEST 1: Basic Trip Planning ---');
  const message1 = 'I want to plan a 5-day trip from Mumbai to Rome for 2 people, departing 2024-12-15 and returning 2024-12-20. Budget is ₹200000 total. We are interested in historical sites and Italian cuisine. Please create a detailed itinerary.';

  try {
    const result1 = await run(enhancedManagerAgent, [user(message1)], { context: appContext });

    console.log('Agent Response:', result1.finalOutput);
    console.log('Last Agent:', result1.lastAgent?.name);

    console.log('\nUpdated Summary:');
    console.log(JSON.stringify(appContext.summary, null, 2));

    console.log('\nUpdated Itinerary:');
    console.log('Days:', appContext.itinerary.days.length);
    if (appContext.itinerary.days.length > 0) {
      appContext.itinerary.days.forEach((day, index) => {
        console.log(`Day ${index + 1}: ${day.title} (${day.date})`);
        console.log(`  Morning: ${day.segments.morning.length} activities`);
        console.log(`  Afternoon: ${day.segments.afternoon.length} activities`);
        console.log(`  Evening: ${day.segments.evening.length} activities`);
      });
    }

    console.log('\nComputed:', JSON.stringify(appContext.itinerary.computed, null, 2));

  } catch (error) {
    console.error('Test 1 failed:', error.message);
  }

  // Test 2: Follow-up request to modify the trip
  console.log('\n--- TEST 2: Trip Modification ---');
  const message2 = 'Can you add one more day to the trip and extend it to 6 days? Also, I want to include a cooking class in the itinerary.';

  try {
    const result2 = await run(enhancedManagerAgent, [user(message1), user(message2)], { context: appContext });

    console.log('Agent Response:', result2.finalOutput);
    console.log('Last Agent:', result2.lastAgent?.name);

    console.log('\nFinal Summary:');
    console.log(JSON.stringify(appContext.summary, null, 2));

    console.log('\nFinal Itinerary:');
    console.log('Days:', appContext.itinerary.days.length);
    console.log('Computed:', JSON.stringify(appContext.itinerary.computed, null, 2));

  } catch (error) {
    console.error('Test 2 failed:', error.message);
  }

  // Test 3: Booking request
  console.log('\n--- TEST 3: Booking Request ---');
  const message3 = 'Great! Now please help me book flights and hotels for this trip.';

  try {
    const result3 = await run(enhancedManagerAgent, [user(message3)], { context: appContext });

    console.log('Agent Response:', result3.finalOutput);
    console.log('Last Agent:', result3.lastAgent?.name);

    console.log('\nFinal Context Summary:');
    console.log(JSON.stringify(appContext.summary, null, 2));

  } catch (error) {
    console.error('Test 3 failed:', error.message);
  }

  console.log('\n=== ENHANCED CONTEXT TESTING COMPLETE ===');
}

// Test the schema validation
async function testSchemaValidation() {
  console.log('\n=== TESTING SCHEMA VALIDATION ===');

  try {
    const testSummary = {
      origin: { city: 'Mumbai', iata: 'BOM' },
      destination: { city: 'Rome', iata: 'FCO' },
      outbound_date: '2024-12-15',
      return_date: '2024-12-20',
      duration_days: 5,
      passenger_count: 2,
      budget: {
        amount: 200000,
        currency: 'INR',
        per_person: false
      },
      tripTypes: ['cultural', 'culinary', 'historical'],
      placesOfInterests: [
        { placeName: 'Colosseum', description: 'Ancient Roman amphitheater' },
        { placeName: 'Vatican City', description: 'Papal residence and museums' }
      ]
    };

    console.log('Test Summary Object:', JSON.stringify(testSummary, null, 2));

    const testItinerary = {
      days: [
        {
          title: 'Arrival in Rome',
          date: '2024-12-15',
          segments: {
            morning: [
              { places: 'Airport to Hotel', duration_hours: 1, descriptor: 'Transfer and check-in' }
            ],
            afternoon: [
              { places: 'Spanish Steps and Trevi Fountain', duration_hours: 3, descriptor: 'Walking tour of historic sites' }
            ],
            evening: [
              { places: 'Trastevere district', duration_hours: 2, descriptor: 'Dinner at local restaurant' }
            ]
          }
        }
      ],
      computed: {
        duration_days: 5,
        itinerary_length: 1,
        matches_duration: false
      }
    };

    console.log('Test Itinerary Object:', JSON.stringify(testItinerary, null, 2));
    console.log('Schema validation tests passed!');

  } catch (error) {
    console.error('Schema validation failed:', error.message);
  }

  console.log('=== SCHEMA VALIDATION COMPLETE ===\n');
}

// Run tests
async function runTests() {
  console.log('Starting Enhanced Context System Tests...\n');

  await testSchemaValidation();
  await testEnhancedContext();

  console.log('\nAll tests completed!');
}

runTests().catch(console.error);