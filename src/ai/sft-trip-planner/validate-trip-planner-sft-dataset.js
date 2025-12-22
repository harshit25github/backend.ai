import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function readJsonl(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new Error(`Invalid JSONL at ${filePath}:${idx + 1} (${err.message})`);
      }
    });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const allowedRoles = new Set(['system', 'user', 'assistant', 'tool']);
const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;

function validateTools(rowIdx, tools) {
  assert(Array.isArray(tools), `Row ${rowIdx}: tools must be an array`);
  const names = new Set();
  for (const t of tools) {
    assert(t && typeof t === 'object', `Row ${rowIdx}: tool must be object`);
    assert(t.type === 'function', `Row ${rowIdx}: tool.type must be "function"`);
    assert(t.function && typeof t.function === 'object', `Row ${rowIdx}: tool.function missing`);
    assert(typeof t.function.name === 'string', `Row ${rowIdx}: tool.function.name must be string`);
    names.add(t.function.name);
  }
  assert(names.has('validate_trip_date'), `Row ${rowIdx}: tools must include validate_trip_date`);
  assert(names.has('web_search'), `Row ${rowIdx}: tools must include web_search`);
}

function validateMessages(rowIdx, messages) {
  assert(Array.isArray(messages), `Row ${rowIdx}: messages must be an array`);
  assert(messages.length >= 3, `Row ${rowIdx}: messages must have at least 3 items`);
  assert(messages[0]?.role === 'system', `Row ${rowIdx}: messages[0].role must be system`);
  assert(messages[messages.length - 1]?.role === 'assistant', `Row ${rowIdx}: last message must be assistant`);

  const pendingToolCalls = new Map();
  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i];
    assert(m && typeof m === 'object', `Row ${rowIdx}: messages[${i}] must be object`);
    assert(allowedRoles.has(m.role), `Row ${rowIdx}: messages[${i}].role invalid: ${m.role}`);

    if (m.role === 'system' || m.role === 'user') {
      assert(typeof m.content === 'string', `Row ${rowIdx}: messages[${i}].content must be string`);
    }

    if (m.role === 'assistant') {
      const hasToolCalls = Object.hasOwn(m, 'tool_calls') && m.tool_calls != null;
      if (hasToolCalls) {
        assert(Array.isArray(m.tool_calls), `Row ${rowIdx}: messages[${i}].tool_calls must be array`);
        assert(m.tool_calls.length > 0, `Row ${rowIdx}: messages[${i}].tool_calls must be non-empty`);

        for (const call of m.tool_calls) {
          assert(typeof call?.id === 'string' && call.id, `Row ${rowIdx}: tool_call.id missing`);
          assert(call.type === 'function', `Row ${rowIdx}: tool_call.type must be "function"`);
          assert(call.function && typeof call.function === 'object', `Row ${rowIdx}: tool_call.function missing`);
          assert(
            call.function.name === 'validate_trip_date' || call.function.name === 'web_search',
            `Row ${rowIdx}: unexpected tool name "${call.function.name}"`,
          );
          assert(typeof call.function.arguments === 'string', `Row ${rowIdx}: tool_call.arguments must be string`);
          let parsed;
          try {
            parsed = JSON.parse(call.function.arguments);
          } catch (err) {
            throw new Error(`Row ${rowIdx}: tool_call.arguments is not valid JSON (${err.message})`);
          }

          if (call.function.name === 'validate_trip_date') {
            assert(Object.hasOwn(parsed, 'candidateDate'), `Row ${rowIdx}: validate_trip_date requires candidateDate key (string|null)`);
            assert(Object.hasOwn(parsed, 'eventKeyword'), `Row ${rowIdx}: validate_trip_date requires eventKeyword key (string|null)`);
            assert(Object.hasOwn(parsed, 'todayOverride'), `Row ${rowIdx}: validate_trip_date requires todayOverride key (string|null)`);

            const candidateDate = parsed.candidateDate;
            const eventKeyword = parsed.eventKeyword;
            const todayOverride = parsed.todayOverride;

            assert(
              candidateDate === null || (typeof candidateDate === 'string' && isoDateRe.test(candidateDate)),
              `Row ${rowIdx}: validate_trip_date.candidateDate must be YYYY-MM-DD or null`,
            );
            assert(
              eventKeyword === null || typeof eventKeyword === 'string',
              `Row ${rowIdx}: validate_trip_date.eventKeyword must be string or null`,
            );
            assert(
              todayOverride === null || (typeof todayOverride === 'string' && isoDateRe.test(todayOverride)),
              `Row ${rowIdx}: validate_trip_date.todayOverride must be YYYY-MM-DD or null`,
            );

            const hasCandidateDate = typeof candidateDate === 'string' && isoDateRe.test(candidateDate);
            const hasEventKeyword = typeof eventKeyword === 'string' && eventKeyword.trim().length > 0;
            assert(
              hasCandidateDate || hasEventKeyword,
              `Row ${rowIdx}: validate_trip_date requires candidateDate (YYYY-MM-DD) or eventKeyword`,
            );
          }

          if (call.function.name === 'web_search') {
            assert(typeof parsed?.query === 'string' && parsed.query.trim().length > 0, `Row ${rowIdx}: web_search.query required`);
          }

          pendingToolCalls.set(call.id, { idx: i });
        }
      } else {
        assert(typeof m.content === 'string', `Row ${rowIdx}: assistant message without tool_calls must have content string`);
      }
    }

    if (m.role === 'tool') {
      assert(typeof m.tool_call_id === 'string' && m.tool_call_id, `Row ${rowIdx}: tool_call_id missing`);
      assert(typeof m.content === 'string', `Row ${rowIdx}: tool content must be string`);
      assert(pendingToolCalls.has(m.tool_call_id), `Row ${rowIdx}: tool_call_id not found: ${m.tool_call_id}`);
      pendingToolCalls.delete(m.tool_call_id);
    }
  }

  assert(pendingToolCalls.size === 0, `Row ${rowIdx}: missing tool responses for some tool_calls`);
}

