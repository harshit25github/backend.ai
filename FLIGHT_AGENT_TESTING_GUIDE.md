# Flight Agent Testing Guide - GPT-4.1 Optimized Prompt

## ✅ Prompt Validation Results

**Status:** ✅ **PASSED** (37/37 tests, 100%)

The GPT-4.1 optimized flight prompt has been validated and includes:
- ✅ All 7 required sections (Role, Context, Reasoning, Instructions, Format, Examples, Reminders)
- ✅ 5-step reasoning framework
- ✅ Type A/B/C/D request classification system
- ✅ Parameter comparison table for modification detection
- ✅ Final reminders (instruction reinforcement - GPT-4.1 best practice)
- ✅ Context Snapshot integration
- ✅ Tool usage rules
- ✅ 5 complete examples

## 📋 Manual Testing Scenarios

Since automated testing hit API timeouts, use these manual test scenarios with your UI/API:

### Test 1: Initial Search - Roundtrip Economy
**Input:**
```
Find flights from Delhi to Mumbai on January 20, 2026, returning January 25, 2026, 2 passengers, economy class
```

**Expected Behavior:**
- ✅ Agent should classify as **TYPE B (New Search)**
- ✅ Should call `web_search` to get IATA codes (DEL, BOM)
- ✅ Should call `flight_search` with:
  - origin_iata="DEL"
  - destination_iata="BOM"
  - outbound_date="2026-01-20"
  - return_date="2026-01-25"
  - pax=2
  - cabin_class="economy"
  - trip_type="roundtrip"
- ✅ Should present 3-5 flight options with proper formatting
- ✅ Should NOT mention tool names like "web_search" or "flight_search"

**Verify Context After:**
```javascript
flight.tripType === "roundtrip"
flight.cabinClass === "economy"
summary.pax === 2
summary.outbound_date === "2026-01-20"
summary.return_date === "2026-01-25"
flight.searchResults.length > 0
```

---

### Test 2: Modification - Change to One-Way
**Input:**
```
Change it to one-way
```

**Expected Behavior:**
- ✅ Agent should classify as **TYPE A (Modification)**
- ✅ Should detect trip_type changed from "roundtrip" to "oneway"
- ✅ Should call `flight_search` again with:
  - trip_type="oneway" (NEW)
  - All other parameters from context (origin_iata, destination_iata, outbound_date, pax, cabin_class)
  - Should remove return_date
- ✅ Should present NEW one-way flight options
- ✅ Should NOT present old roundtrip results

**Verify Context After:**
```javascript
flight.tripType === "oneway"  // CHANGED
flight.cabinClass === "economy"  // SAME
summary.pax === 2  // SAME
summary.outbound_date === "2026-01-20"  // SAME
summary.return_date === null  // REMOVED
flight.searchResults.length > 0  // NEW RESULTS
```

---

### Test 3: Modification - Change to Business Class
**Input:**
```
Show business class instead
```

**Expected Behavior:**
- ✅ Agent should classify as **TYPE A (Modification)**
- ✅ Should detect cabin_class changed from "economy" to "business"
- ✅ Should call `flight_search` again with:
  - cabin_class="business" (NEW)
  - All other parameters from context
- ✅ Should present NEW business class flight options

**Verify Context After:**
```javascript
flight.tripType === "oneway"  // SAME
flight.cabinClass === "business"  // CHANGED
summary.pax === 2  // SAME
summary.outbound_date === "2026-01-20"  // SAME
flight.searchResults.length > 0  // NEW RESULTS
```

---

### Test 4: Modification - Change Date
**Input:**
```
What about January 22 instead?
```

**Expected Behavior:**
- ✅ Agent should classify as **TYPE A (Modification)**
- ✅ Should detect outbound_date changed
- ✅ Should call `flight_search` again with:
  - outbound_date="2026-01-22" (NEW)
  - All other parameters from context
- ✅ Should present flights for January 22

**Verify Context After:**
```javascript
flight.tripType === "oneway"  // SAME
flight.cabinClass === "business"  // SAME
summary.pax === 2  // SAME
summary.outbound_date === "2026-01-22"  // CHANGED
flight.searchResults.length > 0  // NEW RESULTS
```

---

### Test 5: Modification - Change Passenger Count
**Input:**
```
Make it 3 passengers
```

**Expected Behavior:**
- ✅ Agent should classify as **TYPE A (Modification)**
- ✅ Should detect pax changed from 2 to 3
- ✅ Should call `flight_search` again with:
  - pax=3 (NEW)
  - All other parameters from context
- ✅ Should present flights for 3 passengers

**Verify Context After:**
```javascript
flight.tripType === "oneway"  // SAME
flight.cabinClass === "business"  // SAME
summary.pax === 3  // CHANGED
summary.outbound_date === "2026-01-22"  // SAME
flight.searchResults.length > 0  // NEW RESULTS
```

---

### Test 6: Information Request - No Modification
**Input:**
```
Which flight is the fastest?
```

**Expected Behavior:**
- ✅ Agent should classify as **TYPE C (Information Request)**
- ✅ Should NOT call `flight_search` again
- ✅ Should answer using existing flight.searchResults from context
- ✅ Should identify the flight with minimum duration_minutes
- ✅ Should present that specific flight's details

**Verify Context After:**
```javascript
// Context should remain UNCHANGED
flight.tripType === "oneway"
flight.cabinClass === "business"
summary.pax === 3
summary.outbound_date === "2026-01-22"
flight.searchResults.length > 0  // SAME RESULTS (not updated)
```

---

### Test 7: Modification - Back to Economy
**Input:**
```
Show economy class options
```

