/**
 * Test Travel Date as Mandatory Field
 * Verify that agent asks for travel date (outbound_date) when missing
 */

import OpenAI from "openai";
import { AGENT_PROMPTS } from "./src/ai/prompts.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testTravelDateMandatory() {
  log("\n" + "=".repeat(80), colors.bright);
  log("TEST: Travel Date as Mandatory Field", colors.bright);
  log("=".repeat(80) + "\n", colors.bright);

  // Scenario: User provides all info EXCEPT travel date
  const userMessage = "Plan a 5-day trip to Paris from Delhi for 2 people with 1 lakh per person budget";

  log("📤 User Message:", colors.cyan);
  log(userMessage + "\n");

  log("Expected behavior:", colors.yellow);
  log("- ✅ Should extract: origin, destination, duration, pax, budget");
  log("- ❌ Should identify missing: outbound_date (travel date)");
  log("- ✅ Should ask for travel date before creating itinerary\n");

  log("🤖 Calling TRIP_PLANNER agent...\n", colors.yellow);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: AGENT_PROMPTS.TRIP_PLANNER,
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
    temperature: 0.7,
  });

  const agentResponse = response.choices[0].message.content;

  log("📥 Agent Response:", colors.cyan);
  log("-".repeat(80));
  log(agentResponse.substring(0, 800) + "...");
  log("-".repeat(80) + "\n");

  // Validation
  log("🧪 Validation Checks:", colors.yellow);
  log("-".repeat(80));

  const lowerResponse = agentResponse.toLowerCase();

  // Check 1: Should ask for travel date
  const asksForDate =
    lowerResponse.includes("when") ||
    lowerResponse.includes("travel date") ||
    lowerResponse.includes("departure date") ||
    lowerResponse.includes("planning to travel");

  if (asksForDate) {
    log("✅ PASS: Asked for travel date (correct - missing field)", colors.green);
  } else {
    log("❌ FAIL: Did NOT ask for travel date (should ask)", colors.red);
  }

  // Check 2: Should NOT create itinerary yet (missing date)
  const createdItinerary =
    /day\s*1/i.test(agentResponse) &&
    /day\s*2/i.test(agentResponse) &&
    /day\s*3/i.test(agentResponse);

  if (!createdItinerary) {
    log("✅ PASS: Did NOT create itinerary (correct - missing travel date)", colors.green);
  } else {
    log("❌ FAIL: Created itinerary without travel date (should wait)", colors.red);
  }

  // Check 3: Should NOT ask for other fields (already provided)
  const asksForOtherFields =
    lowerResponse.includes("how many days") ||
    lowerResponse.includes("how many people") ||
    lowerResponse.includes("which city") ||
    (lowerResponse.includes("budget") && lowerResponse.includes("?"));

  if (!asksForOtherFields) {
    log("✅ PASS: Did NOT re-ask for already provided fields", colors.green);
  } else {
    log("⚠️  WARNING: Re-asked for fields user already provided", colors.yellow);
  }

  // Final summary
  log("\n" + "=".repeat(80), colors.bright);
  log("SUMMARY", colors.bright);
  log("=".repeat(80), colors.bright);

  if (asksForDate && !createdItinerary) {
    log("\n✅ TRAVEL DATE IS NOW MANDATORY!", colors.green);
    log("Agent correctly asks for travel date before creating itinerary.", colors.green);
  } else {
    log("\n❌ ISSUE DETECTED", colors.red);
    log("Review the validation results above.", colors.yellow);
  }

  return { asksForDate, createdItinerary, asksForOtherFields };
}

testTravelDateMandatory().catch(console.error);
