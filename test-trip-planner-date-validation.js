import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

/**
 * Trip Planner date-validation harness.
 * Focus: ensure `validate_trip_date` is being called when dates are provided/changed.
 *
 * Run with: `node test-trip-planner-date-validation.js`
 */

const today = new Date();
const fmt = (d) => d.toISOString().slice(0, 10);
const addDays = (offset) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return fmt(d);
};

const future30 = addDays(30);
const future60 = addDays(60);
const future90 = addDays(90);
const future150 = addDays(150);
const future300 = addDays(300);
const future400 = addDays(400); // intentionally beyond 359 for negative case
const yesterday = addDays(-1);

const scenarios = [
  {
    name: 'past_date_rejected',
    description: 'Explicit past date should trigger validation feedback and not proceed.',
    prompts: [
      `Plan a 4-day trip to Paris from Delhi on ${yesterday} for 2 adults, budget 1200 USD total.`,
      'Please proceed with that date.'
    ]
  },
  {
    name: 'beyond_window_rejected',
    description: 'Date beyond 359 days should trigger window feedback.',
    prompts: [
      `Plan a 5-day trip to Bali from Mumbai on ${future400} for 2 adults, budget 1500 USD total.`
    ]
  },
  {
    name: 'ambiguous_month_day_confirm',
    description: 'Vague month/day should be converted, validated, and confirmed.',
    prompts: [
      'Plan a 3-day trip to Tokyo from San Francisco for 2 adults, budget 900 USD per person, travel on 15 Dec.'
    ]
  },
  {
    name: 'tomorrow_resolution',
    description: 'Relative term "tomorrow" should resolve via validator before proceeding.',
    prompts: [
      'Plan a 2-day getaway to Goa from Bengaluru tomorrow for 2 adults, budget 400 USD total.'
    ]
  },
  {
    name: 'vague_window_then_exact',
    description: 'Starts with vague window, then user provides an exact date; both should validate.',
    prompts: [
      'Plan a 6-day trip to Barcelona from Berlin in late December for 3 adults, budget 2400 EUR total.',
      `Lock the outbound date to ${future60}.`
    ]
  },
  {
    name: 'mid_month_to_specific_change',
    description: 'User first gives mid-month, then refines to a specific date; validator should run each time.',
    prompts: [
      'Plan a 4-day trip to Singapore from Delhi around mid February, 2 adults, budget 800 USD per person.',
      `Actually make the outbound ${future90}.`
    ]
  },
  {
    name: 'no_date_until_late_turn',
    description: 'Agent should wait for date, then validate when user finally supplies it.',
    prompts: [
      'Plan a 5-day trip to Dubai from London for 2 adults, budget 2000 GBP total.',
      `Outbound will be ${future150}.`
    ]
  },
  {
    name: 'date_change_after_plan',
    description: 'After itinerary is ready, user changes date; validator should run again.',
    prompts: [
      `Plan a 3-day trip to Rome from New York on ${future30} for 2 adults, budget 1000 USD per person.`,
      `Change the outbound to ${future60}.`
    ]
  },
  {
    name: 'multiple_date_swaps',
    description: 'Stress-test multiple date flips; validator should be called each time.',
    prompts: [
      `Plan a 4-day trip to Lisbon from Toronto on ${future90} for 2 adults, budget 1800 CAD total.`,
      `Shift to ${future120()}.`,
      `Actually make it ${future300}.`
    ]
  },
  {
    name: 'duration_shift_and_date_reask',
    description: 'User changes duration and date midstream; validator should re-check.',
    prompts: [
      `Plan a 7-day trip to Sydney from Los Angeles on ${future150} for 2 adults, budget 2500 USD per person.`,
      'Make it 5 days instead and move the date to early next month.',
      `Use ${future30} as the outbound.`
    ]
  }
];

// Helper used in one scenario to avoid hoisting issues
function future120() {
  return addDays(120);
}

const LOG_DIR = path.join('data', 'trip-planner-date-validation-logs');

const toOutputString = (finalOutput) => {
  if (!finalOutput) return '';
  if (Array.isArray(finalOutput)) return finalOutput.map(String).join('\n');
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

const extractToolCalls = (fullResult) => {
  const items = fullResult?.state?._generatedItems || [];
  return items
    .filter((item) => item.type === 'tool_call_item')
    .map((item) => item.rawItem?.name)
    .filter(Boolean);
};

async function runTurnWithRetry(userMessage, chatId, conversationHistory, attempt = 1, maxRetries = 1) {
  const startTime = Date.now();
  try {
    const result = await runMultiAgentSystem(userMessage, chatId, conversationHistory, false);
    const toolCalls = extractToolCalls(result.fullResult);
    return { result, duration: Date.now() - startTime, toolCalls };
  } catch (error) {
    const messageLower = (error.message || '').toLowerCase();
    const isRateLimit = messageLower.includes('rate limit') || messageLower.includes('tpm');

    if (isRateLimit && attempt <= maxRetries) {
      const waitMs = 61000;
      console.log(`\n⚠️  Rate limit on attempt ${attempt} for "${userMessage}". Waiting ${(waitMs / 1000).toFixed(0)}s then retrying...`);
      await sleep(waitMs);
      return runTurnWithRetry(userMessage, chatId, conversationHistory, attempt + 1, maxRetries);
    }

    throw error;
  }
}

async function runScenario(scenario, index) {
  const chatId = `trip-date-val-${Date.now()}-${index}`;
  const conversationHistory = [];
  const steps = [];
  let success = true;
  let lastContext = null;
  let validateCalls = 0;

  console.log(`\n=== Scenario ${index + 1}: ${scenario.name} ===`);
  console.log(`${scenario.description}\n`);

  for (let turn = 0; turn < scenario.prompts.length; turn++) {
    const userMessage = scenario.prompts[turn];
    conversationHistory.push({ role: 'user', content: userMessage });

    try {
      const { result, duration, toolCalls } = await runTurnWithRetry(
        userMessage,
        chatId,
        conversationHistory
      );

      const assistantOutput = toOutputString(result.finalOutput);
      const calledValidate = toolCalls.includes('validate_trip_date');
      if (calledValidate) validateCalls += 1;

      console.log(`Turn ${turn + 1} user prompt:\n${userMessage}\n`);
      console.log(`Agent (${result.lastAgent}) response (took ${(duration / 1000).toFixed(2)}s):\n${assistantOutput}\n`);
      console.log(`Tool calls this turn: ${toolCalls.length ? toolCalls.join(', ') : 'none'}\n`);

      conversationHistory.push({ role: 'assistant', content: assistantOutput });

      steps.push({
        turn: turn + 1,
        user: userMessage,
        agent: assistantOutput,
        lastAgent: result.lastAgent,
        duration_ms: duration,
        toolCalls,
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
    validateCalls,
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

  const logFile = path.join(LOG_DIR, `trip-planner-date-validation-${runTimestamp}.json`);
  await fs.writeFile(logFile, JSON.stringify(logPayload, null, 2), 'utf-8');

  console.log('\n============================================');
  console.log('Trip planner date-validation run complete.');
  console.log(`Logs saved to: ${logFile}`);
  console.log('============================================\n');
}

runAllScenarios().catch((error) => {
  console.error('Scenario runner failed:', error);
  process.exit(1);
});
