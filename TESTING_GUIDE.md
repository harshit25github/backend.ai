# 🧪 Testing Guide - Baseline & Optimization Comparison

> **Complete guide for performance testing using K6 load testing framework**

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Testing Workflow](#testing-workflow)
4. [Running Baseline Tests](#running-baseline-tests)
5. [Running Optimization Tests](#running-optimization-tests)
6. [Comparing Results](#comparing-results)
7. [Understanding Metrics](#understanding-metrics)
8. [GPT-4.1 Prompting Best Practices](#gpt-41-prompting-best-practices)

---

## Overview

Yeh testing framework aapko help karega:
- **Baseline measurements** lene ke liye (before optimization)
- **Optimized performance** measure karne ke liye (after changes)
- **Side-by-side comparison** karne ke liye
- **Response quality validation** karne ke liye (ensure no degradation)

---

## Prerequisites

### Install K6

```bash
# Windows (using Chocolatey)
choco install k6

# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Verify installation
k6 version
```

### Start Your Server

```bash
# Make sure your backend is running
npm start

# Or if you have a custom start command
node src/server.js

# Verify it's accessible
curl http://localhost:3000/health  # or your health check endpoint
```

---

## Testing Workflow

```
┌─────────────────────────────────────────────────────────┐
│                    TESTING WORKFLOW                     │
└─────────────────────────────────────────────────────────┘

1. RUN BASELINE TESTS (Before any changes)
   ↓
   ├── Test Trip Planning
   ├── Test Flight Search
   ├── Test Modifications
   ├── Test Hotel Search
   ├── Test Quick Questions
   └── Test Vague Destinations
   ↓
   Results saved to: baseline-results/*.json

2. IMPLEMENT OPTIMIZATIONS
   ↓
   ├── Parallel tool calls
   ├── Prompt size reduction
   ├── Predicted outputs
   ├── Context optimization
   └── Other improvements

3. RUN OPTIMIZATION TESTS (After changes)
   ↓
   Same tests as baseline
   ↓
   Results saved to: optimized-results/*.json

4. COMPARE RESULTS
   ↓
   node tests/compare-results.js
   ↓
   Report generated: comparison-report.md
```

---

## Running Baseline Tests

### Step 1: Create Result Directories

```bash
mkdir -p baseline-results optimized-results
```

### Step 2: Run Individual Scenario Tests

**Trip Planning Baseline:**
```bash
k6 run tests/k6-baseline-scenarios.js -e SCENARIO=trip_planning

# Expected output:
# ✓ Trip Planner Agent correctly routed
# ✓ Itinerary with 5 days generated
# Total Duration: ~12000-15000ms (12-15 seconds)
```

**Flight Search Baseline:**
```bash
k6 run tests/k6-baseline-scenarios.js -e SCENARIO=flight_search

# Expected output:
# ✓ Flight Specialist Agent routed
# ✓ IATA codes resolved (DEL, BOM)
# ✓ Flight results returned
# Total Duration: ~8000-10000ms (8-10 seconds)
```

**Modification Baseline (Important for Predicted Outputs):**
```bash
k6 run tests/k6-baseline-scenarios.js -e SCENARIO=modification

# Expected output:
# ✓ Initial 5-day itinerary created
# ✓ Modified to 3-day itinerary
# Total Duration: ~12000-15000ms (12-15 seconds)
# Note: Step 3 (modification) should take similar time as Step 2 (creation)
```

**Hotel Search Baseline:**
```bash
k6 run tests/k6-baseline-scenarios.js -e SCENARIO=hotel_search

# Expected output:
# ✓ Hotel Specialist Agent routed
# ✓ Web search performed
# ✓ Hotel recommendations provided
# Total Duration: ~10000-12000ms (10-12 seconds)
```

**Quick Question Baseline:**
```bash
k6 run tests/k6-baseline-scenarios.js -e SCENARIO=quick_question

# Expected output:
# ✓ Trip Planner Agent routed
# ✓ Quick response (no complex tools)
# Total Duration: ~3000-5000ms (3-5 seconds)
```

**Vague Destination Baseline:**
```bash
k6 run tests/k6-baseline-scenarios.js -e SCENARIO=vague_destination

# Expected output:
# ✓ Agent asks for user location
# ✓ Provides 3-4 destination options
# ✓ Processes user selection
# Total Duration: ~8000-10000ms (8-10 seconds)
```

### Step 3: Run All Scenarios at Once

```bash
# Bash script (Linux/macOS)
for scenario in trip_planning flight_search modification hotel_search quick_question vague_destination; do
  echo "Running baseline for $scenario..."
  k6 run tests/k6-baseline-scenarios.js -e SCENARIO=$scenario
  sleep 2
done

# PowerShell (Windows)
$scenarios = @('trip_planning', 'flight_search', 'modification', 'hotel_search', 'quick_question', 'vague_destination')
foreach ($scenario in $scenarios) {
  Write-Host "Running baseline for $scenario..."
  k6 run tests/k6-baseline-scenarios.js -e SCENARIO=$scenario
  Start-Sleep -Seconds 2
}
```

### Step 4: Verify Baseline Results

```bash
# Check that all baseline files were created
ls baseline-results/

# Expected output:
# trip_planning.json
# flight_search.json
# modification.json
# hotel_search.json
# quick_question.json
# vague_destination.json
```

---

## Running Optimization Tests

### After Implementing Optimizations

**Important:** Run the EXACT same tests, but results will be saved to `optimized-results/` folder.

### Option 1: Manual Save

```bash
# After optimization, run the same tests
k6 run tests/k6-baseline-scenarios.js -e SCENARIO=trip_planning

# Manually move the result
mv baseline-results/trip_planning.json optimized-results/trip_planning.json
```

### Option 2: Modified Script (Recommended)

Create a copy of the test script that saves to optimized-results:

```bash
# Copy the baseline script
cp tests/k6-baseline-scenarios.js tests/k6-optimized-scenarios.js

# Edit k6-optimized-scenarios.js
# Change line: [`baseline-results/${SCENARIO}.json`]: jsonOutput
# To:           [`optimized-results/${SCENARIO}.json`]: jsonOutput
```

Then run:
```bash
k6 run tests/k6-optimized-scenarios.js -e SCENARIO=trip_planning
```

### Run All Optimized Tests

```bash
# Bash
for scenario in trip_planning flight_search modification hotel_search quick_question vague_destination; do
  echo "Running optimized test for $scenario..."
  k6 run tests/k6-optimized-scenarios.js -e SCENARIO=$scenario
  sleep 2
done

# PowerShell
$scenarios = @('trip_planning', 'flight_search', 'modification', 'hotel_search', 'quick_question', 'vague_destination')
foreach ($scenario in $scenarios) {
  Write-Host "Running optimized test for $scenario..."
  k6 run tests/k6-optimized-scenarios.js -e SCENARIO=$scenario
  Start-Sleep -Seconds 2
}
```

---

## Comparing Results

### Generate Comparison Report

```bash
node tests/compare-results.js
```

### Expected Output

```
================================================================================
Optimization Comparison Tool
================================================================================
Created directory: baseline-results
Created directory: optimized-results

✅ Comparison report generated!
   Location: comparison-report.md

trip_planning        | ✅ 45.2% improvement (6780ms saved)
flight_search        | ✅ 52.1% improvement (4312ms saved)
modification         | ✅ 78.3% improvement (9456ms saved)  ← Predicted outputs!
hotel_search         | ✅ 38.7% improvement (4102ms saved)
quick_question       | ✅ 60.5% improvement (2415ms saved)
vague_destination    | ✅ 42.8% improvement (3890ms saved)

================================================================================
```

### View the Report

```bash
# Open the markdown report
cat comparison-report.md

# Or open in your editor
code comparison-report.md  # VS Code
open comparison-report.md  # macOS
```

### Sample Comparison Report

```markdown
# Optimization Results Comparison

**Generated:** 2025-01-10T12:00:00Z

---

## 📊 Overall Summary

- **Scenarios Tested:** 6
- **Scenarios Improved:** 6 (100%)
- **Average Improvement:** 52.9%

## 📈 Detailed Comparisons

### TRIP PLANNING

| Metric | Baseline | Optimized | Improvement |
|--------|----------|-----------|-------------|
| **Total Duration (avg)** | 15000ms | 8220ms | ✅ 45.2% (6780ms) |
| **Total Duration (p95)** | 16500ms | 9100ms | ✅ 44.8% (7400ms) |
| Step 1 Duration | 2500ms | 1800ms | ✅ 28.0% |
| Step 2 Duration | 3000ms | 2200ms | ✅ 26.7% |
| Step 3 Duration | 9500ms | 4220ms | ✅ 55.6% |
| Response Length | 3500 chars | 3480 chars | ✅ 0.6% |
| Itinerary Days Generated | 5.0 | 5.0 | ✅ Same |

### MODIFICATION

| Metric | Baseline | Optimized | Improvement |
|--------|----------|-----------|-------------|
| **Total Duration (avg)** | 12000ms | 2544ms | ✅ 78.8% (9456ms) |
| Step 3 Duration | 9800ms | 1200ms | ✅ 87.8% |  ← Predicted outputs!
| Itinerary Days Generated | 3.0 | 3.0 | ✅ Same |

---

## 💡 Recommendations

✅ **Excellent!** Average improvement of 52.9% achieved. The optimizations are highly effective.

### Response Quality Check

Ensure that response quality (length, itinerary days, etc.) remains consistent:
- Response length should not decrease significantly (indicates content loss)
- Itinerary days should match exactly
- Flight results count should be similar or better
```

---

## Understanding Metrics

### Response Time Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **Total Duration (avg)** | Average time for complete scenario | < 5s (after optimization) |
| **Total Duration (p95)** | 95th percentile (worst case for most users) | < 8s (after optimization) |
| **Total Duration (p99)** | 99th percentile (worst case) | < 10s (after optimization) |
| **Step 1/2/3 Duration** | Individual step timing | Varies by step |

### Quality Metrics

| Metric | Description | Validation |
|--------|-------------|------------|
| **Response Length** | Character count of response | Should remain similar (±10%) |
| **Itinerary Days** | Number of days in generated itinerary | Must match exactly |
| **Flight Results** | Number of flight options returned | Should be ≥ 3 |
| **Suggested Questions** | Count of suggested follow-up questions | Should be 4-6 |

### Success Criteria

✅ **Good Optimization:**
- Response time reduced by 40-50%+
- Response quality unchanged (±10%)
- All checks passing (100% success rate)

⚠️ **Needs Review:**
- Response time improved < 30%
- Response quality degraded > 10%
- Success rate < 90%

❌ **Failed Optimization:**
- Response time not improved or worse
- Response quality significantly degraded
- Success rate < 80%

---

## GPT-4.1 Prompting Best Practices

Based on OpenAI's official GPT-4.1 prompting guide, apply these principles:

### ✅ DO's

**1. Clear Hierarchical Structure**
```javascript
// Good prompt structure
const PROMPT = `
# ROLE AND OBJECTIVE
You are a Trip Planner for cheapoair.com

# INSTRUCTIONS
- Gather trip details (origin, destination, dates, pax)
- Create personalized itineraries
- Call tools to persist data

# REASONING STEPS
1. Check what info is missing
2. Ask for missing details
3. Confirm with user
4. Generate itinerary

# OUTPUT FORMAT
Use markdown with clear sections

# EXAMPLES
[One comprehensive example]
`;
```

**2. Explicit Workflow Instructions**
```javascript
// Step-by-step clarity
"Follow this exact workflow:
STEP 1: Analyze user message
STEP 2: Call update_summary if trip info provided
STEP 3: If all info present, confirm with user
STEP 4: On confirmation, generate itinerary"
```

**3. Tool Descriptions in Schema**
```javascript
// Use tool schema, not prompt
const update_summary = tool({
  name: 'update_summary',
  description: 'Update trip summary with user-provided details',
  parameters: z.object({
    origin: z.string().describe('Origin city name'),
    // ...
  })
});
```

**4. Chain-of-Thought for Complex Tasks**
```javascript
"Before responding:
1. What is the user asking?
2. What information do I have?
3. What information is missing?
4. What tool calls are needed?
5. What should I say to the user?"
```

**5. Use Markdown Headers**
```markdown
## Section 1
### Subsection A
- Bullet point
```

### ❌ DON'Ts

**1. Avoid All-Caps Emphasis**
```javascript
// ❌ Bad
"CRITICAL: YOU MUST CALL update_summary EVERY TIME!!!"

// ✅ Good
"Important: Call update_summary whenever user provides trip details"
```

**2. Don't Over-Explain**
```javascript
// ❌ Bad (verbose)
"You are a specialized travel planning assistant whose primary objective is to help users by creating detailed, personalized trip itineraries through a process of conversational information gathering where you will ask questions to collect the necessary details..."

// ✅ Good (concise)
"Trip Planner: Create personalized itineraries through conversation"
```

**3. Avoid Conflicting Instructions**
```javascript
// ❌ Bad
"Call update_summary for all trip info"
"Only call update_summary when necessary"  // Conflict!

// ✅ Good
"Call update_summary whenever user provides: origin, destination, dates, pax, or budget"
```

**4. Don't Repeat Sample Phrases**
```javascript
// ❌ Bad
"Examples:
- 'Great! Let me help you plan...'
- 'Great! I'd love to help...'
- 'Great! Sounds exciting...'"

// ✅ Good (varied)
"Examples:
- 'Great! Let me help you plan...'
- 'I'd love to help create...'
- 'Sounds exciting! To get started...'"
```

**5. Don't Manually Inject Tools**
```javascript
// ❌ Bad
const prompt = `
Tools available:
- update_summary(origin, dest, dates)
- update_itinerary(days)
`;

// ✅ Good (use SDK)
tools: [update_summary, update_itinerary]
```

---

## Load Testing (Optional)

For stress testing with multiple concurrent users:

```bash
# 10 virtual users for 30 seconds
k6 run --vus 10 --duration 30s tests/k6-load-test.js

# Gradual ramp-up (uses stages from script)
k6 run tests/k6-load-test.js

# Custom stages
k6 run --stage 30s:5,1m:10,30s:20 tests/k6-load-test.js
```

**Interpret Results:**
- `http_req_duration`: Response time distribution
- `http_req_failed`: Error rate (should be < 5%)
- `iterations`: Completed test cycles
- Custom metrics: Tool calls, agent routing, etc.

---

## Troubleshooting

### Issue: Baseline tests failing

**Symptoms:**
```
✗ status 200
✗ has response
```

**Solutions:**
1. Check if server is running: `curl http://localhost:3000/api/chat/message`
2. Check server logs for errors
3. Verify chatId persistence is working
4. Test manually with Postman/curl first

---

### Issue: Optimized tests show regression

**Symptoms:**
```
modification | ❌ -15.2% improvement (slower!)
```

**Possible Causes:**
1. **Prompt too short:** Lost critical instructions
2. **Parallel calls not working:** Check `parallelToolCalls: true`
3. **Predicted outputs misconfigured:** Check prediction format
4. **Cache not working:** Verify cache_control parameter

**Debug Steps:**
1. Review agent logs for tool calling patterns
2. Check if tools are called in parallel (timestamps)
3. Verify prompt still has all critical instructions
4. Test individual optimizations separately

---

### Issue: Response quality degraded

**Symptoms:**
```
Response Length | 3500 chars | 1200 chars | ⚠️ -65.7%
Itinerary Days | 5.0 | 3.0 | ⚠️ Different!
```

**Causes:**
1. **Over-aggressive prompt reduction:** Lost important sections
2. **max_tokens too low:** Response truncated
3. **Tool schema changed:** Missing fields
4. **Predicted outputs wrong:** Bad prediction causing errors

**Fixes:**
1. Review what was removed from prompt
2. Increase max_tokens: `3000` → `5000`
3. Verify tool schemas unchanged
4. Test without predicted outputs first

---

## Next Steps

1. ✅ **Run baseline tests** (before any changes)
2. ✅ **Implement Phase 1 optimizations**
   - Parallel tool calls
   - IATA cache
   - Prompt reduction (careful!)
3. ✅ **Run optimized tests**
4. ✅ **Compare results**
5. ✅ **Verify response quality**
6. ✅ **Deploy to production** (if results are good!)

---

## Summary

```
┌─────────────────────────────────────────┐
│         TESTING CHECKLIST               │
├─────────────────────────────────────────┤
│ ☐ Install k6                           │
│ ☐ Start server                         │
│ ☐ Run all baseline scenarios           │
│ ☐ Verify baseline results              │
│ ☐ Implement optimizations              │
│ ☐ Run all optimized scenarios          │
│ ☐ Compare results                      │
│ ☐ Verify response quality              │
│ ☐ Document findings                    │
│ ☐ Deploy if successful                 │
└─────────────────────────────────────────┘
```

---

**Questions or issues?** Check the troubleshooting section or review individual test output for detailed error messages.

**Good luck with optimization! 🚀**