**Expected Behavior:**
- ✅ Agent should classify as **TYPE A (Modification)**
- ✅ Should detect cabin_class changed back to "economy"
- ✅ Should call `flight_search` again
- ✅ Should present NEW economy class flights

**Verify Context After:**
```javascript
flight.cabinClass === "economy"  // CHANGED BACK
```

---

### Test 8: Modification - Back to Roundtrip
**Input:**
```
Make it roundtrip returning January 27
```

**Expected Behavior:**
- ✅ Agent should classify as **TYPE A (Modification)**
- ✅ Should detect trip_type changed to "roundtrip" and return_date added
- ✅ Should call `flight_search` again with:
  - trip_type="roundtrip" (NEW)
  - return_date="2026-01-27" (NEW)
  - All other parameters from context
- ✅ Should present NEW roundtrip flights

**Verify Context After:**
```javascript
flight.tripType === "roundtrip"  // CHANGED BACK
summary.return_date === "2026-01-27"  // ADDED
```

---

## 🔍 What to Check During Testing

### 1. Modification Detection
- ✅ Agent correctly identifies when user wants to change a parameter
- ✅ Agent calls `flight_search` with updated value + existing values
- ✅ Agent presents NEW results, not old cached results
- ✅ Context is updated with new parameters

### 2. Tool Usage
- ✅ Agent uses `web_search` to find IATA codes before `flight_search`
- ✅ Agent NEVER mentions "web_search" or "flight_search" to user
- ✅ Agent works silently behind the scenes

### 3. Data Presentation
- ✅ Agent presents ONLY real data from flight.searchResults
- ✅ Agent uses proper markdown formatting (bullets, headers, bold)
- ✅ Agent includes all required flight details (price, time, duration, etc.)
- ✅ If searchResults is empty, agent says "No flights found"

### 4. Context Persistence
- ✅ Context is saved after each interaction
- ✅ Subsequent requests can access previous search parameters
- ✅ Modifications use existing parameters correctly

### 5. User Experience
- ✅ Agent responds naturally and conversationally
- ✅ Agent doesn't show internal thinking process
- ✅ Agent asks for ALL missing info at once (not one by one)
- ✅ Agent guides users to book on CheapOair.com

---

## 🐛 Common Issues to Watch For

### ❌ Issue 1: Agent presents old results after modification
**Symptom:** User says "change to one-way" but agent shows the same roundtrip results

**Root Cause:** Agent classified as TYPE C (info request) instead of TYPE A (modification)

**Fix:** The new prompt has explicit keyword detection and parameter comparison to prevent this

---

### ❌ Issue 2: Agent doesn't call flight_search for modifications
**Symptom:** User changes cabin class but no new search happens

**Root Cause:** Agent didn't follow Step 3 (Parameter Comparison)

**Fix:** The new prompt has a comparison table and explicit "IF ANY = YES → call flight_search" rule

---

### ❌ Issue 3: Agent mentions tool names
**Symptom:** Agent says "Let me search using web_search..." or "I'll call flight_search now"

**Root Cause:** User-facing behavior rules not followed

**Fix:** The new prompt has multiple reminders to NEVER mention tool names

---

### ❌ Issue 4: Agent asks for info one by one
**Symptom:**
- Agent: "Where are you flying from?"
- User: "Delhi"
- Agent: "Where to?"
- User: "Mumbai"
(Multiple back-and-forth)

**Root Cause:** Agent not asking for ALL missing info at once

**Fix:** The new prompt has explicit TYPE D workflow: "Ask for ALL missing info in ONE message"

---

## 📊 Success Metrics

After testing all 8 scenarios, count:

- ✅ **Modification Detection Rate:** X/5 modifications correctly detected
- ✅ **Re-search Accuracy:** X/5 modifications triggered new flight_search calls
- ✅ **Context Accuracy:** X/8 tests had correct context values
- ✅ **Tool Silence:** X/8 tests had no tool name mentions
- ✅ **Data Presentation:** X/8 tests used real searchResults data

**Target:** 100% across all metrics

---

## 📝 Testing Checklist

Before each test:
- [ ] Clear previous context or use new chat ID
- [ ] Verify API is working (not timeout)

During test:
- [ ] Note agent's classification (Type A/B/C/D)
- [ ] Check if flight_search was called (look for console logs)
- [ ] Read agent's response for tool name mentions
- [ ] Verify response formatting (markdown, bullets, etc.)

After test:
- [ ] Check context values match expectations
- [ ] Verify searchResults was updated (for modifications)
- [ ] Confirm no old data presented

---

## 🎯 Expected Results Summary

If the GPT-4.1 optimized prompt is working correctly:

✅ **Test 1-8:** All should PASS
✅ **Modification Detection:** 100% (5/5 modifications detected)
✅ **Re-search Accuracy:** 100% (5/5 triggered new searches)
✅ **Tool Silence:** 100% (0/8 mentioned tool names)
✅ **Context Persistence:** 100% (all values correct)

---

## 🚀 Next Steps

1. **Run Manual Tests:** Use your UI/API to test scenarios 1-8
2. **Document Results:** Note which tests pass/fail
3. **Report Issues:** If any test fails, note:
   - Which test failed
   - What the agent did wrong
   - What the context values were
   - Full agent response
4. **Iterate if Needed:** If issues found, we can refine the prompt further

---

## 📞 Support

If you encounter issues during testing:
1. Check the console logs for `[flight_search]` calls
2. Inspect the saved context file in `data/contexts/`
3. Verify the prompt is using the v2 version (15,382 characters)
4. Ensure `multiAgentSystem.js` includes flight context in snapshot (lines 273-280)

---

**Prompt Version:** GPT-4.1 Optimized v2
**Last Updated:** 2025-11-03
**Validation Status:** ✅ PASSED (37/37 tests)
