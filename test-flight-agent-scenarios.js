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
    name: 'complete_roundtrip',
    description: 'All info provided upfront with children + lap infant to test slot audit.',
    prompts: [
      'Find flights from Delhi to Mumbai on January 20 2026 returning January 28 2026 for two adults, one 7 year old child, and a 1 year old lap infant in economy.'
    ]
  },
  {
    name: 'progressive_family_details',
    description: 'Progressive slot filling that forces the agent to ask for children ages and infant seat type.',
    prompts: [
      'I need flights to Goa in March with my spouse and three kids.',
      'We are flying out of Bangalore around March 10, kids are 5, 8, and 12, and we have a 1 year old baby who will sit on our lap.',
      'Economy round trip please.'
    ]
  },
  {
    name: 'one_way_business_upgrade',
    description: 'User starts with economy round-trip then switches to one-way business class.',
    prompts: [
      'Book flights from Chennai to Dubai on April 5 returning April 12 for one adult in economy.',
      'Actually make it one-way and upgrade me to business class.'
    ]
  },
  {
    name: 'missing_info_guardrails',
    description: 'Agent should keep asking for missing slots instead of calling flight_search.',
    prompts: [
      'Show me flights to Bali.',
      'Leaving from Mumbai on June 2.',
      'Two adults and a toddler.'
    ]
  },
  {
    name: 'past_date_adjustment',
    description: 'User supplies past dates; agent/tool must reject and request a future date.',
    prompts: [
      'Need flights from Pune to Kochi on March 5 2024 returning March 10 2024 for two adults in economy.'
    ]
  },
  {
    name: 'beyond_window_block',
    description: 'Dates more than 12 months away should trigger the 12-month guardrail.',
    prompts: [
      'Plan a round trip from Hyderabad to Sydney leaving February 15 2028 and coming back February 28 2028 for two adults and one child age 9.'
    ]
  },
  {
    name: 'return_before_departure',
    description: 'Return date earlier than departure should be flagged before searching.',
    prompts: [
      'Flights from Kolkata to Bangkok on August 20 2026 returning August 15 2026 for three adults in premium economy.'
    ]
  },
  {
    name: 'lap_infant_ratio_violation',
    description: 'Ensure passenger validation catches multiple lap infants per adult.',
    prompts: [
      'Find flights from Delhi to London on May 2 2026 returning May 12 2026 for one adult with two lap infants.'
    ]
  },
  {
    name: 'nearest_airport_resolution',
    description: 'Origin city without airport (Nellore) should force nearest-airport guidance before search.',
    prompts: [
      'Need flights from Nellore to Delhi on April 18 returning April 24 for two adults and two kids age 6 and 10.'
    ]
  },
  {
    name: 'direct_flight_preference_change',
    description: 'User toggles direct-flight filter and cabin class mid-conversation to ensure new search.',
    prompts: [
      'Search flights from Bengaluru to Singapore on December 10 returning December 16 for two adults in economy.',
      'Please show only non-stop options in business class instead.'
    ]
  },
  {
    name: 'iata_missing_retry',
    description: 'User provides cities but leaves out one airport; agent should run web_search then recall flight_search.',
    prompts: [
      'Find one-way flights from Indore to Paris on July 1 2026 for one adult.',
      'Also add a preference for Air France if possible.'
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
    const startTime = Date.now();
    conversationHistory.push({ role: 'user', content: userMessage });

    try {
      const result = await runMultiAgentSystem(
        userMessage,
        chatId,
        conversationHistory,
        false
      );

      const durationMs = Date.now() - startTime;
      const assistantOutput = toOutputString(result.finalOutput);

      console.log(`Turn ${turn + 1} user prompt:\n${userMessage}\n`);
      console.log(`Agent (${result.lastAgent}) response (took ${(durationMs / 1000).toFixed(2)}s):\n${assistantOutput}\n`);

      conversationHistory.push({ role: 'assistant', content: assistantOutput });

      steps.push({
        turn: turn + 1,
        user: userMessage,
        agent: assistantOutput,
        lastAgent: result.lastAgent,
        duration_ms: durationMs,
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
