import 'dotenv/config';

import { Agent, assistant, run, user, webSearchTool } from '@openai/agents';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppContext, tripPlannerAgent, validate_trip_date } from '../src/ai/multiAgentSystem.js';
import tripPlannerPrompt from '../src/ai/trip.planner.prompt.js';

const args = process.argv.slice(2);

function getArgValue(flag) {
  const withEquals = args.find((arg) => arg.startsWith(`${flag}=`));
  if (withEquals) return withEquals.slice(flag.length + 1);
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
  return null;
}

const usePromptFile = args.includes('--prompt-file');
const skipWebSearch = args.includes('--skip-web') || process.env.SKIP_WEB_SEARCH === '1';
const sleepMs = Number(getArgValue('--sleep-ms') ?? process.env.TRIP_PLANNER_SLEEP_MS ?? 60000);
const shouldSleep = Number.isFinite(sleepMs) && sleepMs > 0;
const modelArg = getArgValue('--model') || process.env.TRIP_PLANNER_MODEL || tripPlannerAgent.model || 'gpt-5.1';
const dumpRaw = args.includes('--dump-raw') || process.env.TRIP_PLANNER_DUMP_RAW === '1';
const onlyCases = getArgValue('--cases')
  ? getArgValue('--cases')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
  : null;

const noSave = args.includes('--no-save');
const saveFlag = !noSave;
const savePathArg = getArgValue('--save');
const baselinePath = getArgValue('--baseline');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const defaultSavePath = path.join(__dirname, `trip-planner-direct-results-${runStamp}.json`);
const savePath = saveFlag ? (savePathArg || defaultSavePath) : null;
const logPathArg = getArgValue('--log') || process.env.TRIP_PLANNER_LOG_PATH;
const logPath = logPathArg || path.join(__dirname, `trip-planner-direct-log-${runStamp}.log`);

