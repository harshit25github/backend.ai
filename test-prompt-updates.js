/**
 * Test script for validating prompt updates:
 * 1. Budget.total calculation
 * 2. Itinerary consolidation (single object per time period)
 * 3. tripType field (renamed from tripTypes)
 */

import OpenAI from "openai";
import { AGENT_PROMPTS } from "./src/ai/prompts.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Test colors
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Test 1: Budget.total calculation with per_person=true
async function testBudgetTotalPerPerson() {
  log("\n" + "=".repeat(80), colors.bright);
  log("TEST 1: Budget.total calculation (per_person=true)", colors.bright);
  log("=".repeat(80), colors.bright);

  const oldContext = {
    summary: {
      origin: null,
      destination: null,
      outbound_date: null,
      return_date: null,
      duration_days: null,
      pax: null,
      budget: { amount: null, currency: "INR", per_person: true, total: null },
      tripType: [],
      placesOfInterest: [],
      upcomingEvents: [],
      suggestedQuestions: [],
    },
    itinerary: null,
  };

  const userMessage = "Plan a 5-day trip to Paris from Mumbai for 2 people with 1 lakh per person budget";
  const assistantResponse = "Great! I'll plan your 5-day Paris trip for 2 people with ₹1 lakh per person budget.";

  log("\n📤 Input:", colors.cyan);
  log(`User: ${userMessage}`);
  log(`Assistant: ${assistantResponse}`);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `${AGENT_PROMPTS.EXTRACTOR_AGENT}

OLD CONTEXT:
${JSON.stringify(oldContext, null, 2)}`,
      },
      { role: "user", content: userMessage },
      { role: "assistant", content: assistantResponse },
    ],
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(response.choices[0].message.content);

  log("\n📥 Extracted Context:", colors.cyan);
  log(JSON.stringify(result, null, 2));

  // Validate budget.total
  log("\n🧪 Validation:", colors.yellow);
  const expectedTotal = 100000 * 2; // 1 lakh per person × 2 people
  const actualTotal = result.summary.budget.total;

  if (actualTotal === expectedTotal) {
    log(`✅ PASS: budget.total = ${actualTotal} (expected: ${expectedTotal})`, colors.green);
  } else {
    log(`❌ FAIL: budget.total = ${actualTotal} (expected: ${expectedTotal})`, colors.red);
  }

  // Validate tripType field exists
  if (result.summary.tripType !== undefined) {
    log(`✅ PASS: tripType field exists (not tripTypes)`, colors.green);
  } else {
    log(`❌ FAIL: tripType field missing`, colors.red);
  }

  return result;
}

// Test 2: Budget.total calculation with per_person=false
async function testBudgetTotalTotal() {
  log("\n" + "=".repeat(80), colors.bright);
  log("TEST 2: Budget.total calculation (per_person=false)", colors.bright);
  log("=".repeat(80), colors.bright);

  const oldContext = {
    summary: {
      origin: { city: "Delhi", iata: "DEL" },
      destination: { city: "Goa", iata: "GOI" },
      outbound_date: null,
      return_date: null,
      duration_days: 3,
      pax: 2,
      budget: { amount: null, currency: "INR", per_person: true, total: null },
      tripType: [],
      placesOfInterest: [],
      upcomingEvents: [],
      suggestedQuestions: [],
    },
    itinerary: null,
  };

  const userMessage = "My total budget is 40k for both people";
  const assistantResponse = "Perfect! I'll plan your Goa trip with a total budget of ₹40,000 for 2 people.";

  log("\n📤 Input:", colors.cyan);
  log(`User: ${userMessage}`);
  log(`Assistant: ${assistantResponse}`);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `${AGENT_PROMPTS.EXTRACTOR_AGENT}

OLD CONTEXT:
${JSON.stringify(oldContext, null, 2)}`,
      },
      { role: "user", content: userMessage },
      { role: "assistant", content: assistantResponse },
    ],
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(response.choices[0].message.content);

  log("\n📥 Extracted Context:", colors.cyan);
  log(JSON.stringify(result.summary.budget, null, 2));

  // Validate budget.total
  log("\n🧪 Validation:", colors.yellow);
  const expectedTotal = 40000; // Total budget for both
  const actualTotal = result.summary.budget.total;
  const perPerson = result.summary.budget.per_person;

  if (actualTotal === expectedTotal && perPerson === false) {
    log(`✅ PASS: budget.total = ${actualTotal}, per_person = ${perPerson}`, colors.green);
  } else {
    log(`❌ FAIL: budget.total = ${actualTotal}, per_person = ${perPerson} (expected: ${expectedTotal}, false)`, colors.red);
  }

  return result;
}

