# Guardrail RFT (Reinforcement Fine-Tuning)

This folder contains a starter pipeline to reinforcement fine-tune the guardrail model used by `src/ai/gaurdrail.js`.

## 1) Build the dataset

```bash
node src/ai/rft/build-gaurdrail-rft-dataset.js
```

Outputs:
- `src/ai/rft/gaurdrail.rft.train.jsonl`
- `src/ai/rft/gaurdrail.rft.valid.jsonl`

Current size: 70 total examples (56 train / 14 valid).

## 2) Start an RFT job

```bash
set OPENAI_API_KEY=...
set RFT_BASE_MODEL=gpt-4o-mini-2024-07-18
set RFT_GRADER_MODEL=gpt-4.1-2025-04-14
set RFT_SUFFIX=cheapoair-gaurdrail-rft-v1
node src/ai/rft/run-gaurdrail-rft.js
```

Notes:
- If the API rejects `RFT_BASE_MODEL=gpt-4.1-nano`, switch to a fine-tunable small model (e.g. `gpt-4o-mini`) and update `src/ai/gaurdrail.js` to use the returned fine-tuned model name.
- The grader is defined in `src/ai/rft/gaurdrail-grader.js` and scores both classification accuracy and `recommendedResponse` quality.
- By default, `src/ai/rft/run-gaurdrail-rft.js` uploads a sanitized JSONL that contains only `messages` (set `RFT_KEEP_METADATA=1` to upload metadata too).
