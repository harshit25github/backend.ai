import OpenAI from "openai";
import fs from "fs";


const client = new OpenAI({
});

async function runFineTune() {
  try {
    console.log("Uploading training file...");
    const trainFile = await client.files.create({
      file: fs.createReadStream("train.jsonl"),
      purpose: "fine-tune",
    });
    console.log("Train File ID:", trainFile.id);

    console.log("Uploading validation file...");
    const validFile = await client.files.create({
      file: fs.createReadStream("valid.jsonl"),
      purpose: "fine-tune",
    });
    console.log("Valid File ID:", validFile.id);

    console.log("Starting fine-tuning job...");
    const job = await client.fineTuning.jobs.create({
      model: "gpt-4.1-2025-04-14", // You can replace with gpt-4.1 also
      training_file: trainFile.id,
      validation_file: validFile.id,
      hyperparameters: {
        n_epochs: 2, // small & safe starting point
      },
      suffix: "cheapoair-travel-agent-v1",
    });

    console.log("Fine-tune Job Created!");
    console.log("Job ID:", job.id);
    console.log("Check Dashboard >> https://platform.openai.com")

  } catch (error) {
    console.error("Error:", error);
  }
}

runFineTune();
