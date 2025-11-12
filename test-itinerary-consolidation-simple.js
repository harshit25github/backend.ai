/**
 * Simple test for itinerary consolidation
 */

import OpenAI from "openai";
import { AGENT_PROMPTS } from "./src/ai/prompts.js";
import fs from "fs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testItineraryConsolidation() {
  console.log("Testing itinerary consolidation...\n");

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

  console.log("Sending to extractor...");

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

  // Save full result to file
  fs.writeFileSync(
    "test-itinerary-result.json",
    JSON.stringify(result, null, 2)
  );

  console.log("\n✅ Result saved to test-itinerary-result.json\n");

  // Check structure
  if (result.itinerary && result.itinerary.days && result.itinerary.days[0]) {
    const day = result.itinerary.days[0];
    console.log("Day structure:");
    console.log(JSON.stringify(day, null, 2));

    if (day.segments) {
      console.log("\n✅ Segments found!");
      console.log("\nMorning:", day.segments.morning?.length, "objects");
      console.log("Afternoon:", day.segments.afternoon?.length, "objects");
      console.log("Evening:", day.segments.evening?.length, "objects");

      if (
        day.segments.morning?.length === 1 &&
        day.segments.afternoon?.length === 1 &&
        day.segments.evening?.length === 1
      ) {
        console.log("\n✅ PASS: Each time period has exactly 1 consolidated object");
        console.log("\nMorning place:", day.segments.morning[0].place);
        console.log("Afternoon place:", day.segments.afternoon[0].place);
        console.log("Evening place:", day.segments.evening[0].place);
      } else {
        console.log("\n❌ FAIL: Time periods do not have exactly 1 object each");
      }
    } else {
      console.log("\n❌ FAIL: No segments property in day");
      console.log("Available properties:", Object.keys(day));
    }
  } else {
    console.log("\n❌ FAIL: No itinerary structure found");
  }
}

testItineraryConsolidation().catch(console.error);
