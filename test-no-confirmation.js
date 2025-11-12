/**
 * Test to verify TRIP_PLANNER doesn't ask for confirmation
 * when all 5 fields are provided
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

async function testNoConfirmation() {
  log("\n" + "=".repeat(80), colors.bright);
  log("TEST: No Confirmation Loop - Direct Itinerary Creation", colors.bright);
  log("=".repeat(80) + "\n", colors.bright);

  // Scenario: User provides ALL 5 fields upfront
  const userMessage = "Plan a 3-day trip to Goa from Mumbai for 2 people with 40k total budget";

  log("📤 User Message:", colors.cyan);
  log(userMessage + "\n");

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

  // Show first 1000 chars to check if itinerary was created
  const preview = agentResponse.substring(0, 1000);
  log(preview + "...\n");

  // Validation checks
  log("🧪 Validation Checks:", colors.yellow);
  log("-".repeat(80));

  const lowerResponse = agentResponse.toLowerCase();

  // Check 1: Should NOT ask for confirmation
  const confirmationPhrases = [
    "should i create",
    "can i create",
    "ready to proceed",
    "shall i proceed",
    "would you like me to create",
    "do you want me to create",
    "may i create",
  ];

  let hasConfirmationQuestion = false;
  for (const phrase of confirmationPhrases) {
    if (lowerResponse.includes(phrase)) {
      hasConfirmationQuestion = true;
      log(`❌ FAIL: Found confirmation phrase: "${phrase}"`, colors.red);
      break;
    }
  }

  if (!hasConfirmationQuestion) {
    log(`✅ PASS: No confirmation question found`, colors.green);
  }

  // Check 2: Should have Day 1, Day 2, Day 3 in response (itinerary created)
  const hasDay1 = /day\s*1/i.test(agentResponse);
  const hasDay2 = /day\s*2/i.test(agentResponse);
  const hasDay3 = /day\s*3/i.test(agentResponse);

  if (hasDay1 && hasDay2 && hasDay3) {
    log(`✅ PASS: Itinerary created immediately (has Day 1, 2, 3)`, colors.green);
  } else {
    log(`❌ FAIL: Itinerary not created (missing days)`, colors.red);
    log(`   Day 1: ${hasDay1}, Day 2: ${hasDay2}, Day 3: ${hasDay3}`, colors.yellow);
  }

  // Check 3: Should have itinerary structure markers
  const hasItineraryMarkers =
    (lowerResponse.includes("morning") ||
     lowerResponse.includes("afternoon") ||
     lowerResponse.includes("evening")) &&
    (lowerResponse.includes("duration") ||
     lowerResponse.includes("cost"));

  if (hasItineraryMarkers) {
    log(`✅ PASS: Has itinerary structure (time periods, duration/cost)`, colors.green);
  } else {
    log(`❌ FAIL: Missing itinerary structure details`, colors.red);
  }

  // Final summary
  log("\n" + "=".repeat(80), colors.bright);
  log("SUMMARY", colors.bright);
  log("=".repeat(80), colors.bright);

  if (!hasConfirmationQuestion && hasDay1 && hasDay2 && hasDay3 && hasItineraryMarkers) {
    log("\n✅ ALL CHECKS PASSED: Agent created itinerary immediately without asking for confirmation!", colors.green);
  } else {
    log("\n❌ SOME CHECKS FAILED: Review issues above", colors.red);
  }

  log("\nFull response length:", agentResponse.length, "characters");
}

testNoConfirmation().catch(console.error);
