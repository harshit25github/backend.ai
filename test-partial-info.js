/**
 * Test Partial Information Extraction
 * Verify that agent doesn't re-ask for already provided fields
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

async function testPartialInfoExtraction() {
  log("\n" + "=".repeat(80), colors.bright);
  log("TEST: Partial Info Extraction - Don't Re-ask for Provided Fields", colors.bright);
  log("=".repeat(80) + "\n", colors.bright);

  // Scenario: User provides origin and destination, but missing duration, pax, budget
  const userMessage = "Plan a trip to Paris from Delhi";

  log("📤 User Message:", colors.cyan);
  log(userMessage + "\n");

  log("Expected behavior:", colors.yellow);
  log("- ✅ Should extract: origin=Delhi, destination=Paris");
  log("- ✅ Should identify missing: duration, pax, budget");
  log("- ✅ Should only ask for the 3 missing fields");
  log("- ❌ Should NOT re-ask for origin or destination\n");

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
  log(agentResponse);
  log("-".repeat(80) + "\n");

  // Validation
  log("🧪 Validation Checks:", colors.yellow);
  log("-".repeat(80));

  const lowerResponse = agentResponse.toLowerCase();

  // Check 1: Should NOT ask for origin
  const asksForOrigin =
    lowerResponse.includes("where are you traveling from") ||
    lowerResponse.includes("which city are you traveling from") ||
    lowerResponse.includes("your departure city");

  if (!asksForOrigin) {
    log("✅ PASS: Did NOT re-ask for origin (correct - user said Delhi)", colors.green);
  } else {
    log("❌ FAIL: Re-asked for origin (user already said Delhi)", colors.red);
  }

  // Check 2: Should NOT ask for destination
  const asksForDestination =
    lowerResponse.includes("where would you like to go") ||
    lowerResponse.includes("which destination") ||
    (lowerResponse.includes("where") && lowerResponse.includes("go"));

  if (!asksForDestination) {
    log("✅ PASS: Did NOT re-ask for destination (correct - user said Paris)", colors.green);
  } else {
    log("❌ FAIL: Re-asked for destination (user already said Paris)", colors.red);
  }

  // Check 3: Should ask for duration
  const asksForDuration =
    lowerResponse.includes("how many days") ||
    lowerResponse.includes("duration");

  if (asksForDuration) {
    log("✅ PASS: Asked for duration (correct - missing field)", colors.green);
  } else {
    log("❌ FAIL: Didn't ask for duration (should ask)", colors.red);
  }

  // Check 4: Should ask for pax
  const asksForPax =
    lowerResponse.includes("how many people") ||
    lowerResponse.includes("number of travelers") ||
    lowerResponse.includes("travelers");

  if (asksForPax) {
    log("✅ PASS: Asked for pax (correct - missing field)", colors.green);
  } else {
    log("❌ FAIL: Didn't ask for pax (should ask)", colors.red);
  }

  // Check 5: Should ask for budget
  const asksForBudget =
    lowerResponse.includes("budget") &&
    (lowerResponse.includes("?") || lowerResponse.includes("per person"));

  if (asksForBudget) {
    log("✅ PASS: Asked for budget (correct - missing field)", colors.green);
  } else {
    log("❌ FAIL: Didn't ask for budget (should ask)", colors.red);
  }

  // Check 6: Should acknowledge what was provided
  const acknowledgesProvided =
    (lowerResponse.includes("paris") && lowerResponse.includes("delhi")) ||
    lowerResponse.includes("paris from delhi") ||
    lowerResponse.includes("delhi to paris");

  if (acknowledgesProvided) {
    log("✅ PASS: Acknowledged provided info (good UX)", colors.green);
  } else {
    log("⚠️  WARNING: Didn't acknowledge Paris/Delhi (could be better)", colors.yellow);
  }

  // Final summary
  log("\n" + "=".repeat(80), colors.bright);
  log("SUMMARY", colors.bright);
  log("=".repeat(80), colors.bright);

  const allPass =
    !asksForOrigin &&
    !asksForDestination &&
    asksForDuration &&
    asksForPax &&
    asksForBudget;

  if (allPass) {
    log("\n✅ ALL CRITICAL CHECKS PASSED!", colors.green);
    log("Agent correctly extracted partial info and only asked for missing fields.", colors.green);
  } else {
    log("\n❌ SOME CHECKS FAILED", colors.red);
    log("Review the validation results above.", colors.yellow);
  }

  return {
    asksForOrigin,
    asksForDestination,
    asksForDuration,
    asksForPax,
    asksForBudget,
    acknowledgesProvided,
  };
}

testPartialInfoExtraction().catch(console.error);