// Test 3: Itinerary consolidation (single object per time period)
async function testItineraryConsolidation() {
  log("\n" + "=".repeat(80), colors.bright);
  log("TEST 3: Itinerary Consolidation (Single object per time period)", colors.bright);
  log("=".repeat(80), colors.bright);

  const oldContext = {
    summary: {
      origin: { city: "Delhi", iata: "DEL" },
      destination: { city: "Paris", iata: "CDG" },
      outbound_date: "2026-01-15",
      return_date: "2026-01-16",
      duration_days: 1,
      pax: 2,
      budget: { amount: 50000, currency: "INR", per_person: true, total: 100000 },
      tripType: ["cultural", "food"],
      placesOfInterest: [],
      upcomingEvents: [],
      suggestedQuestions: [],
    },
    itinerary: null,
  };

  const userMessage = "Create the itinerary";
  const assistantResponse = `Here's your 1-day Paris itinerary:

### Day 1: Paris Highlights

#### Morning
• **Eiffel Tower Visit**
  - Visit the iconic Eiffel Tower, go up to 2nd floor
  - Duration: 2 hours
  - Cost: ₹2,500 per person

• **Champs-Élysées Walk**
  - Stroll down the famous avenue, visit Arc de Triomphe
  - Duration: 2 hours
  - Cost: ₹500 per person

#### Afternoon
• **Lunch at Café**
  - Traditional French lunch at Café de Flore
  - Duration: 1.5 hours
  - Cost: ₹2,000 per person

• **Louvre Museum**
  - Explore the Louvre, see Mona Lisa and masterpieces
  - Duration: 3 hours
  - Cost: ₹2,000 per person

#### Evening
• **Montmartre Visit**
  - Visit charming Montmartre streets
  - Duration: 2 hours
  - Cost: Free

• **Sacré-Cœur Basilica**
  - Visit the beautiful basilica
  - Duration: 1 hour
  - Cost: Free

• **Dinner and Music**
  - Dinner at local bistro with live music
  - Duration: 1 hour
  - Cost: ₹3,000 per person`;

  log("\n📤 Input:", colors.cyan);
  log(`User: ${userMessage}`);
  log(`\nAssistant response (showing multiple activities per time period):`);
  log(assistantResponse.substring(0, 500) + "...");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `${AGENT_PROMPTS.EXTRACTOR_AGENT}

OLD CONTEXT:
${JSON.stringify(oldContext, null, 2)}`,
      },
      { role: "user", content: userMessage },
      { role: "assistant", content: assistantResponse },
    ],
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(response.choices[0].message.content);

  log("\n📥 Extracted Result:", colors.cyan);

  // Check itinerary structure
  log("\nItinerary check:");
  log(`- result.itinerary exists: ${!!result.itinerary}`);
  if (result.itinerary) {
    log(`- result.itinerary.days exists: ${!!result.itinerary.days}`);
    if (result.itinerary.days) {
      log(`- result.itinerary.days length: ${result.itinerary.days.length}`);
      if (result.itinerary.days[0]) {
        log(`- Day 0 exists: ${!!result.itinerary.days[0]}`);
        log(`- Day 0 contents:`, JSON.stringify(result.itinerary.days[0], null, 2).substring(0, 500));
        log(`- Day 0 segments exists: ${!!result.itinerary.days[0].segments}`);

        if (result.itinerary.days[0].segments) {
          log("\nDay 1 segments:");
          log(JSON.stringify(result.itinerary.days[0].segments, null, 2));
        } else {
          log("\n⚠️ WARNING: segments property is missing from day[0]", colors.yellow);
        }
      }
    }
  }

  // Validate consolidation
  log("\n🧪 Validation:", colors.yellow);
  let allPassed = true;

  if (result.itinerary && result.itinerary.days && result.itinerary.days[0] && result.itinerary.days[0].segments) {
    const segments = result.itinerary.days[0].segments;

    // Check morning
    if (segments.morning && segments.morning.length === 1) {
      log(`✅ PASS: Morning has exactly 1 object (consolidated)`, colors.green);
      log(`   Place: "${segments.morning[0].place}"`, colors.cyan);
    } else {
      log(`❌ FAIL: Morning has ${segments.morning?.length || 0} objects (expected: 1)`, colors.red);
      allPassed = false;
    }

    // Check afternoon
    if (segments.afternoon && segments.afternoon.length === 1) {
      log(`✅ PASS: Afternoon has exactly 1 object (consolidated)`, colors.green);
      log(`   Place: "${segments.afternoon[0].place}"`, colors.cyan);
    } else {
      log(`❌ FAIL: Afternoon has ${segments.afternoon?.length || 0} objects (expected: 1)`, colors.red);
      allPassed = false;
    }

    // Check evening
    if (segments.evening && segments.evening.length === 1) {
      log(`✅ PASS: Evening has exactly 1 object (consolidated)`, colors.green);
      log(`   Place: "${segments.evening[0].place}"`, colors.cyan);
    } else {
      log(`❌ FAIL: Evening has ${segments.evening?.length || 0} objects (expected: 1)`, colors.red);
      allPassed = false;
    }
  } else {
    log(`❌ FAIL: No itinerary structure found`, colors.red);
    allPassed = false;
  }

  return { result, allPassed };
}

