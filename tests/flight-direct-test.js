import 'dotenv/config';

import { Agent, assistant, run, user, webSearchTool } from '@openai/agents';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppContext, flightSpecialistAgent, flight_search } from '../src/ai/multiAgentSystem.js';
import flightPrompt from '../src/ai/flight.plan.prompt.js';

const args = process.argv.slice(2);

function getArgValue(flag) {
  const withEquals = args.find((arg) => arg.startsWith(`${flag}=`));
  if (withEquals) return withEquals.slice(flag.length + 1);
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
  return null;
}

const usePromptFile = args.includes('--prompt-file');
const sleepMs = Number(getArgValue('--sleep-ms') ?? process.env.FLIGHT_TEST_SLEEP_MS ?? 0);
const shouldSleep = Number.isFinite(sleepMs) && sleepMs > 0;
const modelArg = getArgValue('--model') || process.env.FLIGHT_TEST_MODEL || flightSpecialistAgent.model || 'gpt-5.1';
const dumpRaw = args.includes('--dump-raw') || process.env.FLIGHT_TEST_DUMP_RAW === '1';
const onlyCases = getArgValue('--cases')
  ? getArgValue('--cases')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
  : null;

const noSave = args.includes('--no-save');
const saveFlag = !noSave;
const savePathArg = getArgValue('--save');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const defaultSavePath = path.join(__dirname, `flight-direct-results-${runStamp}.json`);
const savePath = saveFlag ? (savePathArg || defaultSavePath) : null;
const logPathArg = getArgValue('--log') || process.env.FLIGHT_TEST_LOG_PATH;
const logPath = logPathArg || path.join(__dirname, `flight-direct-log-${runStamp}.log`);

