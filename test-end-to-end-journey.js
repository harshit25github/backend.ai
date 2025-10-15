import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log("🌟 END-TO-END USER JOURNEY TEST\n");
console.log("=" .repeat(80));
console.log("Simulating: Summary Slots → Itinerary Generation → Flight Search");
console.log("All turns logged to data/ folder\n");
console.log("=" .repeat(80) + "\n");

const LOG_DIR = './data';
const chatId = `e2e-journey-${Date.now()}`;
const logFile = path.join(LOG_DIR, `${chatId}-conversation.json`);

let conversationLog = {
  chatId,
  startTime: new Date().toISOString(),
  turns: [],
  summary: "End-to-end test: Summary → Itinerary → Flights"
};

let conversationHistory = [];

async function saveTurnLog(turnNumber, userMessage, assistantResponse, context) {
  const turnLog = {
    turn: turnNumber,
    timestamp: new Date().toISOString(),
    user: {
      message: userMessage,
      role: 'user'
    },
    assistant: {
      message: assistantResponse,
      role: 'assistant',
      agent: context?.conversationState?.currentAgent || 'Unknown'
    },
    context: {
      summary: context?.summary || {},
      itinerary: context?.itinerary || {},
      flight: {
        tripType: context?.flight?.tripType,
        cabinClass: context?.flight?.cabinClass,
        bookingStatus: context?.flight?.bookingStatus,
        resolvedOrigin: context?.flight?.resolvedOrigin,
        resolvedDestination: context?.flight?.resolvedDestination,
        searchResultsCount: context?.flight?.searchResults?.length || 0
      },
      conversationState: context?.conversationState || {}
    }
  };

  conversationLog.turns.push(turnLog);

  // Save after each turn
  await fs.writeFile(
    logFile,
    JSON.stringify(conversationLog, null, 2),
    'utf-8'
  );

  console.log(`📝 Turn ${turnNumber} logged to: ${logFile}`);
}

async function sendMessage(turnNumber, message) {
  console.log("\n" + "=".repeat(80));
  console.log(`🔄 TURN ${turnNumber}`);
  console.log("=".repeat(80));
  console.log(`👤 User: "${message}"\n`);

  const startTime = Date.now();

  try {
    conversationHistory.push({ role: 'user', content: message });

    const result = await runMultiAgentSystem(
      message,
      chatId,
      conversationHistory,
      false
    );

    const duration = Date.now() - startTime;
    const output = Array.isArray(result.finalOutput)
      ? result.finalOutput.map(String).join('\n')
      : String(result.finalOutput ?? '');

    conversationHistory.push({ role: 'assistant', content: output });

    console.log(`🤖 Agent: ${result.lastAgent}`);
    console.log(`⏱️  Response Time: ${(duration / 1000).toFixed(2)}s`);
    console.log(`\n📄 Response (first 500 chars):`);
    console.log("-".repeat(80));
    console.log(output.substring(0, 500) + (output.length > 500 ? '...\n[truncated]' : ''));
    console.log("-".repeat(80));

    // Log context snapshot
    console.log(`\n📊 Context Snapshot:`);
    console.log(`  - Origin: ${result.context?.summary?.origin?.city || 'Not set'}`);
    console.log(`  - Destination: ${result.context?.summary?.destination?.city || 'Not set'}`);
    console.log(`  - Dates: ${result.context?.summary?.outbound_date || 'Not set'} to ${result.context?.summary?.return_date || 'Not set'}`);
    console.log(`  - Passengers: ${result.context?.summary?.pax || 'Not set'}`);
    console.log(`  - Itinerary Days: ${result.context?.itinerary?.days?.length || 0}`);
    console.log(`  - Flight Status: ${result.context?.flight?.bookingStatus || 'pending'}`);
    console.log(`  - Flight Results: ${result.context?.flight?.searchResults?.length || 0} options`);

    // Save turn log
    await saveTurnLog(turnNumber, message, output, result.context);

    return { success: true, result, output };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`\n❌ Error: ${error.message}`);
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);

    await saveTurnLog(turnNumber, message, `ERROR: ${error.message}`, {});

    if (error.message.includes('Rate limit')) {
      throw error; // Stop on rate limit
    }

    return { success: false, error: error.message };
  }
}

async function runEndToEndJourney() {
  console.log("🚀 Starting end-to-end journey test...\n");

  try {
    // PHASE 1: SUMMARY SLOT FILLING
    console.log("\n" + "🎯".repeat(40));
    console.log("PHASE 1: SUMMARY SLOT FILLING");
    console.log("🎯".repeat(40));

    await sendMessage(1, "I want to plan a trip to Goa");
    await new Promise(resolve => setTimeout(resolve, 2000));

    await sendMessage(2, "I'm traveling from Delhi");
    await new Promise(resolve => setTimeout(resolve, 2000));

    await sendMessage(3, "We'll be 2 people, traveling from December 15 to December 20");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // PHASE 2: ITINERARY GENERATION
    console.log("\n" + "🗺️".repeat(40));
    console.log("PHASE 2: ITINERARY GENERATION");
    console.log("🗺️".repeat(40));

    await sendMessage(4, "Can you create a 5-day itinerary for us? We like beaches, water sports, and local food");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // PHASE 3: FLIGHT SEARCH
    console.log("\n" + "✈️".repeat(40));
    console.log("PHASE 3: FLIGHT SEARCH");
    console.log("✈️".repeat(40));

    await sendMessage(5, "Great! Now find me flights for these dates in economy class");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // PHASE 4: FOLLOW-UP
    console.log("\n" + "💬".repeat(40));
    console.log("PHASE 4: FOLLOW-UP QUESTIONS");
    console.log("💬".repeat(40));

    await sendMessage(6, "What's the cheapest flight option?");

    // Final summary
    conversationLog.endTime = new Date().toISOString();
    conversationLog.totalTurns = conversationLog.turns.length;

    await fs.writeFile(
      logFile,
      JSON.stringify(conversationLog, null, 2),
      'utf-8'
    );

    console.log("\n" + "=".repeat(80));
    console.log("✅ END-TO-END JOURNEY TEST COMPLETE");
    console.log("=".repeat(80));
    console.log(`📁 Full conversation log saved to: ${logFile}`);
    console.log(`📊 Total turns: ${conversationLog.totalTurns}`);
    console.log(`⏱️  Total duration: ${conversationLog.turns.reduce((acc, t, i, arr) => {
      if (i > 0) {
        const prev = new Date(arr[i-1].timestamp);
        const curr = new Date(t.timestamp);
        return acc + (curr - prev);
      }
      return acc;
    }, 0) / 1000}s`);
    console.log("=".repeat(80));

  } catch (error) {
    console.error("\n❌ Journey test failed:", error.message);

    conversationLog.endTime = new Date().toISOString();
    conversationLog.error = error.message;

    await fs.writeFile(
      logFile,
      JSON.stringify(conversationLog, null, 2),
      'utf-8'
    );

    throw error;
  }
}

runEndToEndJourney().then(() => {
  console.log("\n✅ Test execution complete\n");
  process.exit(0);
}).catch(error => {
  console.error("\n❌ Test failed:", error.message);
  process.exit(1);
});
