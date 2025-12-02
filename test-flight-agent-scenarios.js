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
    name: 'happy_path_roundtrip_table',
    description: 'Supported cities with IATA auto-lookup; expects a clean table output.',
    prompts: [
      'Hi, I need roundtrip flights from New York to Paris next month for 2 adults, economy.',
      'Set outbound on the 10th of next month and return on the 17th.',
      'Prefer nonstops if available.'
    ]
  },
  {
    name: 'unsupported_city_then_fix',
    description: 'Bangkok is unsupported in the local lookup; agent should ask for another city, then succeed with a supported one.',
    prompts: [
      'Find me economy flights Delhi to Bangkok next month for 1 adult.',
      'Okay switch destination to Singapore, business class, same timing.'
    ]
  },
  
  // {
  //   name: 'long_multi_change_infants_dates_cabin_triptype',
  //   description: 'Stress-test: user keeps changing infant types, dates, cabin, and trip type over many turns; agent must rerun flight_search each time.',
  //   prompts: [
  //     'Need flights Delhi to Bangkok' ,
  //     'for 2 adults and 2 seat infants' , 
  //     'outbound on April 5, return April 12, economy roundtrip.',
  //     'Change to 1 seat infant and 1 lap infant; keep everything else.',
  //     'Make it business class.',
  //     'Shift outbound to April 7, return April 14.',
  //     'Switch trip type to oneway for now; outbound April 7 only.',
  //     'Back to roundtrip, same dates April 7/14.',
  //     'Make both infants lap infants.',
  //     'Now 1 lap infant, 1 seat infant again.',
  //     'Add a child age 4.',
  //     'Remove the child; back to just 2 adults + 1 lap, 1 seat infant.',
  //     'Change cabin to premium_economy.',
  //     'Change dates to May 2 outbound, May 9 return.',
  //     'Trip type oneway on May 2.',
  //     'Trip type roundtrip on May 2/9, cabin economy.',
  //     'Final: 2 adults, 1 lap infant, 1 seat infant, business class, roundtrip May 2/9.'
  //   ]
  // },
  // {
  //   name: 'long_multi_change_filters_triptype_infants',
  //   description: 'Stress-test: repeated toggles of infant types, trip type, dates, cabin, and filters over many turns.',
  //   prompts: [
  //     'Find flights from New York to Paris on June 10 returning June 18 for 2 adults and 2 seat infants, economy roundtrip.',
  //     'Make 1 lap infant and 1 seat infant.',
  //     'Make both lap infants.',
  //     'Switch to one-way on June 10.',
  //     'Back to roundtrip June 12 to June 20.',
  //     'Change cabin to business.',
  //     'Add preferred airline Air France.',
  //     'Remove preferred airline; make it direct flights only.',
  //     'Change trip to London instead of Paris, same dates.',
  //     'Switch back to Paris, keep direct-only.',
  //     'Make cabin premium_economy.',
  //     'Make it economy, add 1 child age 6.',
  //     'Remove the child; 2 adults, 1 lap infant, 1 seat infant.',
  //     'Trip type oneway June 12, business.',
  //     'Final: roundtrip June 12-20, economy, 2 adults, 1 lap infant, 1 seat infant, direct-only off.'
  //   ]
  // },
  // {
  //   name: 'full_field_churn_20_turns',
  //   description: '20-turn torture test where every critical field (route, dates, trip type, cabin, filters, passengers incl. lap/seat infants) changes multiple times; verify flight_search payload/signature updates each time.',
  //   prompts: [
  //     'Book roundtrip economy flights from Los Angeles to Tokyo, outbound 2026-07-05, return 2026-07-15, for 2 adults, 1 child age 7, 1 lap infant age 1, direct flights only, prefer Delta.',
  //     'Make the infant a seat infant instead of lap; keep the rest the same.',
  //     'Upgrade cabin to premium_economy.',
  //     'Shift dates to outbound 2026-07-08 and return 2026-07-18.',
  //     'Switch to one-way for now on 2026-07-08, same passengers.',
  //     'Change route to San Francisco to Tokyo, same one-way date 2026-07-08.',
  //     'Make it roundtrip again with return 2026-07-20.',
  //     'Upgrade to business class.',
  //     'Add preferred airline Japan Airlines instead of Delta.',
  //     'Add another infant age 1 as lap infant; keep first infant as seat infant.',
  //     'Remove the child for now; just 2 adults, 1 seat infant, 1 lap infant.',
  //     'Add back 2 children ages 5 and 9; keep both infants.',
  //     'Turn off direct-only filter; connections are okay.',
  //     'Switch trip type to one-way again on 2026-07-10, keep all passengers.',
  //     'Back to roundtrip: outbound 2026-07-10, return 2026-07-25, still business.',
  //     'Drop cabin to economy.',
  //     'Make both infants lap infants (no seats).',
  //     'Add 1 senior traveler; total now 2 adults, 1 senior, 2 children (5,9), 2 lap infants.',
  //     'Change destination to Seoul instead of Tokyo, same dates.',
  //     'Final tweak: cabin premium_economy, prefer Korean Air, keep roundtrip 2026-07-10/2026-07-25, passengers 2 adults, 1 senior, 2 children (5,9), 1 lap infant, 1 seat infant (switch one infant back to seat).'
  //   ]
  // }
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
      searchResultsCount: Array.isArray(flight.searchResults) ? flight.searchResults.length : 0,
      lastSearchSignature: flight.lastSearchSignature
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
