import fs from 'fs/promises';
import path from 'path';

function isTruthyEnv(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function shouldDumpModelResponses() {
  return (
    isTruthyEnv(process.env.TOKEN_USAGE_TRACE_MODEL_RESPONSES) || isTruthyEnv(process.env.TRACE_MODEL_RESPONSES)
  );
}

function sanitizePathComponent(value) {
  const input = String(value ?? '').trim();
  const replaced = input.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/\s+/g, '_');
  // Windows disallows trailing dots/spaces.
  const trimmed = replaced.replace(/[. ]+$/g, '');
  return trimmed.slice(0, 120) || 'unknown';
}

function safeJsonStringify(value, space = 2) {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (_key, val) => {
      if (typeof val === 'bigint') return val.toString();
      if (typeof val === 'function') return '[Function]';
      if (val && typeof val === 'object') {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    },
    space,
  );
}

function getTraceRollupPath({ chatId }) {
  return path.join(getTraceTargetDir({ chatId }), 'turn-usage-rollup.json');
}

async function readJsonIfExists(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tmp = `${filePath}.tmp-${Math.random().toString(16).slice(2)}`;
  await fs.writeFile(tmp, safeJsonStringify(data, 2), 'utf8');
  await fs.rename(tmp, filePath);
}

function summarizeForRollup(usageSummary) {
  return {
    requests: usageSummary?.requests ?? 0,
    inputTokens: usageSummary?.inputTokens ?? 0,
    cachedInputTokens: usageSummary?.cachedInputTokens ?? 0,
    totalInputTokens: usageSummary?.totalInputTokens ?? 0,
    outputTokens: usageSummary?.outputTokens ?? 0,
    totalTokens: usageSummary?.totalTokens ?? 0,
    totalTokensIncludingCached: usageSummary?.totalTokensIncludingCached ?? 0,
    reasoningTokens: usageSummary?.reasoningTokens ?? 0,
  };
}

function sumRollup(turns = []) {
  const total = {
    turns: Array.isArray(turns) ? turns.length : 0,
    requests: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    totalInputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    totalTokensIncludingCached: 0,
    reasoningTokens: 0,
  };

  if (!Array.isArray(turns)) return total;

  for (const turn of turns) {
    const u = turn?.usage ?? {};
    total.requests += typeof u.requests === 'number' ? u.requests : 0;
    total.inputTokens += typeof u.inputTokens === 'number' ? u.inputTokens : 0;
    total.cachedInputTokens += typeof u.cachedInputTokens === 'number' ? u.cachedInputTokens : 0;
    total.totalInputTokens += typeof u.totalInputTokens === 'number' ? u.totalInputTokens : 0;
    total.outputTokens += typeof u.outputTokens === 'number' ? u.outputTokens : 0;
    total.totalTokens += typeof u.totalTokens === 'number' ? u.totalTokens : 0;
    total.totalTokensIncludingCached +=
      typeof u.totalTokensIncludingCached === 'number' ? u.totalTokensIncludingCached : 0;
    total.reasoningTokens += typeof u.reasoningTokens === 'number' ? u.reasoningTokens : 0;
  }

  return total;
}

async function maybeAppendTurnRollup(runResult, { chatId, tag, usageSummary } = {}) {
  if (!shouldDumpModelResponses()) return null;
  if (!chatId) return null;
  if (!runResult) return null;

  const sentinel = getTraceSentinel(runResult);
  if (sentinel?.__tokenUsageTurnRollupAppended) return sentinel?.__tokenUsageRollupPath ?? null;
  if (sentinel) sentinel.__tokenUsageTurnRollupAppended = true;

  const rollupPath = getTraceRollupPath({ chatId });
  if (sentinel) sentinel.__tokenUsageRollupPath = rollupPath;

  const now = new Date().toISOString();
  const dumpPath = sentinel?.__tokenUsageModelResponsesDumpPath ?? null;

  const nextTurn = {
    createdAt: now,
    tag: tag ?? null,
    lastResponseId: runResult?.lastResponseId ?? null,
    lastAgent: runResult?.lastAgent?.name ?? runResult?.lastAgent ?? null,
    dumpPath,
    usage: summarizeForRollup(usageSummary),
  };

  const existing = (await readJsonIfExists(rollupPath)) || { version: 1, chatId, turns: [] };
  const turns = Array.isArray(existing.turns) ? existing.turns : [];
  turns.push(nextTurn);

  const updated = {
    version: existing.version ?? 1,
    chatId,
    updatedAt: now,
    turns,
    totals: sumRollup(turns),
  };

  await writeJsonAtomic(rollupPath, updated);
  return rollupPath;
}

