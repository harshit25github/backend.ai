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
    name: 'incremental_slots_then_itinerary',
    description: 'User gives partial info then completes slots; agent should ask politely once and generate itinerary immediately when filled.',
    prompts: [
      'Plan a 4-day trip to Kyoto in mid April for 2 adults, budget $1200 total.',
      'We will fly from San Francisco. Depart April 12.',
      'Currency is USD; please proceed.'
    ]
  },
  {
    name: 'regenerate_on_duration_budget_change',
    description: 'After itinerary, user shortens duration and raises budget; agent must regenerate without stalling. Info is provided over multiple turns.',
    prompts: [
      'Planning a trip to Rome.',
      'We will travel from New York.',
      'Outbound March 5, 2026 and back March 10.',
      'Make it for 2 adults, budget 1500 USD per person.',
      'Create a 5-day itinerary.',
      'Actually make it 3 days and increase budget to 2200 USD per person.'
    ]
  },
  {
    name: 'destination_swap_after_plan',
    description: 'User swaps destination after plan exists; agent should regenerate for new city. Info is trickled across turns.',
    prompts: [
      'Plan a 4-day family trip.',
      'We depart from Toronto and want Paris.',
      'Dates: outbound 2026-04-02, return 2026-04-06.',
      'Travelers: 2 adults and 1 child age 9, budget 1800 CAD per person.',
      'Switch destination to Lisbon, same dates and travelers.'
    ]
  },
  {
    name: 'day_level_activity_change',
    description: 'User asks to replace specific day focus with new theme; agent should regenerate affected day (and keep flow).',
    prompts: [
      'Build a 3-day Tokyo itinerary from Chicago, outbound 2026-05-10, return 2026-05-13, 2 adults, 1 teen 15, budget 2000 USD per person.',
      'Replace Day 2 with a food-focused day (markets and ramen), no museums.'
    ]
  },
  {
    name: 'vague_dates_and_missing_origin',
    description: 'User gives vague timing and no origin; agent must clarify politely, infer future date, and produce itinerary once set. Info arrives over several turns.',
    prompts: [
      'Plan a 6-day beach and culture trip to Barcelona.',
      'Timing: late December.',
      'Three adults, budget 2400 EUR total.',
      'We depart from Berlin; lock the dates accordingly.'
    ]
  },
  {
    name: 'long_slot_fill_over_many_turns',
    description: 'User drips all six fields over 7 turns; agent must not stall or over-ask and must produce itinerary once complete.',
    prompts: [
      'I want to plan a trip.',
      'Thinking Europe.',
      'Maybe Prague.',
      'I will be leaving from Boston.',
      'Make it 5 days, end of August.',
      '3 adults, budget 1800 USD total.',
      'Lock exact dates as Aug 24 outbound.'
    ]
  },
  {
    name: 'multi_turn_partial_then_modification',
    description: 'User fills slots slowly, gets itinerary, then changes outbound date and pax; agent should regenerate.',
    prompts: [
      'Need a vacation plan.',
      'Destination Lisbon.',
      'From Chicago.',
      'October sometime.',
      'Budget 900 USD per person; 2 adults.',
      'Let’s do Oct 10 outbound, 4 days total.',
      'After plan: shift outbound to Oct 14 and add 1 child age 10.'
    ]
  },
  {
    name: 'budget_currency_switch_after_plan',
    description: 'After itinerary, user switches currency and budget basis; agent should regenerate with new budget context. Multi-turn slot fill.',
    prompts: [
      'Planning a 6-day trip from Sydney to Bali.',
      'Dates: outbound 2026-07-05, return 2026-07-11.',
      'Group: 2 adults, 1 child age 12.',
      'Budget 3500 AUD total.',
      'Change budget to 2200 USD per person.'
    ]
  },
  {
    name: 'activity_preference_injection',
    description: 'User adds strong preferences after plan (hiking-heavy, no museums); agent should adjust impacted days. Multi-turn slot fill.',
    prompts: [
      'Create a 4-day Vancouver itinerary.',
      'Departing from Seattle.',
      'Dates: 2026-06-01 to 2026-06-05.',
      '2 adults, budget 1200 USD total.',
      'Make it hiking heavy, skip museums entirely.'
    ]
  },
  {
    name: 'late_cabin_triptype_noise',
    description: 'User adds irrelevant flight details mid-planning; agent should keep focus on itinerary and still deliver. Multi-turn slot fill.',
    prompts: [
      'Plan a 5-day trip to Dubai.',
      'Departing from London.',
      'Dates: outbound 2026-02-10, return 2026-02-15.',
      '2 adults, budget 2000 GBP total.',
      'Make the flights business class direct only (just FYI).',
      'Proceed with the itinerary now.'
    ]
  },
  {
    name: 'ambiguous_month_and_midstream_change',
    description: 'User says “mid Jan” then changes to “early Feb” after itinerary; agent should regenerate dates and plan. Multi-turn slot fill.',
    prompts: [
      'Plan a 3-day trip to Singapore.',
      'We depart from Delhi, timing mid January.',
      '2 adults, budget 800 USD per person.',
      'Actually make it early February instead.'
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
