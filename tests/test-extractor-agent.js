/**
 * Context Extractor Agent Test Suite
 *
 * Tests the extractor agent's ability to:
 * 1. Merge old context with new changes
 * 2. Output complete context
 * 3. Handle extraction leakage
 * 4. Process complex modifications
 */

import { contextExtractorAgent } from '../src/ai/multiAgentSystem.js';

// Test cases with increasing complexity
const TEST_CASES = [
  {
    name: "Test 1: New Trip Request (Empty Context)",
    description: "User provides basic trip details on empty context",
    oldContext: {
      summary: {
        origin: null,
        destination: null,
        outbound_date: null,
        duration_days: null,
        pax: null,
        budget: { amount: null, currency: "INR", per_person: true },
        tripTypes: [],
        placesOfInterest: [],
        upcomingEvents: [],
        suggestedQuestions: []
      },
      itinerary: null
    },
    userMessage: "Plan a 5-day trip to Paris from Mumbai for 2 people",
    assistantResponse: "Great! I'd love to help plan your Paris trip. To create a perfect itinerary, I need a few more details:\n- Your travel dates (or a rough month/season)?\n- Budget per person?\n- Any specific interests (art, food, shopping, history)?",
    expectedChanges: {
      origin: { city: "Mumbai", iata: "BOM" },
      destination: { city: "Paris", iata: "CDG" },
      duration_days: 5,
      pax: 2
    }
  },

  {
    name: "Test 2: Single Field Modification",
    description: "User changes pax from 2 to 3, all other fields should remain",
    oldContext: {
      summary: {
        origin: { city: "Mumbai", iata: "BOM" },
        destination: { city: "Paris", iata: "CDG" },
        outbound_date: null,
        duration_days: 5,
        pax: 2,
        budget: { amount: null, currency: "INR", per_person: true },
        tripTypes: [],
        placesOfInterest: [],
        upcomingEvents: [],
        suggestedQuestions: []
      },
      itinerary: null
    },
    userMessage: "Actually, make it 3 people instead of 2",
    assistantResponse: "Perfect! I've updated your trip to 3 travelers. Your 5-day Paris trip from Mumbai is now planned for 3 people.",
    expectedChanges: {
      pax: 3,
      // All other fields should remain unchanged
    }
  },

  {
    name: "Test 3: Multiple Field Updates",
    description: "User changes duration, pax, and adds dates",
    oldContext: {
      summary: {
        origin: { city: "Mumbai", iata: "BOM" },
        destination: { city: "Paris", iata: "CDG" },
        outbound_date: null,
        duration_days: 5,
        pax: 2,
        budget: { amount: null, currency: "INR", per_person: true },
        tripTypes: [],
        placesOfInterest: [],
        upcomingEvents: [],
        suggestedQuestions: []
      },
      itinerary: null
    },
    userMessage: "Change it to 7 days for 4 people, traveling from January 15, 2026",
    assistantResponse: "Excellent! I've updated your trip:\n- Duration: 7 days\n- Travelers: 4 people\n- Departure: January 15, 2026\n\nThis gives you plenty of time to explore Paris thoroughly!",
    expectedChanges: {
      duration_days: 7,
      pax: 4,
      outbound_date: "2026-01-15"
    }
  },

  {
    name: "Test 4: Extraction Leakage Prevention",
    description: "User asks question without confirming trip",
    oldContext: {
      summary: {
        origin: { city: "Delhi", iata: "DEL" },
        destination: null,
        outbound_date: null,
        duration_days: null,
        pax: null,
        budget: { amount: null, currency: "INR", per_person: true },
        tripTypes: [],
        placesOfInterest: [],
        upcomingEvents: [],
        suggestedQuestions: []
      },
      itinerary: null
    },
    userMessage: "What's the weather like in Bali in July?",
    assistantResponse: "Bali in July is actually quite pleasant! It's dry season with temperatures around 26-28°C. Great time for beach activities and temple visits. Are you planning a trip to Bali?",
    expectedChanges: {
      // NO CHANGES - user only asked a question, didn't confirm trip
    }
  },

  {
    name: "Test 5: Full Itinerary Extraction",
    description: "Assistant provides complete itinerary with places and questions",
    oldContext: {
      summary: {
        origin: { city: "Mumbai", iata: "BOM" },
        destination: { city: "Goa", iata: "GOI" },
        outbound_date: "2026-11-20",
        duration_days: 3,
        pax: 2,
        budget: { amount: 40000, currency: "INR", per_person: false },
        tripTypes: ["beach", "relaxation"],
        placesOfInterest: [],
        upcomingEvents: [],
        suggestedQuestions: []
      },
      itinerary: null
    },
    userMessage: "Yes, create the detailed itinerary",
    assistantResponse: `Here's your 3-day Goa beach itinerary:

### Day 1: Arrival & Beach Relaxation
**Morning:** Airport transfer to hotel in South Goa
**Afternoon:** Colva Beach - pristine sands and calm waters
**Evening:** Beach shack dinner with fresh seafood

### Day 2: South Goa Exploration
**Morning:** Beach walk from Betalbatim to Majorda
**Afternoon:** Lunch at Martin's Corner (famous Goan restaurant)
**Evening:** Colva market for souvenirs

### Day 3: Departure
**Morning:** Hotel checkout and airport transfer

Would you like details on:
- Best beach shacks in South Goa?
- How to get from airport to hotel?
- Water sports options at Colva Beach?`,
    expectedChanges: {
      placesOfInterest: [
        { placeName: "Colva Beach", description: "Pristine beach in South Goa" },
        { placeName: "Betalbatim Beach", description: "Peaceful coastal area" },
        { placeName: "Martin's Corner", description: "Famous Goan restaurant" }
      ],
      suggestedQuestions: [
        "Best beach shacks in South Goa?",
        "How to get from airport to hotel?",
        "Water sports options at Colva Beach?"
      ],
      itinerary: {
        days: 3 // Should have 3 days
      }
    }
  },

  {
    name: "Test 6: Destination Change (Complex)",
    description: "User changes destination mid-planning, should preserve origin/pax but update destination",
    oldContext: {
      summary: {
        origin: { city: "Mumbai", iata: "BOM" },
        destination: { city: "Paris", iata: "CDG" },
        outbound_date: "2026-01-15",
        duration_days: 5,
        pax: 2,
        budget: { amount: 150000, currency: "INR", per_person: true },
        tripTypes: ["cultural", "food"],
        placesOfInterest: [
          { placeName: "Eiffel Tower", description: "Iconic landmark" }
        ],
        upcomingEvents: [],
        suggestedQuestions: []
      },
      itinerary: null
    },
    userMessage: "Actually, let's change the destination to Tokyo instead of Paris",
    assistantResponse: "Great choice! Tokyo is amazing. I've updated your trip:\n- From: Mumbai → Tokyo\n- Duration: 5 days\n- Travelers: 2 people\n- Budget: ₹150,000 per person\n\nTokyo offers incredible food, modern tech, and traditional culture. Let me know when you'd like me to create the itinerary!",
    expectedChanges: {
      destination: { city: "Tokyo", iata: "NRT" },
      tripTypes: ["cultural", "food", "modern"], // Should update based on Tokyo
      placesOfInterest: [] // Should clear Paris places
    }
  },

  {
    name: "Test 7: Budget Update (Complex Object)",
    description: "User provides budget information",
    oldContext: {
      summary: {
        origin: { city: "Delhi", iata: "DEL" },
        destination: { city: "Dubai", iata: "DXB" },
        outbound_date: "2026-02-10",
        duration_days: 4,
        pax: 3,
        budget: { amount: null, currency: "INR", per_person: true },
        tripTypes: [],
        placesOfInterest: [],
        upcomingEvents: [],
        suggestedQuestions: []
      },
      itinerary: null
    },
    userMessage: "My total budget is ₹200,000 for all 3 people",
    assistantResponse: "Got it! Total budget of ₹200,000 for 3 people (about ₹66,600 per person). That's a comfortable budget for Dubai! I can plan a great mix of luxury experiences and value activities.",
    expectedChanges: {
      budget: { amount: 200000, currency: "INR", per_person: false }
    }
  },

  {
    name: "Test 8: Trip Types Addition",
    description: "User specifies interests/preferences",
    oldContext: {
      summary: {
        origin: { city: "Bangalore", iata: "BLR" },
        destination: { city: "Bali", iata: "DPS" },
        outbound_date: null,
        duration_days: 6,
        pax: 2,
        budget: { amount: null, currency: "INR", per_person: true },
        tripTypes: [],
        placesOfInterest: [],
        upcomingEvents: [],
        suggestedQuestions: []
      },
      itinerary: null
    },
    userMessage: "We're interested in adventure activities, beaches, and trying local food",
    assistantResponse: "Perfect combination for Bali! I'll focus your itinerary on:\n🏄 Adventure: Surfing, diving, white water rafting\n🏖️ Beaches: Seminyak, Nusa Dua, Uluwatu\n🍜 Food: Traditional warungs, cooking classes, beach cafes\n\nWhat dates work for you?",
    expectedChanges: {
      tripTypes: ["adventure", "beach", "food"]
    }
  },

  {
    name: "Test 9: No Changes (Conversational)",
    description: "User and assistant chat without providing extractable info",
    oldContext: {
      summary: {
        origin: { city: "Mumbai", iata: "BOM" },
        destination: { city: "Paris", iata: "CDG" },
        outbound_date: "2026-01-15",
        duration_days: 5,
        pax: 2,
        budget: { amount: 150000, currency: "INR", per_person: true },
        tripTypes: ["cultural", "food"],
        placesOfInterest: [],
        upcomingEvents: [],
        suggestedQuestions: []
      },
      itinerary: null
    },
    userMessage: "What's the best way to get around Paris?",
    assistantResponse: "Paris has excellent public transport! The Metro is the fastest and most convenient - €2.10 per ticket or €16.90 for a 10-ticket carnet. For tourists, I recommend:\n1. Metro - Fast, connects everywhere\n2. Walking - Paris is beautiful to explore on foot\n3. Vélib bikes - Bike sharing system\n4. Bus 69 - Scenic route through major areas\n\nAvoid taxis unless necessary - expensive and traffic can be bad.",
    expectedChanges: {
      // NO CHANGES - just informational exchange
    }
  },

  {
    name: "Test 10: Complex Multi-Change",
    description: "User provides dates, changes pax, updates budget, all at once",
    oldContext: {
      summary: {
        origin: { city: "Hyderabad", iata: "HYD" },
        destination: { city: "Thailand", iata: "BKK" },
        outbound_date: null,
        duration_days: 7,
        pax: 2,
        budget: { amount: null, currency: "INR", per_person: true },
        tripTypes: [],
        placesOfInterest: [],
        upcomingEvents: [],
        suggestedQuestions: []
      },
      itinerary: null
    },
    userMessage: "Let's do March 10-17, 2026. Also adding one more person, so 3 travelers total. Budget is ₹80,000 per person.",
    assistantResponse: "Perfect! I've updated everything:\n- Dates: March 10-17, 2026 (7 nights)\n- Travelers: 3 people\n- Budget: ₹80,000 per person (₹2.4L total)\n\nThat's a great budget for Thailand! You can enjoy nice hotels, good food, and plenty of activities. Ready for me to create your itinerary?",
    expectedChanges: {
      outbound_date: "2026-03-10",
      pax: 3,
      budget: { amount: 80000, currency: "INR", per_person: true }
    }
  }
];

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper to format output
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper to compare objects
function deepEqual(obj1, obj2) {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

// Validate extraction result
function validateExtraction(testCase, extractedContext) {
  const errors = [];

  // Check that old context fields are preserved
  const oldSummary = testCase.oldContext.summary;
  const newSummary = extractedContext.summary;

  // For each field in expectedChanges, verify it's updated
  for (const [field, expectedValue] of Object.entries(testCase.expectedChanges)) {
    if (field === 'itinerary' && expectedValue.days) {
      // Special handling for itinerary
      if (!extractedContext.itinerary || !extractedContext.itinerary.days) {
        errors.push(`Expected itinerary with ${expectedValue.days} days, got none`);
      } else if (extractedContext.itinerary.days.length !== expectedValue.days) {
        errors.push(`Expected ${expectedValue.days} days, got ${extractedContext.itinerary.days.length}`);
      }
      continue;
    }

    if (!deepEqual(newSummary[field], expectedValue)) {
      errors.push(`Field '${field}' mismatch:\n  Expected: ${JSON.stringify(expectedValue)}\n  Got: ${JSON.stringify(newSummary[field])}`);
    }
  }

  // For fields NOT in expectedChanges, verify they're preserved from oldContext
  for (const [field, oldValue] of Object.entries(oldSummary)) {
    if (!(field in testCase.expectedChanges)) {
      if (!deepEqual(newSummary[field], oldValue)) {
        errors.push(`Field '${field}' should be preserved but changed:\n  Old: ${JSON.stringify(oldValue)}\n  New: ${JSON.stringify(newSummary[field])}`);
      }
    }
  }

  return errors;
}

// Run a single test case
async function runTest(testCase, index) {
  log(`\n${'='.repeat(80)}`, 'cyan');
  log(`TEST ${index + 1}: ${testCase.name}`, 'bright');
  log(`Description: ${testCase.description}`, 'blue');
  log('='.repeat(80), 'cyan');

  const extractionPrompt = `
EXTRACTION TASK:

**Old Context:**
${JSON.stringify(testCase.oldContext, null, 2)}

**User Message:**
${testCase.userMessage}

**Assistant Response:**
${testCase.assistantResponse}

Analyze the conversation and extract trip information. Merge old context with any changes, then output COMPLETE updated context.
`;

  try {
    log('\n📤 Sending to extractor agent...', 'yellow');

    const startTime = Date.now();
    const result = await contextExtractorAgent.run({
      input: extractionPrompt
    });
    const duration = Date.now() - startTime;

    const extractedContext = result.finalOutput;

    log(`\n✅ Extraction completed in ${duration}ms`, 'green');
    log('\n📦 Extracted Context:', 'cyan');
    console.log(JSON.stringify(extractedContext, null, 2));

    // Validate extraction
    log('\n🔍 Validating extraction...', 'yellow');
    const errors = validateExtraction(testCase, extractedContext);

    if (errors.length === 0) {
      log(`\n✅ PASS: All validations passed!`, 'green');
      return { passed: true, duration, errors: [] };
    } else {
      log(`\n❌ FAIL: ${errors.length} validation error(s):`, 'red');
      errors.forEach((err, i) => log(`  ${i + 1}. ${err}`, 'red'));
      return { passed: false, duration, errors };
    }

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, 'red');
    console.error(error);
    return { passed: false, duration: 0, errors: [error.message] };
  }
}

