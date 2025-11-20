# Fine-Tuning Guide for Trip Planner Agent

## 🎯 Purpose

Fine-tune the Trip Planner Agent to fix **3 critical edge cases**:

1. **Date Validation**: Only accept future dates within 1 year
2. **Missing Itinerary**: Always create itinerary when all 6 fields are present
3. **Budget Confusion**: Correctly understand "per person" vs "total" budget

## 📋 Prerequisites

- OpenAI API key set in `.env`
- Node.js installed
- Training data generated

## 🚀 Step-by-Step Process

### Step 1: Generate Training Data

```bash
node src/ai/generate-training-data.js
```

**Output:**
- `train.jsonl` - 5 training examples
- `valid.jsonl` - 2 validation examples

**Focus Areas:**
- ✅ Date validation (3 examples)
- ✅ Missing itinerary (1 example)
- ✅ Budget capturing (3 examples)

### Step 2: Validate Training Data

Check that files exist and have correct format:

```bash
# Check files
ls -lh *.jsonl

# Preview first example
head -n 1 train.jsonl | python -m json.tool
```

### Step 3: Run Fine-Tuning

```bash
node src/ai/fine-tuning.js
```

**What happens:**
1. Uploads `train.jsonl` to OpenAI
2. Uploads `valid.jsonl` to OpenAI
3. Creates fine-tuning job
4. Prints job ID and dashboard link

**Example output:**
```
Uploading training file...
Train File ID: file-abc123
Uploading validation file...
Valid File ID: file-xyz789
Starting fine-tuning job...
Fine-tune Job Created!
Job ID: ftjob-123456
Check Dashboard >> https://platform.openai.com
```

### Step 4: Monitor Fine-Tuning Progress

Visit https://platform.openai.com/finetune

**Timeline:**
- Upload: ~1-2 minutes
- Training: ~20-60 minutes (depends on data size)
- Status: Check dashboard for progress

**Job statuses:**
- `validating_files` → Files being validated
- `running` → Training in progress
- `succeeded` → ✅ Fine-tuning complete!
- `failed` → ❌ Check error message

### Step 5: Get Your Fine-Tuned Model

Once status = `succeeded`, you'll get a model ID like:

```
ft:gpt-4.1-mini-2024-11-05:your-org:cheapoair-travel-agent-v1:AbCdEf
```

### Step 6: Update Your Agent

Edit `src/ai/multiAgentSystem.js`:

```javascript
// BEFORE:
export const tripPlannerAgent = new Agent({
  name: 'Trip Planner Agent',
  model: 'gpt-4.1',  // ← Base model
  // ...
});

// AFTER:
export const tripPlannerAgent = new Agent({
  name: 'Trip Planner Agent',
  model: 'ft:gpt-4.1-mini-2024-11-05:your-org:cheapoair-travel-agent-v1:AbCdEf',  // ← Your fine-tuned model
  // ...
});
```

### Step 7: Test Fine-Tuned Agent

Test the 3 edge cases:

**Test 1: Past Date (should reject)**
```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "test-date-validation",
    "message": "Plan 5-day Dubai trip from Delhi, 2 people, January 1, 2024, ₹60k per person"
  }'
```

**Expected:** Agent should reject past date and suggest future dates

---

**Test 2: All 6 Fields Present (should create itinerary immediately)**
```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "test-itinerary-creation",
    "message": "Plan 4-day Singapore trip from Chennai, 3 people, March 15, 2026, ₹45k per person"
  }'
```

**Expected:** Agent should create full day-by-day itinerary immediately (not ask for confirmation)

---

**Test 3: Budget Ambiguity (should ask for clarification)**
```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "test-budget-clarity",
    "message": "Kerala trip from Bangalore, 5 days, 3 people, April 10, 2026, budget ₹80,000"
  }'
```

**Expected:** Agent should ask "Is this ₹80k per person or total for 3 people?"

## 📊 Training Data Details

### Example Breakdown

**Date Validation Examples (3):**
1. Past date (2024) → Reject and suggest future
2. Date >1 year away (2028) → Suggest within 12 months
3. Valid future date → Create itinerary immediately

**Missing Itinerary Examples (1):**
1. All 6 fields present → Create full itinerary (no confirmation)

**Budget Capturing Examples (3):**
1. "₹25k per person" with 4 people → Calculate total as ₹1,00,000
2. "₹1.5L total" for 5 people → Calculate per-person as ₹30,000
3. Ambiguous "₹80k" → Ask for clarification

### Sample Training Example

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are TripPlanner... [full system prompt]"
    },
    {
      "role": "user",
      "content": "Plan 5-day Dubai trip, 2 people, January 10, 2024, ₹60k/person"
    },
    {
      "role": "assistant",
      "content": "I notice January 10, 2024 is in the past. Let me help plan for future! Suggested months: March-April 2026..."
    }
  ]
}
```

## 💰 Cost Estimation

**Training Cost (gpt-4.1-mini):**
- ~7 examples × avg 500 tokens each = ~3,500 training tokens
- 2 epochs × 3,500 = 7,000 tokens
- Cost: ~$0.10-0.20 USD (very cheap!)

**Inference Cost:**
- Base model: $X per 1M tokens
- Fine-tuned model: Slightly higher, but better quality

## 🐛 Troubleshooting

### Error: "Training file must have at least 10 examples"

OpenAI requires minimum 10 examples. Update `generate-training-data.js` to add more:

```javascript
// Add more diverse examples
const moreExamples = [
  // Add 3-5 more date validation examples
  // Add 2-3 more itinerary examples
  // Add 2-3 more budget examples
];

const allTrainingExamples = [
  ...dateValidationExamples,
  ...missingItineraryExamples,
  ...budgetCapturingExamples,
  ...moreExamples  // ← Add this
];
```

### Error: "Invalid JSON format"

Validate JSONL format:

```bash
# Each line should be valid JSON
head -n 1 train.jsonl | python -m json.tool
```

### Fine-tuning job failed

Check dashboard for error message. Common issues:
- Invalid format
- Insufficient examples
- API quota exceeded

## 📈 Expected Improvements

**Before Fine-Tuning:**
- ❌ Accepts past dates sometimes
- ❌ Asks "shall I create itinerary?" even with all fields
- ❌ Confused by "₹80k" (per person vs total?)

**After Fine-Tuning:**
- ✅ Always rejects past dates + suggests future
- ✅ Creates itinerary immediately when has all 6 fields
- ✅ Asks for clarification on ambiguous budgets

## 🔄 Iteration Process

1. **Test fine-tuned model** with edge cases
2. **Identify remaining issues**
3. **Add more training examples** for those cases
4. **Re-run fine-tuning** (new version)
5. **Compare versions** in dashboard

## 📚 Resources

- [OpenAI Fine-Tuning Guide](https://platform.openai.com/docs/guides/fine-tuning)
- [Fine-Tuning Dashboard](https://platform.openai.com/finetune)
- Your training data: `train.jsonl`, `valid.jsonl`
- Your fine-tuning script: `src/ai/fine-tuning.js`

## ✅ Checklist

- [ ] Generate training data
- [ ] Validate JSONL format
- [ ] Set OPENAI_API_KEY in .env
- [ ] Run fine-tuning script
- [ ] Monitor dashboard
- [ ] Get fine-tuned model ID
- [ ] Update agent model in code
- [ ] Test all 3 edge cases
- [ ] Deploy to production

---

**Ready to fine-tune?** Run: `node src/ai/fine-tuning.js`