// Test 4: tripType field validation
async function testTripTypeField() {
  log("\n" + "=".repeat(80), colors.bright);
  log("TEST 4: tripType Field (renamed from tripTypes)", colors.bright);
  log("=".repeat(80), colors.bright);

  const oldContext = {
    summary: {
      origin: null,
      destination: null,
      outbound_date: null,
      return_date: null,
      duration_days: null,
      pax: null,
      budget: { amount: null, currency: "INR", per_person: true, total: null },
      tripType: [],
      placesOfInterest: [],
      upcomingEvents: [],
      suggestedQuestions: [],
    },
    itinerary: null,
  };

  const userMessage = "I want to go to Goa for a beach vacation";
  const assistantResponse = "Sounds great! Goa is perfect for a beach vacation. How many days and people?";

  log("\n📤 Input:", colors.cyan);
  log(`User: ${userMessage}`);
  log(`Assistant: ${assistantResponse}`);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `${AGENT_PROMPTS.EXTRACTOR_AGENT}

OLD CONTEXT:
${JSON.stringify(oldContext, null, 2)}`,
      },
      { role: "user", content: userMessage },
      { role: "assistant", content: assistantResponse },
    ],
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(response.choices[0].message.content);

  log("\n📥 Extracted Context:", colors.cyan);
  log(JSON.stringify(result.summary, null, 2));

  // Validate tripType
  log("\n🧪 Validation:", colors.yellow);
  let allPassed = true;

  if (result.summary.tripType !== undefined) {
    log(`✅ PASS: tripType field exists`, colors.green);
    log(`   Value: ${JSON.stringify(result.summary.tripType)}`, colors.cyan);
  } else {
    log(`❌ FAIL: tripType field missing`, colors.red);
    allPassed = false;
  }

  if (result.summary.tripTypes !== undefined) {
    log(`❌ FAIL: Old tripTypes field still exists (should be tripType)`, colors.red);
    allPassed = false;
  } else {
    log(`✅ PASS: Old tripTypes field not present`, colors.green);
  }

  if (result.summary.tripType && result.summary.tripType.includes("beach")) {
    log(`✅ PASS: tripType correctly inferred "beach" from Goa destination`, colors.green);
  } else {
    log(`⚠️  WARNING: tripType should include "beach" for Goa`, colors.yellow);
  }

  return { result, allPassed };
}

// Run all tests
async function runAllTests() {
  log("\n" + "=".repeat(80), colors.bright);
  log("PROMPT UPDATES TEST SUITE", colors.bright);
  log("Testing: Budget.total, Itinerary Consolidation, tripType field", colors.bright);
  log("=".repeat(80) + "\n", colors.bright);

  try {
    // Test 1
    await testBudgetTotalPerPerson();

    // Test 2
    await testBudgetTotalTotal();

    // Test 3
    const test3Result = await testItineraryConsolidation();

    // Test 4
    const test4Result = await testTripTypeField();

    // Final summary
    log("\n" + "=".repeat(80), colors.bright);
    log("TEST SUMMARY", colors.bright);
    log("=".repeat(80), colors.bright);
    log("\n✅ All tests completed. Review results above.", colors.green);
    log("\nKey checks:", colors.cyan);
    log("1. budget.total calculation (per_person=true): Check TEST 1");
    log("2. budget.total calculation (per_person=false): Check TEST 2");
    log("3. Itinerary consolidation (1 object per time period): Check TEST 3");
    log("4. tripType field (not tripTypes): Check TEST 4");

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, colors.red);
    console.error(error);
  }
}

// Execute tests
runAllTests();