// Run all tests
async function runAllTests() {
  log('\n' + '='.repeat(80), 'bright');
  log('CONTEXT EXTRACTOR AGENT TEST SUITE', 'bright');
  log('='.repeat(80) + '\n', 'bright');

  const results = [];
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < TEST_CASES.length; i++) {
    const result = await runTest(TEST_CASES[i], i);
    results.push({ ...result, name: TEST_CASES[i].name });

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }

    // Wait a bit between tests to avoid rate limits
    if (i < TEST_CASES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary
  log('\n\n' + '='.repeat(80), 'bright');
  log('TEST SUMMARY', 'bright');
  log('='.repeat(80), 'bright');

  results.forEach((result, i) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const color = result.passed ? 'green' : 'red';
    log(`${status} - Test ${i + 1}: ${result.name} (${result.duration}ms)`, color);
  });

  log('\n' + '='.repeat(80), 'bright');
  log(`Total: ${TEST_CASES.length} | Passed: ${passed} | Failed: ${failed}`, 'bright');
  log('='.repeat(80) + '\n', 'bright');

  if (failed === 0) {
    log('🎉 ALL TESTS PASSED!', 'green');
  } else {
    log(`⚠️  ${failed} TEST(S) FAILED`, 'red');
    process.exit(1);
  }
}

// Run tests
log('Starting extractor agent tests...\n', 'cyan');
runAllTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