function summarizeModelResponsesForTrace(responses) {
  const list = Array.isArray(responses) ? responses : [];
  return list.map((r) => ({
    responseId: r?.responseId ?? null,
    usage: r?.usage
      ? {
          requests: r.usage.requests,
          inputTokens: r.usage.inputTokens,
          outputTokens: r.usage.outputTokens,
          totalTokens: r.usage.totalTokens,
          inputTokensDetails: r.usage.inputTokensDetails,
          outputTokensDetails: r.usage.outputTokensDetails,
        }
      : null,
    outputTypes: Array.isArray(r?.output) ? r.output.map((o) => o?.type).filter(Boolean) : [],
    toolCalls: Array.isArray(r?.output)
      ? r.output
          .filter((o) => o?.type === 'function_call')
          .map((o) => o?.name)
          .filter(Boolean)
      : [],
  }));
}

function snapshotStateUsageForTrace(runResult) {
  const usage = runResult?.state?.usage;
  if (!usage) return null;
  return {
    requests: usage.requests,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    inputTokensDetails: usage.inputTokensDetails,
    outputTokensDetails: usage.outputTokensDetails,
    requestUsageEntries: usage.requestUsageEntries,
  };
}

function getTraceBaseDir() {
  const configured = String(process.env.TOKEN_USAGE_TRACE_DIR ?? '').trim();
  return configured ? path.resolve(configured) : path.resolve('data/token-usage-traces');
}

function getTraceTargetDir({ chatId }) {
  return path.join(getTraceBaseDir(), sanitizePathComponent(chatId || 'unknown'));
}

function getTraceFilePath({ chatId, runResult, tag }) {
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-');

  const id =
    runResult?.lastResponseId ||
    runResult?.rawResponses?.[runResult?.rawResponses?.length - 1]?.responseId ||
    runResult?.rawResponses?.[0]?.responseId ||
    `run-${Math.random().toString(16).slice(2)}`;

  const suffix = tag ? `-${sanitizePathComponent(tag)}` : '';
  const fileName = `${stamp}${suffix}-${sanitizePathComponent(id)}.json`;
  return path.join(getTraceTargetDir({ chatId }), fileName);
}

function getTraceSentinel(runResult) {
  if (runResult?.state && typeof runResult.state === 'object') return runResult.state;
  if (runResult && typeof runResult === 'object') return runResult;
  return null;
}

function maybeDumpModelResponses(runResult, { chatId, tag } = {}) {
  if (!shouldDumpModelResponses()) return;
  if (!runResult) return;

  const sentinel = getTraceSentinel(runResult);
  if (sentinel?.__tokenUsageModelResponsesDumped) return;
  if (sentinel) sentinel.__tokenUsageModelResponsesDumped = true;

  const filePath = getTraceFilePath({ chatId, runResult, tag });
  if (sentinel) sentinel.__tokenUsageModelResponsesDumpPath = filePath;

  const payload = {
    createdAt: new Date().toISOString(),
    chatId: chatId ?? null,
    tag: tag ?? null,
    lastAgent: runResult?.lastAgent?.name ?? runResult?.lastAgent ?? null,
    lastResponseId: runResult?.lastResponseId ?? null,
    rawResponses: JSON.parse(safeJsonStringify(runResult?.rawResponses ?? null, 0)),
    stateModelResponses: JSON.parse(safeJsonStringify(runResult?.state?._modelResponses ?? null, 0)),
    rawResponsesSummary: summarizeModelResponsesForTrace(runResult?.rawResponses),
    stateModelResponsesSummary: summarizeModelResponsesForTrace(runResult?.state?._modelResponses),
    stateUsage: snapshotStateUsageForTrace(runResult),
  };

  void (async () => {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, safeJsonStringify(payload, 2), 'utf8');
    } catch {
      // Best-effort trace dump; never break production flows.
    }
  })();
}

