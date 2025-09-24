import { captureTripContext } from './src/ai/multiAgentSystem.js';

// Test the captureTripContext tool with passenger count
async function testPassengerCount() {
  console.log('Testing passenger count extraction...');

  // Create a mock runContext with context
  const mockContext = {
    summary: {
      origin: { city: null, iata: null },
      destination: { city: null, iata: null },
      outbound_date: null,
      return_date: null,
      duration_days: null,
      passenger_count: null,
      budget: {
        amount: null,
        currency: 'INR',
        per_person: true
      },
      tripTypes: [],
      placesOfInterests: []
    },
    itinerary: {
      days: [],
      computed: { matches_duration: true }
    },
    userInfo: { preferences: [] },
    conversationState: { awaitingConfirmation: false },
    trip: {
      bookingStatus: 'pending',
      bookingConfirmed: false,
      bookingDetails: { flights: [], hotels: [], activities: [] }
    }
  };

  const runContext = {
    context: mockContext,
    logger: console
  };

  // Test the tool execution
  const args = {
    origin: 'Mumbai',
    destination: 'Tokyo',
    passenger_count: 4,
    budget_amount: 200000,
    budget_currency: 'INR'
  };

  try {
    // Call the tool as a function (tool objects are callable)
    const result = await captureTripContext(args, runContext);

    console.log('✅ Tool execution result:', result);
    console.log('✅ Updated context summary:', {
      origin: mockContext.summary.origin,
      destination: mockContext.summary.destination,
      passenger_count: mockContext.summary.passenger_count,
      budget_amount: mockContext.summary.budget.amount
    });

    // Verify the passenger count was set correctly
    if (mockContext.summary.passenger_count === 4) {
      console.log('✅ Passenger count extraction working correctly!');
    } else {
      console.log('❌ Passenger count extraction failed!');
    }

  } catch (error) {
    console.error('❌ Error in passenger count test:', error);
  }
}

testPassengerCount().catch(console.error);
