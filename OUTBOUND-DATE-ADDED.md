# ✅ Outbound Date Field Added

## Changes Made

### 1. Added Current Date Context

**Both Prompts Updated:**
- `DESTINATION_DECIDER_PROMPT_V2`
- `ITINERARY_PLANNER_PROMPT_V2`

**Added at the top:**
```
## CURRENT CONTEXT
**Today's Date:** {{currentDate}}

Use this date as reference when users mention relative dates like "next month", "in 2 weeks", etc.
```

This placeholder `{{currentDate}}` needs to be replaced with the actual current date when the prompt is sent to the AI.

---

### 2. Made outbound_date a Required Field

#### In DESTINATION_DECIDER_PROMPT_V2:

**Added Section (Line 71-73):**
```markdown
**IMPORTANT - Always ask for travel dates:**
- **outbound_date** - When is user planning to travel? (YYYY-MM-DD format)
- If user says relative dates ("next month", "in 2 weeks"), calculate based on {{currentDate}}
```

**Updated STEP 3 (Line 112-113):**
```markdown
- Any trip details mentioned (origin, destination, **outbound_date**, dates, pax, budget, preferences)
- **outbound_date**: If user mentions dates, convert to YYYY-MM-DD format based on {{currentDate}}
```

**Updated Questions (Line 123):**
```markdown
"To help find the perfect destination for you, could you share:
- When are you planning to travel? 📅
- Where you're traveling from? ✈️
...
```

#### In ITINERARY_PLANNER_PROMPT_V2:

**Updated Required Fields (Line 297):**
```markdown
**MUST HAVE:**
- ✅ destination (city/location)
- ✅ outbound_date (starting date in YYYY-MM-DD format)
- ✅ duration_days OR return_date
- ✅ pax (number of travelers)
```

**Added Date Handling Instructions (Line 301-303):**
```markdown
**Date Handling:**
- If user mentions relative dates ("next week", "in December"), calculate based on {{currentDate}}
- Always store dates in YYYY-MM-DD format
```

**Updated STEP 1 Check (Line 313):**
```javascript
IF (destination AND outbound_date AND (duration_days OR return_date) AND pax) are ALL present:
  → Go to STEP 2: Create full itinerary
```

**Updated Checklist (Line 281):**
```markdown
☐ Do I have all REQUIRED fields? (destination, outbound_date, duration/return_date, pax)
```

---

### 3. Updated Examples

**Destination Decider Example 1 (Line 175):**
```markdown
**To help find the perfect destination for you, could you share:**
- When are you planning to travel? 📅  ← ADDED
- Where you're traveling from? ✈️
- Your approximate budget? 💰
```

**Itinerary Planner Example 1 (Line 451):**
```markdown
I'd love to create your Paris itinerary! ✨ To make it perfect for you, I need a couple more details:

- When are you planning to travel to Paris? (starting date) 📅  ← ADDED
- How many days are you planning to stay?
- How many travelers will be on this trip?
```

---

## Implementation Requirements

### Backend Changes Needed:

1. **Replace `{{currentDate}}` placeholder before sending to AI:**
   ```javascript
   const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
   const promptWithDate = DESTINATION_DECIDER_PROMPT_V2.replace(/\{\{currentDate\}\}/g, currentDate);
   ```

2. **Schema Update - Add outbound_date field:**
   ```javascript
   // In enhanced-manager.js or wherever the schema is defined
   summary: z.object({
     ...existing fields...,
     outbound_date: z.string().optional(), // YYYY-MM-DD format
   })
   ```

3. **Date Parsing Logic:**
   The AI should handle converting relative dates (e.g., "next month") to YYYY-MM-DD format based on the current date provided.

---

## Expected Behavior

### Scenario 1: Vague Request
```
User: "I want to travel somewhere"
Agent: "To help find the perfect destination for you, could you share:
        - When are you planning to travel? 📅
        - Where you're traveling from? ✈️
        ..."
```

### Scenario 2: Relative Date
```
User: "I want to go to Paris next month"
Agent: (calculates date based on currentDate)
       Stores: outbound_date: "2025-11-10" (example)
```

### Scenario 3: Specific Date
```
User: "I'm traveling to Tokyo on December 15th"
Agent: Stores: outbound_date: "2025-12-15"
```

### Scenario 4: Date Format Variations
```
User input: "15th December" or "Dec 15" or "12/15"
Agent: Converts to: "2025-12-15" (YYYY-MM-DD)
```

---

## Testing

Run the test script:
```bash
node test-outbound-date.js
```

**Test Cases:**
1. ✅ Agent asks for travel date when not provided
2. ✅ Agent captures and converts relative dates ("next month")
3. ✅ Agent stores dates in YYYY-MM-DD format
4. ✅ Agent includes outbound_date in update_summary call

---

## Why This Helps

1. **Seasonality Awareness:** AI can suggest destinations appropriate for the travel season
2. **Booking Timing:** Can advise on advance booking requirements
3. **Price Estimation:** Can consider peak/off-peak pricing
4. **Event Planning:** Can mention festivals or events happening during travel dates
5. **Weather Forecasting:** Can provide relevant weather information
6. **Availability:** Can warn about holidays or busy periods

---

## Status
✅ **IMPLEMENTED** - outbound_date field added to both prompts

**Date:** 2025-10-10
**Files Modified:**
- `src/ai/prompts-manager.js` (DESTINATION_DECIDER_PROMPT_V2 & ITINERARY_PLANNER_PROMPT_V2)

**Next Step:** Backend implementation to replace {{currentDate}} placeholder