function sumDetails(details, key) {
  if (!details) return 0;
  if (Array.isArray(details)) {
    let total = 0;
    for (const entry of details) {
      if (entry && typeof entry === 'object') {
        const value = entry[key];
        if (typeof value === 'number' && Number.isFinite(value)) total += value;
      }
    }
    return total;
  }
  if (typeof details === 'object') {
    const value = details[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
  return 0;
}

function coerceNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function coerceDetailsRecord(record, key) {
  if (!record || typeof record !== 'object') return 0;
  return coerceNumber(record[key]);
}

export function summarizeModelResponsesUsage(rawResponses) {
  const perRequest = [];

  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let cachedInputTokens = 0;
  let reasoningTokens = 0;
  let totalInputTokens = 0;
  let totalTokensIncludingCached = 0;

  if (!Array.isArray(rawResponses)) {
    return {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cachedInputTokens: 0,
      totalInputTokens: 0,
      totalTokensIncludingCached: 0,
      reasoningTokens: 0,
      perRequest,
    };
  }

  for (let i = 0; i < rawResponses.length; i += 1) {
    const response = rawResponses[i];
    const usage = response?.usage;
    if (!usage) continue;

    const reqInput = coerceNumber(usage.inputTokens);
    const reqOutput = coerceNumber(usage.outputTokens);
    const reqTotal = coerceNumber(usage.totalTokens);

    const reqCached = sumDetails(usage.inputTokensDetails, 'cached_tokens');
    const reqReasoning = sumDetails(usage.outputTokensDetails, 'reasoning_tokens');
    const reqTotalInput = reqInput + reqCached;
    const reqTotalIncludingCached = reqTotalInput + reqOutput;

    inputTokens += reqInput;
    outputTokens += reqOutput;
    totalTokens += reqTotal;
    cachedInputTokens += reqCached;
    reasoningTokens += reqReasoning;
    totalInputTokens += reqTotalInput;
    totalTokensIncludingCached += reqTotalIncludingCached;

    perRequest.push({
      requestIndex: i + 1,
      inputTokens: reqInput,
      cachedInputTokens: reqCached,
      totalInputTokens: reqTotalInput,
      outputTokens: reqOutput,
      totalTokens: reqTotal,
      totalTokensIncludingCached: reqTotalIncludingCached,
      reasoningTokens: reqReasoning,
      responseId: response?.responseId,
    });
  }

  return {
    requests: perRequest.length,
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens,
    totalInputTokens,
    totalTokensIncludingCached,
    reasoningTokens,
    perRequest,
  };
}

function summarizeUsageEntries(requestUsageEntries = []) {
  const perRequest = [];

  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let cachedInputTokens = 0;
  let reasoningTokens = 0;
  let totalInputTokens = 0;
  let totalTokensIncludingCached = 0;

  if (!Array.isArray(requestUsageEntries)) {
    return {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cachedInputTokens: 0,
      totalInputTokens: 0,
      totalTokensIncludingCached: 0,
      reasoningTokens: 0,
      perRequest,
    };
  }

  for (let i = 0; i < requestUsageEntries.length; i += 1) {
    const entry = requestUsageEntries[i];

    const reqInput = coerceNumber(entry?.inputTokens);
    const reqOutput = coerceNumber(entry?.outputTokens);
    const reqTotal = coerceNumber(entry?.totalTokens);

    const reqCached = coerceDetailsRecord(entry?.inputTokensDetails, 'cached_tokens');
    const reqReasoning = coerceDetailsRecord(entry?.outputTokensDetails, 'reasoning_tokens');
    const reqTotalInput = reqInput + reqCached;
    const reqTotalIncludingCached = reqTotalInput + reqOutput;

    inputTokens += reqInput;
    outputTokens += reqOutput;
    totalTokens += reqTotal;
    cachedInputTokens += reqCached;
    reasoningTokens += reqReasoning;
    totalInputTokens += reqTotalInput;
    totalTokensIncludingCached += reqTotalIncludingCached;

    perRequest.push({
      requestIndex: i + 1,
      inputTokens: reqInput,
      cachedInputTokens: reqCached,
      totalInputTokens: reqTotalInput,
      outputTokens: reqOutput,
      totalTokens: reqTotal,
      totalTokensIncludingCached: reqTotalIncludingCached,
      reasoningTokens: reqReasoning,
      responseId: null,
    });
  }

  return {
    requests: perRequest.length,
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens,
    totalInputTokens,
    totalTokensIncludingCached,
    reasoningTokens,
    perRequest,
  };
}

function isStreamedRunResult(runResult) {
  return typeof runResult?.toTextStream === 'function' || typeof runResult?.completed?.then === 'function';
}

/**
 * Agents SDK v0.3.4 does not currently aggregate usage into `state.usage` for streaming runs.
 * Additionally, when you use `Agent.asTool()` the nested agent run's usage is aggregated into
 * the shared `RunContext.usage`, but its `rawResponses` are NOT included in the parent result.
 *
 * This helper returns a combined view:
 * - Non-streaming runs: use `state.usage` (includes nested Agent-as-tool calls).
 * - Streaming runs: combine `state.usage` (nested non-streaming tool calls) + `rawResponses` (streaming model calls).
 */
export function getTokenUsageSummary(
  runResult,
  { backfillStateUsage = true, traceChatId = undefined, traceTag = undefined } = {},
) {
  maybeDumpModelResponses(runResult, { chatId: traceChatId, tag: traceTag });

  const rawResponses = runResult?.rawResponses ?? [];
  const stateUsage = runResult?.state?.usage;

  if (!stateUsage) {
    const summary = summarizeModelResponsesUsage(rawResponses);
    void maybeAppendTurnRollup(runResult, { chatId: traceChatId, tag: traceTag, usageSummary: summary });
    return summary;
  }

  const streamed = isStreamedRunResult(runResult);

  // Non-streaming results already include all model calls (including the post-tool "run again") in state.usage.
  // Nested Agent-as-tool calls also contribute to state.usage via the shared RunContext.
  if (!streamed) {
    const summary = summarizeUsageEntries(stateUsage.requestUsageEntries ?? []);
    void maybeAppendTurnRollup(runResult, { chatId: traceChatId, tag: traceTag, usageSummary: summary });
    return summary;
  }

  // Streaming results currently miss usage aggregation for streaming model calls, but `rawResponses` has per-call usage.
  // Meanwhile, nested Agent-as-tool calls (non-streaming) DO contribute to state.usage.
  //
  // If we already backfilled once, state.usage is now authoritative (avoids double counting on repeated calls).
  if (runResult?.state?.__usageBackfilledFromRawResponses) {
    const summary = summarizeUsageEntries(stateUsage.requestUsageEntries ?? []);
    void maybeAppendTurnRollup(runResult, { chatId: traceChatId, tag: traceTag, usageSummary: summary });
    return summary;
  }

  const stateSummary = summarizeUsageEntries(stateUsage.requestUsageEntries ?? []);
  const rawSummary = summarizeModelResponsesUsage(rawResponses);

  const perRequest = [...stateSummary.perRequest];
  const stateRequestCount = perRequest.length;
  for (let i = 0; i < rawSummary.perRequest.length; i += 1) {
    const entry = rawSummary.perRequest[i];
    perRequest.push({ ...entry, requestIndex: stateRequestCount + i + 1 });
  }

  const combined = {
    requests: perRequest.length,
    inputTokens: stateSummary.inputTokens + rawSummary.inputTokens,
    outputTokens: stateSummary.outputTokens + rawSummary.outputTokens,
    totalTokens: stateSummary.totalTokens + rawSummary.totalTokens,
    cachedInputTokens: stateSummary.cachedInputTokens + rawSummary.cachedInputTokens,
    totalInputTokens: stateSummary.totalInputTokens + rawSummary.totalInputTokens,
    totalTokensIncludingCached:
      stateSummary.totalTokensIncludingCached + rawSummary.totalTokensIncludingCached,
    reasoningTokens: stateSummary.reasoningTokens + rawSummary.reasoningTokens,
    perRequest,
  };

  if (backfillStateUsage && runResult?.state?.usage && !runResult.state.__usageBackfilledFromRawResponses) {
    for (const response of rawResponses) {
      if (response?.usage) runResult.state.usage.add(response.usage);
    }
    runResult.state.__usageBackfilledFromRawResponses = true;
  }

  void maybeAppendTurnRollup(runResult, { chatId: traceChatId, tag: traceTag, usageSummary: combined });
  return combined;
}



  export function accumulateTokenTotals(stream, prevTotals = null) {                                                                                                                            
    const rawResponses = Array.isArray(stream?.rawResponses) ? stream.rawResponses : [];                                                                                                        
                                                                                                                                                                                                
    let requests = 0;                                                                                                                                                                           
    let inputTokens = 0;                                                                                                                                                                        
    let outputTokens = 0;                                                                                                                                                                       
    let totalTokens = 0;                                                                                                                                                                        
    let cachedInputTokens = 0;                                                                                                                                                                  
    let reasoningTokens = 0;                                                                                                                                                                    
                                                                                                                                                                                                
    for (const r of rawResponses) {                                                                                                                                                             
      const u = r?.usage;                                                                                                                                                                       
      if (!u) continue;                                                                                                                                                                         
                                                                                                                                                                                                
      requests += 1;                                                                                                                                                                            
      inputTokens += u.inputTokens ?? 0;                                                                                                                                                        
      outputTokens += u.outputTokens ?? 0;                                                                                                                                                      
      totalTokens += u.totalTokens ?? 0;                                                                                                                                                        
                                                                                                                                                                                                
      const details = u.inputTokensDetails;                                                                                                                                                     
      if (Array.isArray(details)) {                                                                                                                                                             
        for (const d of details) cachedInputTokens += d?.cached_tokens ?? 0;                                                                                                                    
      } else if (details && typeof details === "object") {                                                                                                                                      
        cachedInputTokens += details.cached_tokens ?? 0;                                                                                                                                        
      }                                                                                                                                                                                         
                                                                                                                                                                                                
      const outDetails = u.outputTokensDetails;                                                                                                                                                 
      if (Array.isArray(outDetails)) {                                                                                                                                                          
        for (const d of outDetails) reasoningTokens += d?.reasoning_tokens ?? 0;                                                                                                                
      } else if (outDetails && typeof outDetails === "object") {                                                                                                                                
        reasoningTokens += outDetails.reasoning_tokens ?? 0;                                                                                                                                    
      }                                                                                                                                                                                         
    }                                                                                                                                                                                           
                                                                                                                                                                                                
    const turnTotals = {                                                                                                                                                                        
      turns: 1,                                                                                                                                                                                 
      requests,                                                                                                                                                                                 
      inputTokens,                                                                                                                                                                              
      cachedInputTokens,                                                                                                                                                                        
      totalInputTokens: inputTokens + cachedInputTokens,                                                                                                                                        
      outputTokens,                                                                                                                                                                             
      totalTokens,                                                                                                                                                                              
      totalTokensIncludingCached: totalTokens + cachedInputTokens,                                                                                                                              
      reasoningTokens,                                                                                                                                                                          
    };                                                                                                                                                                                          
                                                                                                                                                                                                
    if (!prevTotals) return { totals: turnTotals };                                                                                                                                             
                                                                                                                                                                                                
    const totals = {                                                                                                                                                                            
      turns: (prevTotals.turns ?? 0) + turnTotals.turns,                                                                                                                                        
      requests: (prevTotals.requests ?? 0) + turnTotals.requests,                                                                                                                               
      inputTokens: (prevTotals.inputTokens ?? 0) + turnTotals.inputTokens,                                                                                                                      
      cachedInputTokens: (prevTotals.cachedInputTokens ?? 0) + turnTotals.cachedInputTokens,                                                                                                    
      totalInputTokens: (prevTotals.totalInputTokens ?? 0) + turnTotals.totalInputTokens,                                                                                                       
      outputTokens: (prevTotals.outputTokens ?? 0) + turnTotals.outputTokens,                                                                                                                   
      totalTokens: (prevTotals.totalTokens ?? 0) + turnTotals.totalTokens,                                                                                                                      
      totalTokensIncludingCached:                                                                                                                                                               
        (prevTotals.totalTokensIncludingCached ?? 0) + turnTotals.totalTokensIncludingCached,                                                                                                   
      reasoningTokens: (prevTotals.reasoningTokens ?? 0) + turnTotals.reasoningTokens,                                                                                                          
    };                                                                                                                                                                                          
                                                                                                                                                                                                
    return { totals };                                                                                                                                                                          
  }