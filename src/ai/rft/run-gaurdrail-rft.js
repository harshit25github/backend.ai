import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

import gaurdrailAccuracyGrader from './gaurdrail-grader.js';
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function prepareUploadJsonl(inPath, outPath, { keepMetadata }) {
  const raw = fs.readFileSync(inPath, 'utf8');
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const outLines = [];
  for (let i = 0; i < lines.length; i += 1) {
    const row = JSON.parse(lines[i]);
    const messages = row?.messages;
    if (!Array.isArray(messages)) {
      throw new Error(`Invalid JSONL row (missing messages[]) at ${inPath}:${i + 1}`);
    }

    outLines.push(JSON.stringify(keepMetadata ? row : { messages }));
  }

  fs.writeFileSync(outPath, `${outLines.join('\n')}\n`, 'utf8');
}

async function uploadJsonl(filePath) {
  const file = await client.files.create({
    file: fs.createReadStream(filePath),
    purpose: 'fine-tune',
  });
  await client.files.waitForProcessing(file.id);
  return file.id;
}

async function main() {
  requireEnv('OPENAI_API_KEY');

  // Prefer explicit snapshot names; aliases may be rejected for RFT.
  // Note: `gpt-4.1-nano-2025-04-14` is allowed as a grader, but may not be eligible as an RFT base model.
  const baseModel = process.env.RFT_BASE_MODEL || 'gpt-4o-mini-2024-07-18';
  const suffix = process.env.RFT_SUFFIX || 'cheapoair-gaurdrail-rft-v1';

  const dir = path.dirname(fileURLToPath(import.meta.url));
  const trainPath = path.join(dir, 'gaurdrail.rft.train.jsonl');
  const validPath = path.join(dir, 'gaurdrail.rft.valid.jsonl');

  if (!fs.existsSync(trainPath) || !fs.existsSync(validPath)) {
    throw new Error(
      `Missing dataset files. Run: node ${path.join(dir, 'build-gaurdrail-rft-dataset.js')}`,
    );
  }

  const keepMetadata = process.env.RFT_KEEP_METADATA === '1';
  const trainUploadPath = path.join(dir, 'gaurdrail.rft.train.upload.jsonl');
  const validUploadPath = path.join(dir, 'gaurdrail.rft.valid.upload.jsonl');

  prepareUploadJsonl(trainPath, trainUploadPath, { keepMetadata });
  prepareUploadJsonl(validPath, validUploadPath, { keepMetadata });

  console.log('Uploading training file:', trainUploadPath);
  const training_file = await uploadJsonl(trainUploadPath);

  console.log('Uploading validation file:', validUploadPath);
  const validation_file = await uploadJsonl(validUploadPath);

  console.log('Starting reinforcement fine-tuning job...');
  const job = await client.fineTuning.jobs.create({
    model: baseModel,
    training_file,
    validation_file,
    method: {
      type: 'reinforcement',
      reinforcement: {
        grader: gaurdrailAccuracyGrader,
        hyperparameters: {
          n_epochs: 1,
          compute_multiplier: 1,
        },
      },
    },
    suffix,
  });

  console.log('RFT job created:', job.id);
  console.log('Dashboard: https://platform.openai.com/finetune');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
