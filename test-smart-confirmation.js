/**
 * Test Smart Confirmation Logic
 * Tests both direct creation and gradual confirmation scenarios
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

// Scenario 1: Direct creation (user says "Plan" with all info)
async function testDirectCreation() {
  log("\n" + "=".repeat(80), colors.bright);
  log("SCENARIO 1: Direct Creation (User says 'Plan' with all info)", colors.bright);
  log("=".repeat(80) + "\n", colors.bright);

  const messages = [
    { role: "system", content: AGENT_PROMPTS.TRIP_PLANNER },
    { role: "user", content: "Plan a 3-day trip to Goa from Mumbai for 2 people with 40k total budget" }
  ];

  log("📤 User: " + messages[1].content, colors.cyan);
  log("\n🤖 Agent thinking...\n", colors.yellow);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 0.7,
  });

  const agentResponse = response.choices[0].message.content;
  const preview = agentResponse.substring(0, 800);
  log("📥 Agent Response (first 800 chars):", colors.cyan);
  log(preview + "...\n");

  // Validation
  log("🧪 Validation:", colors.yellow);
  const lowerResponse = agentResponse.toLowerCase();

  // Check for confirmation QUESTIONS (not statements)
  const hasConfirmationQuestion =
    lowerResponse.includes("should i create") ||
    lowerResponse.includes("ready for me to create") ||
    lowerResponse.includes("can i create") ||
    lowerResponse.includes("ready to proceed") ||
    (lowerResponse.includes("ready") && lowerResponse.includes("?")) ||
    (lowerResponse.includes("should") && lowerResponse.includes("?"));

  const hasItinerary =
    /day\s*1/i.test(agentResponse) &&
    /day\s*2/i.test(agentResponse) &&
    /day\s*3/i.test(agentResponse);

  if (!hasConfirmationQuestion) {
    log("✅ PASS: No confirmation asked (correct - user said 'Plan')", colors.green);
  } else {
    log("❌ FAIL: Asked for confirmation (shouldn't - user said 'Plan')", colors.red);
  }

  if (hasItinerary) {
    log("✅ PASS: Itinerary created immediately", colors.green);
  } else {
    log("❌ FAIL: Itinerary not created", colors.red);
  }

  return { hasConfirmationQuestion, hasItinerary };
}

// Scenario 2: Gradual gathering with confirmation
async function testGradualWithConfirmation() {
  log("\n" + "=".repeat(80), colors.bright);
  log("SCENARIO 2: Gradual Info Gathering (Should ask confirmation ONCE)", colors.bright);
  log("=".repeat(80) + "\n", colors.bright);

  const messages = [
    { role: "system", content: AGENT_PROMPTS.TRIP_PLANNER },
    { role: "user", content: "I want to go to Bali" },
  ];

  log("📤 Turn 1 - User: " + messages[1].content, colors.cyan);

  // Turn 1
  let response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 0.7,
  });

  let agentResponse = response.choices[0].message.content;
  log("📥 Agent: " + agentResponse.substring(0, 200) + "...\n", colors.cyan);
  messages.push({ role: "assistant", content: agentResponse });

  // Turn 2: User provides all info
  const userTurn2 = "From Delhi, 5 days, 2 people, 80k per person";
  messages.push({ role: "user", content: userTurn2 });
  log("📤 Turn 2 - User: " + userTurn2, colors.cyan);

  response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 0.7,
  });

  agentResponse = response.choices[0].message.content;
  log("📥 Agent: " + agentResponse.substring(0, 400) + "...\n", colors.cyan);
  messages.push({ role: "assistant", content: agentResponse });

  // Check if confirmation asked
  const lowerResponse2 = agentResponse.toLowerCase();
  const askedConfirmation =
    lowerResponse2.includes("ready for me to create") ||
    lowerResponse2.includes("should i create") ||
    lowerResponse2.includes("can i create");

  log("🧪 Validation - Turn 2:", colors.yellow);
  if (askedConfirmation) {
    log("✅ PASS: Asked for confirmation (correct - gradual gathering)", colors.green);
  } else {
    log("⚠️  WARNING: Didn't ask for confirmation (expected in gradual flow)", colors.yellow);
  }

  // Turn 3: User confirms
  if (askedConfirmation) {
    const userTurn3 = "Yes, create it";
    messages.push({ role: "user", content: userTurn3 });
    log("📤 Turn 3 - User: " + userTurn3, colors.cyan);

    response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
    });

    agentResponse = response.choices[0].message.content;
    log("📥 Agent: " + agentResponse.substring(0, 500) + "...\n", colors.cyan);

    // Check if itinerary created without re-asking
    const lowerResponse3 = agentResponse.toLowerCase();
    const askedAgain =
      lowerResponse3.includes("ready for me to create") ||
      lowerResponse3.includes("should i create") ||
      lowerResponse3.includes("let me confirm");

    const hasItinerary =
      /day\s*1/i.test(agentResponse) &&
      /day\s*2/i.test(agentResponse);

    log("🧪 Validation - Turn 3:", colors.yellow);
    if (!askedAgain) {
      log("✅ PASS: Didn't ask for confirmation again (correct)", colors.green);
    } else {
      log("❌ FAIL: Asked for confirmation AGAIN (should not)", colors.red);
    }

    if (hasItinerary) {
      log("✅ PASS: Created itinerary immediately after user confirmed", colors.green);
    } else {
      log("❌ FAIL: Itinerary not created after confirmation", colors.red);
    }

    return { askedConfirmation, askedAgain, hasItinerary };
  }

  return { askedConfirmation, askedAgain: false, hasItinerary: false };
}

// Run all tests
async function runAllTests() {
  log("\n" + "=".repeat(80), colors.bright);
  log("SMART CONFIRMATION LOGIC TEST SUITE", colors.bright);
  log("=".repeat(80), colors.bright);

  try {
    const result1 = await testDirectCreation();
    const result2 = await testGradualWithConfirmation();

    log("\n" + "=".repeat(80), colors.bright);
    log("FINAL SUMMARY", colors.bright);
    log("=".repeat(80), colors.bright);

    log("\nScenario 1 (Direct 'Plan' with all info):", colors.cyan);
    log(`  No confirmation asked: ${!result1.hasConfirmationQuestion ? "✅" : "❌"}`);
    log(`  Itinerary created: ${result1.hasItinerary ? "✅" : "❌"}`);

    log("\nScenario 2 (Gradual gathering):", colors.cyan);
    log(`  Asked confirmation once: ${result2.askedConfirmation ? "✅" : "⚠️"}`);
    log(`  Didn't ask again: ${!result2.askedAgain ? "✅" : "❌"}`);
    log(`  Created after confirmation: ${result2.hasItinerary ? "✅" : "❌"}`);

    const allPass =
      !result1.hasConfirmationQuestion &&
      result1.hasItinerary &&
      !result2.askedAgain;

    if (allPass) {
      log("\n✅ SMART CONFIRMATION LOGIC WORKING CORRECTLY!", colors.green);
    } else {
      log("\n⚠️  Some tests need attention", colors.yellow);
    }

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, colors.red);
    console.error(error);
  }
}

runAllTests();