const TEST_CASES = [
  {
    name: 'missing_slots_next_weekend',
    turns: [
      {
        user: 'Find flights from Delhi to Mumbai next weekend.',
        expect: {
          shouldAskQuestions: true,
          toolSequence: ['flight_search'],
        },
      },
    ],
  },
  {
    name: 'explicit_year_invalid',
    turns: [
      {
        user: 'Book flights from Delhi to Mumbai on 2020-01-01, one-way, 1 adult, economy.',
        expect: {
          shouldAskQuestions: true,
          toolSequence: ['flight_search'],
        },
      },
    ],
  },
  {
    name: 'missing_child_ages',
    turns: [
      {
        user: 'Flights from Delhi to Mumbai in 9 days, one-way, 2 adults and 1 child, economy.',
        expect: {
          shouldAskQuestions: true,
          toolSequence: ['flight_search'],
        },
      },
    ],
  },
  {
    name: 'multicity_single_full_payload',
    turns: [
      {
        user:
          'Need a multicity trip: Delhi to Dubai on 2026-06-10, Dubai to Paris on 2026-06-13, Paris to Delhi on 2026-06-20. 2 adults, economy.',
        expect: {
          toolSequence: ['flight_search'],
          hasSegmentsInToolCall: true,
          tripType: 'multicity',
          segmentsCount: 3,
        },
      },
    ],
  },
  {
    name: 'complex_roundtrip_filters',
    turns: [
      {
        user:
          'Flights from Delhi to Mumbai, roundtrip, depart 2026-06-10 return 2026-06-18, 2 adults, 1 child age 9, 1 seat infant, business class, direct only, prefer Air India and Vistara.',
        expect: {
          toolSequence: ['flight_search'],
          directOnly: true,
          preferredAirlines: true,
          mustInclude: ['Delhi', 'Mumbai'],
        },
      },
    ],
  },
  {
    name: 'complex_multicity_with_filters',
    turns: [
      {
        user:
          'Multicity: Delhi to Dubai on 2026-06-10, Dubai to Paris on 2026-06-13, Paris to Delhi on 2026-06-20, 2 adults, 1 child age 6, business, direct only.',
        expect: {
          toolSequence: ['flight_search'],
          hasSegmentsInToolCall: true,
          tripType: 'multicity',
          segmentsCount: 3,
          directOnly: true,
        },
      },
    ],
  },
  {
    name: 'success_roundtrip_relative_dates',
    turns: [
      {
        user: 'Flights from Delhi to Mumbai, roundtrip, in 10 days, return in 15 days, 2 adults, economy.',
        expect: {
          shouldNotAskQuestions: true,
          toolSequence: ['flight_search'],
          mustInclude: ['Delhi', 'Mumbai'],
        },
      },
    ],
  },
  {
    name: 'success_with_children_infants',
    turns: [
      {
        user: 'Flights from Delhi to Mumbai roundtrip, depart in 10 days return in 14 days, 2 adults, 1 child age 7, 1 lap infant, economy.',
        expect: {
          shouldNotAskQuestions: true,
          toolSequence: ['flight_search'],
          mustInclude: ['Delhi', 'Mumbai'],
        },
      },
    ],
  },
  {
    name: 'return_before_outbound',
    turns: [
      {
        user: 'Flights from Delhi to Mumbai roundtrip departing 2026-06-20 returning 2026-06-15, 1 adult, economy.',
        expect: {
          shouldAskQuestions: true,
          toolSequence: ['flight_search'],
        },
      },
    ],
  },
  {
    name: 'modification_change_cabin',
    turns: [
      {
        user: 'Flights from Delhi to Mumbai, one-way, in 12 days, 1 adult, economy.',
        expect: {
          shouldNotAskQuestions: true,
          toolSequence: ['flight_search'],
          mustInclude: ['Delhi', 'Mumbai'],
        },
      },
      {
        user: 'Switch to business class.',
        expect: {
          shouldNotAskQuestions: true,
          toolSequence: ['flight_search'],
          mustInclude: ['business'],
        },
      },
    ],
  },
  {
    name: 'multicity_modify_cabin',
    turns: [
      {
        user:
          'Multicity request: Delhi to Dubai on 2026-06-10, Dubai to Paris on 2026-06-13, Paris to Delhi on 2026-06-20. 2 adults, economy.',
        expect: {
          toolSequence: ['flight_search'],
          hasSegmentsInToolCall: true,
          tripType: 'multicity',
          segmentsCount: 3,
        },
      },
      {
        user: 'Make it business class.',
        expect: {
          toolSequence: ['flight_search'],
          hasSegmentsInToolCall: true,
          tripType: 'multicity',
          segmentsCount: 3,
        },
      },
    ],
  },
  {
    name: 'multicity_modify_middle_leg',
    turns: [
      {
        user:
          'Multicity: Delhi to Dubai on 2026-06-10, Dubai to Paris on 2026-06-13, Paris to Delhi on 2026-06-20. 2 adults, economy.',
        expect: {
          toolSequence: ['flight_search'],
          hasSegmentsInToolCall: true,
          tripType: 'multicity',
          segmentsCount: 3,
        },
      },
      {
        user: 'Change the Dubai → Paris leg to 2026-06-15 and keep everything else the same.',
        expect: {
          toolSequence: ['flight_search'],
          hasSegmentsInToolCall: true,
          tripType: 'multicity',
          segmentsCount: 3,
        },
      },
    ],
  },
];

function normalizeOutput(output) {
  if (Array.isArray(output)) return output.map(String).join('\n');
  return String(output ?? '');
}

function extractToolCalls(result) {
  const calls = [];
  const jsonState = typeof result?.toJSON === 'function' ? result.toJSON() : null;
  const sources = [];
  const maybePush = (items) => {
    if (Array.isArray(items) && items.length > 0) sources.push(items);
  };
  maybePush(result?.generatedItems);
  maybePush(result?.items);
  maybePush(result?.output?.items);
  maybePush(result?.response?.output);
  maybePush(result?.response?.output?.items);
  maybePush(result?.outputItems);
  maybePush(result?.steps);
  maybePush(result?.state?.generatedItems);
  maybePush(result?.state?.items);
  maybePush(result?.state?.modelResponses?.flatMap((resp) => resp?.output || []));
  maybePush(result?.state?.lastProcessedResponse?.newItems);
  maybePush(result?.state?._generatedItems);
  maybePush(result?.state?._items);
  maybePush(result?.state?._modelResponses?.flatMap((resp) => resp?.output || []));
  maybePush(result?.state?._lastProcessedResponse?.newItems);
  maybePush(jsonState?.state?.generatedItems);
  maybePush(jsonState?.state?.items);
  maybePush(jsonState?.state?.modelResponses?.flatMap((resp) => resp?.output || []));
  maybePush(jsonState?.state?.lastProcessedResponse?.newItems);

  const knownTools = new Set(['flight_search', 'web_search', 'web_search_call']);

  for (const items of sources) {
    for (const item of items) {
      const raw = item?.rawItem || item;
      const name =
        raw?.name ||
        raw?.tool?.name ||
        raw?.function?.name ||
        raw?.call?.name ||
        raw?.tool_name ||
        raw?.toolName ||
        raw?.action?.name;
      if (!name) continue;
      const typeHint = String(item?.type || raw?.type || '');
      const toolLike =
        knownTools.has(name) ||
        /tool/i.test(typeHint) ||
        raw?.tool ||
        raw?.function ||
        raw?.call;
      if (!toolLike) continue;
      calls.push({
        name: name === 'web_search_call' ? 'web_search' : name,
        args:
          raw?.arguments ||
          raw?.args ||
          raw?.input ||
          raw?.tool?.arguments ||
          raw?.function?.arguments ||
          null,
      });
    }
  }
  return calls;
}

