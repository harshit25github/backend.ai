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

function validateRows(filePath, rows) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    assert(Array.isArray(row.messages), `Row ${i + 1}: missing messages[]`);
    assert(row.messages.length >= 2, `Row ${i + 1}: expected at least 2 messages`);
    assert(typeof row.messages[0]?.role === 'string', `Row ${i + 1}: messages[0].role`);
    assert(typeof row.messages[0]?.content === 'string', `Row ${i + 1}: messages[0].content`);
    assert(typeof row.messages.at(-1)?.content === 'string', `Row ${i + 1}: last message content`);

    assert(row.metadata && typeof row.metadata === 'object', `Row ${i + 1}: missing metadata object`);

    const requiredMetaKeys = [
      'expected_decision',
      'expected_category',
      'expected_action',
      'expected_isTravel',
      'expected_hasCompetitor',
      'expected_missingSlots',
    ];

    for (const key of requiredMetaKeys) {
      assert(typeof row.metadata[key] === 'string', `Row ${i + 1}: metadata.${key} must be string`);
    }
  }

  console.log(`OK: ${filePath} (${rows.length} rows)`);
}

function summarize(rows) {
  const counts = new Map();
  for (const row of rows) {
    const c = row.metadata?.expected_category || 'unknown';
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function main() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const trainPath = path.join(dir, 'gaurdrail.rft.train.jsonl');
  const validPath = path.join(dir, 'gaurdrail.rft.valid.jsonl');

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
