import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

/**
 * Lightweight scripted harness for the Trip Planner Agent.
 *
 * Each scenario contains a list of user prompts that will be sent sequentially.
 * The conversation transcript plus context snapshots are persisted to data/trip-planner-scenario-logs.
 *
 * Run with: `node test-trip-planner-scenarios.js`
 */

const scenarios = [

  {
    name: 'fictional_world_cup_alert',
    description: 'Fictional multi-country event; agent should search, flag no such event, and pivot to realistic options instead of inventing.',
    prompts: [
      'Plan a trip for the World Cup in Argentina and Spain this July.',
      '2 adults from Boston, 7 days, budget 4000 USD total.'
    ]
  },
  {
    name: 'nonexistent_place_guardrail',
    description: 'User picks a place that does not exist; agent should search, say not found, and suggest real alternatives.',
    prompts: [
      'Create a 5-day trip to Wakandaville in Europe for 2 adults from New York, budget 2200 USD total, leaving August 5 2026.'
    ]
  },
  {
    name: 'ambiguous_city_disambiguation',
    description: 'Ambiguous destination requires disambiguation before planning; agent should search/clarify.',
    prompts: [
      'Plan a 4-day summer trip to Cordoba from Miami, budget 1500 USD per person, outbound July 12 2026.'
    ]
  },
  {
    name: 'real_event_validation',
    description: 'Real event should be verified via search and used to anchor itinerary without hallucination.',
    prompts: [
      'Plan around Taylor Swift concert in Singapore in March 2026 for 2 adults from Los Angeles, 5 days, budget 3000 USD total.'
    ]
  },
  {
    name: 'vague_attraction_low_confidence',
    description: 'User cites a vague new attraction; agent should search, flag uncertainty, and handle gracefully.',
    prompts: [
      'Visit the new glass bridge in Iceland, 4-day trip from London in late September, 2 adults, budget 1800 GBP total.'
    ]
  }
];

const LOG_DIR = path.join('data', 'trip-planner-scenario-logs');

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
  return {
    origin: summary.origin,
    destination: summary.destination,
    outbound_date: summary.outbound_date,
    return_date: summary.return_date,
    duration_days: summary.duration_days,
    pax: summary.pax,
    budget: summary.budget
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
      console.log(`\n⏳ Rate limit hit on attempt ${attempt} for "${userMessage}". Waiting ${(waitMs / 1000).toFixed(0)}s then retrying...`);
      await sleep(waitMs);
      return runTurnWithRetry(userMessage, chatId, conversationHistory, expectedBehavior, attempt + 1, maxRetries);
    }

    throw error;
  }
}

async function runScenario(scenario, index) {
  const chatId = `trip-scenario-${Date.now()}-${index}`;
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

  const logFile = path.join(LOG_DIR, `trip-planner-scenarios-${runTimestamp}.json`);
  await fs.writeFile(logFile, JSON.stringify(logPayload, null, 2), 'utf-8');

  console.log('\n============================================');
  console.log('Trip planner scenario run complete.');
  console.log(`Logs saved to: ${logFile}`);
  console.log('============================================\n');
}

runAllScenarios().catch((error) => {
  console.error('Scenario runner failed:', error);
  process.exit(1);
});