function hasToolSequence(calls, sequence) {
  if (!sequence || sequence.length === 0) return true;
  if (!calls || calls.length === 0) return false;
  let idx = 0;
  for (const call of calls) {
    if (call.name === sequence[idx]) idx += 1;
    if (idx >= sequence.length) return true;
  }
  return false;
}

function runChecks(output, expect, toolCalls) {
  const checks = {};
  checks.noToolLeak = !/flight_search|web_search|tool call|tool invocation|tooling/i.test(output);
  if (expect?.shouldAskQuestions) {
    checks.hasQuestion = /\?/.test(output);
  }
  if (expect?.shouldNotAskQuestions) {
    checks.noQuestion = !/\?/.test(output);
  }
  if (expect?.mustInclude) {
    checks.mustInclude = expect.mustInclude.every((token) => output.includes(token));
  }
  if (expect?.toolSequence) {
    checks.toolSequence = hasToolSequence(toolCalls, expect.toolSequence);
  }
  const parseArgs = (call) => {
    if (!call?.args) return null;
    if (typeof call.args === 'string') {
      try {
        return JSON.parse(call.args);
      } catch {
        return null;
      }
    }
    return call.args;
  };
  if (expect?.hasSegmentsInToolCall) {
    checks.hasSegmentsInToolCall = toolCalls.some((call) => {
      if (call.name !== 'flight_search') return false;
      const parsed = parseArgs(call);
      const segments = parsed?.segments;
      return Array.isArray(segments) && segments.length > 0;
    });
  }
  if (expect?.segmentsCount) {
    checks.segmentsCount = toolCalls.some((call) => {
      if (call.name !== 'flight_search') return false;
      const parsed = parseArgs(call);
      const segments = parsed?.segments;
      return Array.isArray(segments) && segments.length === expect.segmentsCount;
    });
  }
  if (expect?.tripType) {
    checks.tripType = toolCalls.some((call) => {
      if (call.name !== 'flight_search') return false;
      const parsed = parseArgs(call);
      return String(parsed?.trip_type || '').toLowerCase() === String(expect.tripType).toLowerCase();
    });
  }
  if (expect?.directOnly) {
    checks.directOnly = toolCalls.some((call) => {
      if (call.name !== 'flight_search') return false;
      const parsed = parseArgs(call);
      return Boolean(parsed?.direct_flight_only) === true;
    });
  }
  if (expect?.preferredAirlines) {
    checks.preferredAirlines = toolCalls.some((call) => {
      if (call.name !== 'flight_search') return false;
      const parsed = parseArgs(call);
      const airlines = parsed?.preferred_airlines;
      return Array.isArray(airlines) && airlines.length > 0;
    });
  }
  return checks;
}

function summarizeChecks(checks) {
  const entries = Object.entries(checks);
  if (entries.length === 0) return { pass: 0, warn: 0 };
  let pass = 0;
  let warn = 0;
  for (const [, ok] of entries) {
    if (ok) pass += 1;
    else warn += 1;
  }
  return { pass, warn };
}

function logLine(message) {
  console.log(message);
  if (logPath) {
    fs.appendFile(logPath, `${message}\n`).catch(() => {});
  }
}

function logSection(title) {
  logLine('\n' + '='.repeat(80));
  logLine(title);
  logLine('='.repeat(80));
}

