import OpenAI from "openai";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";


const client = new OpenAI({
});

async function runFineTune() {
  try {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));

    // Defaults are guardrail SFT files in this folder (avoid accidentally using repo-root train.jsonl).
    const trainPath = process.env.TRAIN_FILE_PATH || path.join(scriptDir, "train.jsonl");
    const validPath = process.env.VALID_FILE_PATH || path.join(scriptDir, "valid.jsonl");

    // Nano base model for supervised fine-tuning (override if needed).
    const baseModel = process.env.FINE_TUNE_BASE_MODEL || "gpt-4.1-nano-2025-04-14";
    const suffix = process.env.FINE_TUNE_SUFFIX || "cheapoair-gaurdrail-nano-v1";
    const nEpochsRaw = process.env.FINE_TUNE_EPOCHS || "2";
    const nEpochs = Number.parseInt(nEpochsRaw, 10);

    if (!Number.isFinite(nEpochs) || nEpochs <= 0) {
      throw new Error(`Invalid FINE_TUNE_EPOCHS="${nEpochsRaw}" (expected positive integer)`);
    }

    if (!fs.existsSync(trainPath)) {
      throw new Error(`Training file not found: ${path.resolve(trainPath)}`);
    }
    if (!fs.existsSync(validPath)) {
      throw new Error(`Validation file not found: ${path.resolve(validPath)}`);
    }

    console.log("Base model:", baseModel);
    console.log("Train file:", path.resolve(trainPath));
    console.log("Valid file:", path.resolve(validPath));
    console.log("Suffix:", suffix);
    console.log("Epochs:", nEpochs);

    console.log("Uploading training file...");
    const trainFile = await client.files.create({
      file: fs.createReadStream(trainPath),
      purpose: "fine-tune",
    });
    console.log("Train File ID:", trainFile.id);

    console.log("Uploading validation file...");
    const validFile = await client.files.create({
      file: fs.createReadStream(validPath),
      purpose: "fine-tune",
    });
    console.log("Valid File ID:", validFile.id);

    console.log("Starting fine-tuning job...");
    const job = await client.fineTuning.jobs.create({
      model: baseModel,
      training_file: trainFile.id,
      validation_file: validFile.id,
      hyperparameters: {
        n_epochs: nEpochs, // small & safe starting point
      },
      suffix,
    });

    console.log("Fine-tune Job Created!");
    console.log("Job ID:", job.id);
    console.log("Check Dashboard >> https://platform.openai.com")

  } catch (error) {
    console.error("Error:", error);
  }
}

runFineTune();