const TEST_CASES = [
  {
    name: 'event_cherry_blossom_multi_city',
    requiresWebSearch: true,
    turns: [
      {
        user:
          'Plan a 6-day cherry blossom trip to Tokyo and Kyoto from San Francisco for 2 people, March 25, budget $3500 per person. We love food and culture with a moderate pace.',
        expect: {
          shouldHaveItinerary: true,
          toolSequence: ['validate_trip_date', 'web_search'],
        },
      },
    ],
  },
  {
    name: 'partial_info_rome_budget_total',
    requiresWebSearch: false,
    turns: [
      {
        user:
          'I want a 4-day Rome trip from London in early October, total budget EUR 1800 for a couple, minimal walking and lots of food.',
        expect: {
          shouldAskQuestions: true,
        },
      },
    ],
  },
  {
    name: 'event_oktoberfest_complete',
    requiresWebSearch: true,
    turns: [
      {
        user:
          'Oktoberfest trip from Delhi, 5 days, 2 people, budget INR 120000 per person. Prefer easy pace and beer halls.',
        expect: {
          shouldHaveItinerary: true,
          toolSequence: ['validate_trip_date', 'web_search'],
        },
      },
    ],
  },
  {
    name: 'multi_turn_modification',
    requiresWebSearch: false,
    turns: [
      {
        user:
          'Plan a 5-day Paris trip from Delhi for 2 people starting May 10, 2026 with budget INR 100000 per person. Focus on culture and food.',
        expect: {
          shouldHaveItinerary: true,
        },
      },
      {
        user: 'Actually make it 7 days and add a day trip to Versailles.',
        expect: {
          shouldHaveItinerary: true,
          mustInclude: ['Day 7', 'Versailles'],
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

  const knownTools = new Set(['validate_trip_date', 'web_search', 'web_search_call']);

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
  checks.noToolLeak = !/validate_trip_date|web_search|tool call|tool invocation|tooling/i.test(output);
  if (expect?.shouldHaveItinerary) {
    checks.hasItinerary = /day\s+1\b/i.test(output);
  }
  if (expect?.shouldAskQuestions) {
    checks.hasQuestion = /\?/.test(output);
  }
  if (expect?.mustInclude) {
    checks.mustInclude = expect.mustInclude.every((token) => output.includes(token));
  }
  if (expect?.toolSequence) {
    checks.toolSequence = hasToolSequence(toolCalls, expect.toolSequence);
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

function wordSet(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );
}

function similarityScore(a, b) {
  const setA = wordSet(a);
  const setB = wordSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let common = 0;
  for (const token of setA) {
    if (setB.has(token)) common += 1;
  }
  return common / Math.max(setA.size, setB.size);
}

async function compareWithBaseline(currentResults, baselineFile) {
  const baselineRaw = await fs.readFile(baselineFile, 'utf8');
  const baseline = JSON.parse(baselineRaw);
  const baselineCases = new Map((baseline.cases || []).map((c) => [c.name, c]));

  logSection('Baseline Comparison');
  for (const currentCase of currentResults.cases) {
    const baseCase = baselineCases.get(currentCase.name);
    if (!baseCase) {
      logLine(`- ${currentCase.name}: no baseline found`);
      continue;
    }
    currentCase.turns.forEach((turn, idx) => {
      const baseTurn = baseCase.turns?.[idx];
      if (!baseTurn) {
        logLine(`- ${currentCase.name} turn ${idx + 1}: no baseline turn`);
        return;
      }
      const score = similarityScore(turn.output, baseTurn.output || '');
      logLine(`- ${currentCase.name} turn ${idx + 1}: similarity ${score.toFixed(2)}`);
    });
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY. Add it to the root .env file or your shell environment.');
  }

  const model = modelArg;
  const baseInstructions = tripPlannerAgent.instructions;
  const baseTools = tripPlannerAgent.tools?.length
    ? tripPlannerAgent.tools
    : [webSearchTool(), validate_trip_date];
  const baseSettings = tripPlannerAgent.modelSettings || {
    temperature: 0.4,
    toolChoice: 'required',
    parallelToolCalls: false,
  };

  const agent = usePromptFile
    ? new Agent({
        name: 'Trip Planner Direct (Prompt File)',
        model,
        instructions: tripPlannerPrompt,
        tools: baseTools,
        modelSettings: baseSettings,
      })
    : new Agent({
        name: 'Trip Planner Direct (Model Override)',
        model,
        instructions: baseInstructions,
        tools: baseTools,
        modelSettings: baseSettings,
      });

  logSection('Trip Planner Direct Test');
  logLine(`Agent: ${agent.name}`);
  logLine(`Model: ${agent.model}`);
  logLine(`Prompt source: ${usePromptFile ? 'src/ai/trip.planner.prompt.js' : 'tripPlannerAgent (multiAgentSystem)'}`);
  logLine(`Skip web search cases: ${skipWebSearch ? 'yes' : 'no'}`);
  logLine(`Inter-turn sleep: ${shouldSleep ? `${sleepMs}ms` : 'disabled'}`);
  logLine(`Log file: ${logPath}`);
  logLine(`Save results: ${savePath ?? 'disabled'}`);
  logLine(`Dump raw results: ${dumpRaw ? 'enabled' : 'disabled'}`);

  const results = {
    runAt: new Date().toISOString(),
    model: agent.model,
    promptSource: usePromptFile ? 'src/ai/trip.planner.prompt.js' : 'tripPlannerAgent',
    logPath,
    savePath,
    cases: [],
  };

  for (const testCase of TEST_CASES) {
    if (onlyCases && !onlyCases.includes(testCase.name)) {
      continue;
    }
    if (skipWebSearch && testCase.requiresWebSearch) {
      logSection(`Case: ${testCase.name} (skipped: web_search disabled)`);
      results.cases.push({ name: testCase.name, skipped: true, turns: [] });
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

      logLine(`Turn ${i + 1} output preview: ${output.replace(/\s+/g, ' ').slice(0, 220)}...`);
      if (toolCalls.length > 0) {
        logLine(`Turn ${i + 1} tool calls: ${toolCalls.map((call) => call.name).join(', ')}`);
      } else {
        logLine('Turn tool calls: none detected');
      }

      Object.entries(checks).forEach(([label, ok]) => {
        logCheck(label, ok);
      });
      logLine(`Checks: ${summary.pass} pass, ${summary.warn} warn`);

      caseResult.turns.push({
        user: turn.user,
        output,
        toolCalls,
        checks,
      });

      if (dumpRaw) {
        const rawPath = path.join(__dirname, `${testCase.name}-turn${i + 1}-raw.json`);
        await fs.writeFile(rawPath, safeStringify(result), 'utf8');
        logLine(`Saved raw result to ${rawPath}`);
      }

      thread.push(user(turn.user));
      thread.push(assistant(output));

      if (shouldSleep && i < testCase.turns.length - 1) {
        logLine(`Sleeping ${sleepMs}ms before next turn...`);
        await sleep(sleepMs);
      }
    }

    results.cases.push(caseResult);

    if (shouldSleep) {
      logLine(`Sleeping ${sleepMs}ms before next case...`);
      await sleep(sleepMs);
    }
  }

  if (savePath) {
    await fs.writeFile(savePath, JSON.stringify(results, null, 2), 'utf8');
    logLine(`\nSaved results to ${savePath}`);
  }

  if (baselinePath) {
    await compareWithBaseline(results, baselinePath);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
