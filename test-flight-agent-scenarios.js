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
    name: 'under2_combined_limit',
    description: 'One adult tries to bring three under-2s (mix lap + seat); tool should block with combined under-2 rule.',
    prompts: [
      'Book flights from Delhi to London on May 10 returning May 20 for 1 adult, 1 lap infant, and 2 seat infants.'
    ]
  },
  {
    name: 'filter_change_rerun',
    description: 'User asks for preferred airline after results; agent must rerun search with new airline filter.',
    prompts: [
      'Find roundtrip economy flights from Delhi to Mumbai on 2026-01-20 returning 2026-01-25 for 2 adults.',
      'Show only Vistara flights.'
    ]
  },
  {
    name: 'happy_path_full_results',
    description: 'User supplies all fields up front (route, dates inside 12 months, pax breakdown, cabin, IATAs) so the agent should return flight options in one go.',
    prompts: [
      'Find direct roundtrip economy flights from Delhi (DEL) to Mumbai (BOM), departing 2026-02-15 and returning 2026-02-20 for 2 adults, 1 child age 8, and 1 lap infant. Prefer Air India or Vistara.'
    ]
  },
  {
    name: 'infant_type_change_requires_rerun',
    description: 'After initial results for 2 adults + 1 seat infant + 1 lap infant, user asks to make both infants lap; agent should rerun search with updated pax.',
    prompts: [
      'Find roundtrip economy flights from Delhi to Mumbai on 2026-03-10 returning 2026-03-15 for 2 adults, 1 seat infant, and 1 lap infant.',
      'Make both infants lap infants only and show updated options.'
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
