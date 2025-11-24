import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

/**
 * Lightweight scripted harness for the Flight Specialist Agent.
 *
 * Each scenario below contains a list of prompts that will be sent to the
 * multi-agent system sequentially. The full conversation transcript plus
 * relevant context snapshots are persisted to data/flight-agent-scenario-logs.
 *
 * Run with: `node test-flight-agent-scenarios.js`
 * (or add an npm script if you prefer).
 */

const scenarios = [
 
  {
    name: 'seat_to_lap_and_back_multi_turn',
    description: 'User flips infant seating types across multiple turns; agent must rerun searches each time and not reuse stale results.',
    prompts: [
      'Looking for roundtrip flights from Delhi to Kochi on 2026-04-05 returning 2026-04-10 for 2 adults and 2 infants on seats.',
      'Change one infant to lap infant, keep one as seat infant. Show updated options.',
      'Actually make both infants lap infants (no seats).',
      'Now switch back: 1 lap infant and 1 seat infant again. Re-run and show new results.'
    ]
  },
  {
    name: 'add_remove_infant_after_results',
    description: 'User adds/removes infants after results; agent should revalidate ratios and rerun searches.',
    prompts: [
      'Search roundtrip economy flights from Bengaluru to Goa on 2026-05-12 returning 2026-05-16 for 1 adult and 1 lap infant.',
      'Add another seat infant—so 1 adult, 1 lap infant, 1 seat infant—show new options.',
      'Remove the lap infant; keep only 1 seat infant. Refresh results.'
    ]
  },
  {
    name: 'toggle_infant_types_with_child_present',
    description: 'Passenger mix includes a child; user toggles infant type; agent must maintain children ages and rerun.',
    prompts: [
      'Find roundtrip economy flights from Mumbai to Dubai on 2026-06-01 returning 2026-06-08 for 2 adults, 1 child age 5, and 1 lap infant.',
      'Make the infant a seat infant instead; keep the child the same. Show updated flights.',
      'Switch back to lap infant; keep everything else the same and rerun.'
    ]
  }
];

const LOG_DIR = path.join('data', 'flight-agent-scenario-logs');

const toOutputString = (finalOutput) => {
  if (!finalOutput) return '';
  if (Array.isArray(finalOutput)) {
    return finalOutput.map(String).join('\n');
  }
  return String(finalOutput);
};

const snapshotForLog = (context) => {
  if (!context) return null;
  const summary = context.summary || {};
  const flight = context.flight || {};

  return {
    summary: {
      origin: summary.origin,
      destination: summary.destination,
      outbound_date: summary.outbound_date,
      return_date: summary.return_date,
      pax: summary.pax
    },
    flight: {
      tripType: flight.tripType,
      cabinClass: flight.cabinClass,
      resolvedOrigin: flight.resolvedOrigin,
      resolvedDestination: flight.resolvedDestination,
      bookingStatus: flight.bookingStatus,
      searchResultsCount: Array.isArray(flight.searchResults) ? flight.searchResults.length : 0
    }
  };
};

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function runTurnWithRetry(userMessage, chatId, conversationHistory, expectedBehavior, attempt = 1, maxRetries = 1) {
  const startTime = Date.now();
  try {
    const result = await runMultiAgentSystem(userMessage, chatId, conversationHistory, false);
    return { result, duration: Date.now() - startTime };
  } catch (error) {
    const messageLower = (error.message || '').toLowerCase();
    const isRateLimit = messageLower.includes('rate limit') || messageLower.includes('tpm');

    if (isRateLimit && attempt <= maxRetries) {
      const waitMs = 60000;
      console.log(`\n⚠️ Rate limit hit on attempt ${attempt} for "${userMessage}". Waiting ${(waitMs / 1000).toFixed(0)}s then retrying...`);
      await sleep(waitMs);
      return runTurnWithRetry(userMessage, chatId, conversationHistory, expectedBehavior, attempt + 1, maxRetries);
    }

    throw error;
  }
}

async function runScenario(scenario, index) {
  const chatId = `flight-scenario-${Date.now()}-${index}`;
  const conversationHistory = [];
  const steps = [];
  let success = true;
  let lastContext = null;

  console.log(`\n=== Scenario ${index + 1}: ${scenario.name} ===`);
  console.log(`${scenario.description}\n`);

  for (let turn = 0; turn < scenario.prompts.length; turn++) {
    const userMessage = scenario.prompts[turn];
    conversationHistory.push({ role: 'user', content: userMessage });

    try {
      const { result, duration } = await runTurnWithRetry(
        userMessage,
        chatId,
        conversationHistory,
        scenario.description
      );

      const assistantOutput = toOutputString(result.finalOutput);

      console.log(`Turn ${turn + 1} user prompt:\n${userMessage}\n`);
      console.log(`Agent (${result.lastAgent}) response (took ${(duration / 1000).toFixed(2)}s):\n${assistantOutput}\n`);

      conversationHistory.push({ role: 'assistant', content: assistantOutput });

      steps.push({
        turn: turn + 1,
        user: userMessage,
        agent: assistantOutput,
        lastAgent: result.lastAgent,
        duration_ms: duration,
        context: snapshotForLog(result.context)
      });

      lastContext = result.context;
    } catch (error) {
      console.error(`Scenario ${scenario.name} turn ${turn + 1} failed: ${error.message}`);
      steps.push({
        turn: turn + 1,
        user: userMessage,
        error: error.message,
        stack: error.stack
      });
      success = false;
      break;
    }
  }

  return {
    name: scenario.name,
    description: scenario.description,
    success,
    chatId,
    steps,
    finalContext: snapshotForLog(lastContext)
  };
}

async function runAllScenarios() {
  await fs.mkdir(LOG_DIR, { recursive: true });
  const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const scenarioResults = [];

  for (let i = 0; i < scenarios.length; i++) {
    const result = await runScenario(scenarios[i], i);
    scenarioResults.push(result);
  }

  const logPayload = {
    runTimestamp,
    scenarioCount: scenarios.length,
    scenarios: scenarioResults
  };

  const logFile = path.join(LOG_DIR, `flight-agent-scenarios-${runTimestamp}.json`);
  await fs.writeFile(logFile, JSON.stringify(logPayload, null, 2), 'utf-8');

  console.log('\n============================================');
  console.log('Flight agent scenario run complete.');
  console.log(`Logs saved to: ${logFile}`);
  console.log('============================================\n');
}

runAllScenarios().catch((error) => {
  console.error('Scenario runner failed:', error);
  process.exit(1);
});
