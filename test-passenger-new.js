import { placesIntelligenceAgent } from './src/ai/multiAgentSystem.js';
import { run, user } from '@openai/agents';

// Test the enhanced places intelligence agent
async function testPassengerExtraction() {
  console.log('Testing Enhanced Places Intelligence Agent...');

  // Mock trip planner output with passenger count
  const mockTripPlannerOutput = `
Great! I'd be happy to help you plan your trip to Tokyo. Based on your preferences for temples and food experiences, here's what I can suggest:

For your family of 4 people, Tokyo offers incredible temple visits and authentic culinary experiences. The city has numerous ancient temples alongside world-class food markets and restaurants.

Let me create an itinerary that focuses on your interests in temples and food culture for your group of 4 travelers.

Day 1: Temple and Traditional Food Discovery
- Visit Senso-ji Temple in Asakusa
- Explore Nakamise Shopping Street for traditional snacks
- Experience authentic sushi at Tsukiji Outer Market
  `;

  const prompt = `TRIP PLANNER OUTPUT:
${mockTripPlannerOutput}

DESTINATION: Tokyo
USER INTERESTS: temples, food
CURRENT PASSENGER COUNT IN CONTEXT: NOT SET

TASKS:
1. PASSENGER COUNT EXTRACTION: Analyze the TRIP PLANNER OUTPUT above for passenger/traveler count mentions. Look for patterns like "X people", "couple", "family of X", "solo", etc. Extract if found and context shows "NOT SET".

2. PLACES SUGGESTIONS: Suggest 5 popular places of interest for Tokyo matching user interests. Include landmarks, cultural sites, food markets, entertainment venues.

Return structured output with both passenger count analysis and places suggestions.`;

  try {
    const result = await run(placesIntelligenceAgent, [user(prompt)]);

    console.log('\n=== FULL RESULT STRUCTURE ===');
    console.log('result keys:', Object.keys(result));
    console.log('result type:', typeof result);

    console.log('\n=== FINAL OUTPUT ===');
    console.log('finalOutput type:', typeof result.finalOutput);
    console.log('finalOutput:', JSON.stringify(result.finalOutput, null, 2));

    console.log('\n=== OTHER PROPERTIES ===');
    console.log('output:', result.output);
    console.log('lastAgent:', result.lastAgent);

    // Test passenger count extraction
    if (result.finalOutput?.passengerCount) {
      console.log(`\n Passenger Count Extracted: ${result.finalOutput.passengerCount}`);
      console.log(` Confidence: ${result.finalOutput.passengerConfidence}`);
    } else {
      console.log('\nL Passenger count not found in finalOutput');
    }

    // Test places extraction
    if (result.finalOutput?.placesOfInterests) {
      console.log(`\n Places Found: ${result.finalOutput.placesOfInterests.length}`);
      result.finalOutput.placesOfInterests.forEach((place, i) => {
        console.log(`${i + 1}. ${place.placeName}: ${place.description}`);
      });
    } else {
      console.log('\nL Places not found in finalOutput');
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testPassengerExtraction();