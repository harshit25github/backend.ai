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

const allowedDecisions = new Set(['allow', 'warn', 'block']);
const allowedCategories = new Set([
  'travel',
  'competitor',
  'off_topic',
  'personal_info',
  'injection',
  'harmful',
  'illicit',
  'explicit',
]);
const allowedActions = new Set(['proceed', 'request_details', 'redirect', 'block']);

function isStringArrayOrNull(value) {
  if (value === null) return true;
  if (!Array.isArray(value)) return false;
  return value.every((v) => typeof v === 'string');
}

function validateGuardrailOutput(rowIdx, parsed) {
  const requiredKeys = [
    'decision',
    'category',
    'reason',
    'isTravel',
    'hasCompetitor',
    'competitorMentioned',
    'missingSlots',
    'recommendedResponse',
    'actionRequired',
  ];

  for (const key of requiredKeys) {
    assert(Object.hasOwn(parsed, key), `Row ${rowIdx}: output missing key "${key}"`);
  }

  assert(allowedDecisions.has(parsed.decision), `Row ${rowIdx}: invalid decision "${parsed.decision}"`);
  assert(allowedCategories.has(parsed.category), `Row ${rowIdx}: invalid category "${parsed.category}"`);
  assert(typeof parsed.reason === 'string', `Row ${rowIdx}: reason must be string`);
  assert(typeof parsed.isTravel === 'boolean', `Row ${rowIdx}: isTravel must be boolean`);
  assert(typeof parsed.hasCompetitor === 'boolean', `Row ${rowIdx}: hasCompetitor must be boolean`);
  assert(
    isStringArrayOrNull(parsed.competitorMentioned),
    `Row ${rowIdx}: competitorMentioned must be string[] or null`,
  );
  assert(
    isStringArrayOrNull(parsed.missingSlots),
    `Row ${rowIdx}: missingSlots must be string[] or null`,
  );
  assert(
    parsed.recommendedResponse === null || typeof parsed.recommendedResponse === 'string',
    `Row ${rowIdx}: recommendedResponse must be string or null`,
  );
  assert(allowedActions.has(parsed.actionRequired), `Row ${rowIdx}: invalid actionRequired`);

  // Light consistency checks (keep permissive to avoid overfitting validator).
  if (parsed.hasCompetitor) {
    assert(parsed.category === 'competitor', `Row ${rowIdx}: hasCompetitor implies category=competitor`);
    assert(
      Array.isArray(parsed.competitorMentioned) && parsed.competitorMentioned.length > 0,
      `Row ${rowIdx}: hasCompetitor implies competitorMentioned non-empty`,
    );
  } else {
    assert(
      parsed.competitorMentioned === null,
      `Row ${rowIdx}: competitorMentioned must be null when hasCompetitor=false`,
    );
  }

  if (parsed.decision === 'allow') {
    assert(parsed.category === 'travel', `Row ${rowIdx}: allow implies category=travel`);
    assert(
      parsed.actionRequired === 'proceed' || parsed.actionRequired === 'request_details',
      `Row ${rowIdx}: allow implies actionRequired proceed|request_details`,
    );
  }

  if (parsed.actionRequired === 'proceed') {
    assert(parsed.recommendedResponse === null, `Row ${rowIdx}: proceed implies recommendedResponse=null`);
    assert(parsed.missingSlots === null, `Row ${rowIdx}: proceed implies missingSlots=null`);
  }

  if (parsed.actionRequired === 'request_details') {
    assert(
      Array.isArray(parsed.missingSlots) && parsed.missingSlots.length > 0,
      `Row ${rowIdx}: request_details implies missingSlots non-empty`,
    );
    assert(
      typeof parsed.recommendedResponse === 'string' && parsed.recommendedResponse.trim().length > 0,
      `Row ${rowIdx}: request_details implies recommendedResponse string`,
    );
  }

  if (parsed.decision === 'block' && parsed.category !== 'travel') {
    if (parsed.actionRequired === 'redirect') {
      assert(
        typeof parsed.recommendedResponse === 'string' && parsed.recommendedResponse.trim().length > 0,
        `Row ${rowIdx}: redirect implies recommendedResponse string`,
      );
    }
    if (parsed.actionRequired === 'block') {
      assert(
        typeof parsed.recommendedResponse === 'string' && parsed.recommendedResponse.trim().length > 0,
        `Row ${rowIdx}: block implies recommendedResponse string`,
      );
    }
  }
}

function validateRows(filePath, rows) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowIdx = i + 1;

    assert(Array.isArray(row.messages), `Row ${rowIdx}: missing messages[]`);
    assert(row.messages.length === 3, `Row ${rowIdx}: expected exactly 3 messages`);
    assert(row.messages[0]?.role === 'system', `Row ${rowIdx}: messages[0].role must be system`);
    assert(row.messages[1]?.role === 'user', `Row ${rowIdx}: messages[1].role must be user`);
    assert(row.messages[2]?.role === 'assistant', `Row ${rowIdx}: messages[2].role must be assistant`);
    assert(typeof row.messages[0]?.content === 'string', `Row ${rowIdx}: system content must be string`);
    assert(typeof row.messages[1]?.content === 'string', `Row ${rowIdx}: user content must be string`);
    assert(typeof row.messages[2]?.content === 'string', `Row ${rowIdx}: assistant content must be string`);

    let parsed;
    try {
      parsed = JSON.parse(row.messages[2].content);
    } catch (err) {
      throw new Error(`Row ${rowIdx}: assistant content is not valid JSON (${err.message})`);
    }
    assert(parsed && typeof parsed === 'object', `Row ${rowIdx}: assistant JSON must be an object`);

    validateGuardrailOutput(rowIdx, parsed);
  }

  console.log(`OK: ${filePath} (${rows.length} rows)`);
}

function summarize(rows) {
  const counts = new Map();
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.messages?.[2]?.content ?? '{}');
      const c = parsed.category || 'unknown';
      counts.set(c, (counts.get(c) || 0) + 1);
    } catch {
      counts.set('unparseable', (counts.get('unparseable') || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function main() {
  const dirPath = path.dirname(fileURLToPath(import.meta.url));
  const trainPath = path.join(dirPath, 'train.jsonl');
  const validPath = path.join(dirPath, 'valid.jsonl');

  assert(fs.existsSync(trainPath), `Missing ${trainPath}. Run build-gaurdrail-sft-dataset.js first.`);
  assert(fs.existsSync(validPath), `Missing ${validPath}. Run build-gaurdrail-sft-dataset.js first.`);

  const train = readJsonl(trainPath);
  const valid = readJsonl(validPath);

  assert(train.length + valid.length === 70, `Expected 70 total rows, got ${train.length + valid.length}`);
  assert(train.length === 56, `Expected 56 train rows, got ${train.length}`);
  assert(valid.length === 14, `Expected 14 valid rows, got ${valid.length}`);

  validateRows(trainPath, train);
  validateRows(validPath, valid);

  console.log('Train category counts:', summarize(train));
  console.log('Valid category counts:', summarize(valid));
}

main();