function validateRows(filePath, rows) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowIdx = i + 1;

    assert(row && typeof row === 'object', `Row ${rowIdx}: row must be object`);
    validateTools(rowIdx, row.tools);
    validateMessages(rowIdx, row.messages);
  }

  console.log(`OK: ${filePath} (${rows.length} rows)`);
}

function summarize(rows) {
  let toolCallExamples = 0;
  let multiTurnExamples = 0;
  for (const row of rows) {
    const msgs = Array.isArray(row.messages) ? row.messages : [];
    if (msgs.some((m) => m?.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length > 0)) {
      toolCallExamples += 1;
    }
    if (msgs.length > 3) multiTurnExamples += 1;
  }
  return { toolCallExamples, multiTurnExamples };
}

function main() {
  const dirPath = path.dirname(fileURLToPath(import.meta.url));
  const trainPath = path.join(dirPath, 'train.jsonl');
  const validPath = path.join(dirPath, 'valid.jsonl');

  assert(fs.existsSync(trainPath), `Missing ${trainPath}. Run build-trip-planner-sft-dataset.js first.`);
  assert(fs.existsSync(validPath), `Missing ${validPath}. Run build-trip-planner-sft-dataset.js first.`);

  const train = readJsonl(trainPath);
  const valid = readJsonl(validPath);

  assert(train.length + valid.length === 80, `Expected 80 total rows, got ${train.length + valid.length}`);
  assert(train.length === 64, `Expected 64 train rows, got ${train.length}`);
  assert(valid.length === 16, `Expected 16 valid rows, got ${valid.length}`);

  validateRows(trainPath, train);
  validateRows(validPath, valid);

  console.log('Train summary:', summarize(train));
  console.log('Valid summary:', summarize(valid));
}

main();