function logCheck(label, ok) {
  logLine(`  [${ok ? 'PASS' : 'WARN'}] ${label}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeStringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (key, val) => {
      if (typeof val === 'function') return '[Function]';
      if (typeof val === 'bigint') return val.toString();
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    },
    2,
  );
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY. Add it to the root .env file or your shell environment.');
  }

  const model = modelArg;
  const baseInstructions = flightSpecialistAgent.instructions;
  const baseTools = flightSpecialistAgent.tools?.length
    ? flightSpecialistAgent.tools
    : [flight_search, webSearchTool()];
  const baseSettings = flightSpecialistAgent.modelSettings || {
    temperature: 0.25,
    toolChoice: 'required',
    parallelToolCalls: false,
  };

  const agent = usePromptFile
    ? new Agent({
        name: 'Flight Specialist Direct (Prompt File)',
        model,
        instructions: flightPrompt,
        tools: baseTools,
        modelSettings: baseSettings,
      })
    : new Agent({
        name: 'Flight Specialist Direct (Model Override)',
        model,
        instructions: baseInstructions,
        tools: baseTools,
        modelSettings: baseSettings,
      });

  logSection('Flight Specialist Direct Test');
  logLine(`Agent: ${agent.name}`);
  logLine(`Model: ${agent.model}`);
  logLine(`Prompt source: ${usePromptFile ? 'src/ai/flight.plan.prompt.js' : 'flightSpecialistAgent (multiAgentSystem)'}`);
  logLine(`Inter-turn sleep: ${shouldSleep ? `${sleepMs}ms` : 'disabled'}`);
  logLine(`Log file: ${logPath}`);
  logLine(`Save results: ${savePath ?? 'disabled'}`);
  logLine(`Dump raw results: ${dumpRaw ? 'enabled' : 'disabled'}`);

  const results = {
    runAt: new Date().toISOString(),
    model: agent.model,
    promptSource: usePromptFile ? 'src/ai/flight.plan.prompt.js' : 'flightSpecialistAgent',
    logPath,
    savePath,
    cases: [],
  };

  for (const testCase of TEST_CASES) {
    if (onlyCases && !onlyCases.includes(testCase.name)) {
      continue;
    }

    logSection(`Case: ${testCase.name}`);
    const context = AppContext.parse({});
    const thread = [];
    const caseResult = { name: testCase.name, skipped: false, turns: [] };

    for (let i = 0; i < testCase.turns.length; i += 1) {
      const turn = testCase.turns[i];
      logLine(`Turn ${i + 1} user: ${turn.user}`);

      const result = await run(agent, [...thread, user(turn.user)], {
        context,
        stream: false,
      });
      const output = normalizeOutput(result?.finalOutput || result?.content || result?.message || '');
      const toolCalls = extractToolCalls(result);
      const checks = runChecks(output, turn.expect || {}, toolCalls);
      const summary = summarizeChecks(checks);

      logLine(`Turn ${i + 1} output preview: ${output.slice(0, 240)}${output.length > 240 ? '...' : ''}`);
      logLine(`Turn ${i + 1} tool calls: ${toolCalls.map((c) => c.name).join(', ') || 'none'}`);
      Object.entries(checks).forEach(([label, ok]) => logCheck(label, ok));
      logLine(`Checks: ${summary.pass} pass, ${summary.warn} warn`);

      const turnRecord = {
        user: turn.user,
        output,
        toolCalls,
        checks,
        summary,
      };

      if (dumpRaw) {
        const rawPath = path.join(__dirname, `${testCase.name}-turn${i + 1}-raw.json`);
        await fs.writeFile(rawPath, safeStringify(result), 'utf8');
        logLine(`Saved raw result: ${rawPath}`);
        turnRecord.rawPath = rawPath;
      }

      caseResult.turns.push(turnRecord);
      thread.push(user(turn.user));
      if (output) {
        thread.push(assistant(output));
      }

      if (shouldSleep && i < testCase.turns.length - 1) {
        logLine(`Sleeping ${sleepMs}ms before next turn...`);
        await sleep(sleepMs);
      }
    }

    results.cases.push(caseResult);

    if (shouldSleep && testCase !== TEST_CASES[TEST_CASES.length - 1]) {
      logLine(`Sleeping ${sleepMs}ms before next case...`);
      await sleep(sleepMs);
    }
  }

  if (savePath) {
    await fs.writeFile(savePath, JSON.stringify(results, null, 2), 'utf8');
    logLine(`Saved results to ${savePath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
