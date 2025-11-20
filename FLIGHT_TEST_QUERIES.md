# Flight Agent Test Queries

Run these in the playground: `npm run flight:playground`

---

## 1. Children Ages Validation ✅

### Test 1.1: Single Child Without Age
```
Find flights from Delhi to Mumbai for 2 adults and 1 child on January 15, 2026
```
**Expected**: Agent asks "What is the age of the child?"
**Then respond**: `5 years old`
**Expected**: Shows flights with children=1, childrenAges=[5]

### Test 1.2: Multiple Children Without Ages
```
Search flights from Bangalore to Goa for 1 adult and 3 children
```
**Expected**: Agent asks "What are the ages of the 3 children?"
**Then respond**: `Ages 6, 9, and 12`
**Expected**: Shows flights with children=3, childrenAges=[6,9,12]

---

## 2. Lap Infant Validation (Max 1 per Adult/Senior) ❌

### Test 2.1: Valid Lap Infant Configuration
```
Book flights from Mumbai to Delhi for 2 adults and 2 lap infants
```
**Expected**: ✅ Proceeds (2 adults can have 2 lap infants)

### Test 2.2: Invalid - Too Many Lap Infants
```
Find flights for 1 adult and 2 lap infants from Delhi to Kolkata
```
**Expected**: ❌ Tool blocks with message:
"Maximum 1 lap infant per adult/senior passenger. Options: Add another adult OR reduce to 1 lap infant OR convert to seat infant"

### Test 2.3: Invalid - Lap Infant Without Adult
```
Search flights for 1 lap infant from Chennai to Hyderabad
```
**Expected**: ❌ Tool blocks: "Lap infants require at least one adult or senior"

---

## 3. Seat Infant Validation (Max 2 per Adult/Senior) ❌

### Test 3.1: Valid Seat Infant Configuration
```
Find flights for 1 adult and 2 seat infants from Delhi to Mumbai
```
**Expected**: ✅ Proceeds (1 adult can have 2 seat infants)

### Test 3.2: Invalid - Too Many Seat Infants
```
Book flights for 1 adult and 3 seat infants from Bangalore to Chennai
```
**Expected**: ❌ Tool blocks:
"Maximum 2 seat infants per adult/senior. You have 3 seat infants with 1 adult. Add more adults or reduce seat infants"

### Test 3.3: Valid - Multiple Adults with Seat Infants
```
Search flights for 3 adults and 5 seat infants from Mumbai to Goa
```
**Expected**: ✅ Proceeds (3 adults × 2 = 6 max, using 5)

---

## 4. Children Validation (Max 8 per Adult/Senior) ❌

### Test 4.1: Valid - 8 Children with 1 Adult
```
Find flights for 1 adult and 8 children ages 5,6,7,8,9,10,11,12 from Delhi to Jaipur
```
**Expected**: ✅ Proceeds (exactly at limit)

### Test 4.2: Invalid - 9 Children with 1 Adult
```
Search flights for 1 adult and 9 children from Mumbai to Pune
```
**Expected**: ❌ Tool blocks before asking for ages:
"Maximum 8 children per adult/senior. You have 9 children with 1 adult. Add more adults or reduce children"

### Test 4.3: Valid - 15 Children with 2 Adults
```
Book flights for 2 adults and 15 children ages 3,4,5,6,7,8,9,10,11,12,13,14,15,3,4 from Delhi to Bangalore
```
**Expected**: ✅ Proceeds (2 adults × 8 = 16 max, using 15)

---

## 5. Combined Complex Scenarios 🔥

### Test 5.1: Large Family with Mixed Ages
```
Find flights from Delhi to Dubai for 2 adults, 1 senior, 4 children, 1 seat infant, and 1 lap infant on February 10, 2026
```
**Expected**: Agent asks for children ages
**Respond**: `Ages 5, 8, 10, and 14`
**Expected**: ✅ Proceeds
- 3 total supervising adults (2 adults + 1 senior)
- 4 children ≤ 24 max (3×8)
- 1 seat infant ≤ 6 max (3×2)
- 1 lap infant ≤ 3 max (3×1)

### Test 5.2: Complex Invalid - Mixed Violations
```
Search flights for 1 adult, 10 children, and 2 lap infants from Mumbai to London
```
**Expected**: ❌ Tool blocks with children violation first:
"Maximum 8 children per adult. You have 10 children with 1 adult"

### Test 5.3: Edge Case - Only Seniors
```
Find flights for 2 seniors and 3 children ages 6,9,12 from Bangalore to Kochi
```
**Expected**: ✅ Proceeds (seniors count as supervisors)

---

## 6. Filters & Preferences ✨

### Test 6.1: Direct Flights Only
```
Find direct flights from Delhi to Mumbai for 2 adults on March 5, 2026
```
**Expected**: Sets directFlightOnly=true

### Test 6.2: Preferred Airlines
```
Search flights for 2 adults from Mumbai to Bangalore, prefer IndiGo and Air India
```
**Expected**: Sets preferredAirlines=["6E", "AI"]

### Test 6.3: Business Class
```
Find business class flights for 1 adult from Delhi to New York on April 15, 2026
```
**Expected**: Sets cabinClass="business"

---

## 7. Modification Tests 🔄

### Test 7.1: Change Child Count (Should Trigger Re-search)
```
# First search
Find flights for 2 adults and 1 child from Delhi to Mumbai

# Agent asks for age, you respond:
Age 7

# Then modify:
Actually, make it 2 children
```
**Expected**: Agent asks "What are the ages of the 2 children?"
**Then you respond**: `7 and 10`
**Expected**: New search with children=2, childrenAges=[7,10]

### Test 7.2: Change Date
```
# After seeing results:
Change the date to January 20, 2026
```
**Expected**: New search with updated date

### Test 7.3: Add Lap Infant
```
# After initial search for 2 adults:
Add 1 lap infant
```
**Expected**: New search with lapInfants=1

---

## 8. Error Recovery 🔧

### Test 8.1: Invalid Age Provided
```
Find flights for 2 adults and 1 child from Delhi to Mumbai

# Agent asks for age, you respond:
Age 2
```
**Expected**: Tool should accept (but note: age 2 is infant, not child 3-15)
This tests if ages are validated against child range

### Test 8.2: Fixing Lap Infant Violation
```
# First request:
Find flights for 1 adult and 2 lap infants

# Agent shows error, you respond:
Add another adult
```
**Expected**: New search with adults=2, lapInfants=2 ✅

---

## 9. Full Journey Test 🎯

```
USER: Find flights from Delhi to London for a family trip

AGENT: I'd be happy to help! Could you tell me:
- How many travelers? (adults, children, seniors, infants)
- What dates?

USER: 2 adults, 3 children, and 1 baby on lap. March 15, 2026

AGENT: What are the ages of the 3 children?

USER: 5, 8, and 11 years old

AGENT: [Searches and shows results]

USER: Make it business class and direct flights only

AGENT: [New search with cabin_class=business, direct_flight_only=true]

USER: /save

AGENT: ✅ Conversation history saved

USER: /context

AGENT: [Shows full context with all parameters]
```

---

## 10. Rapid Fire Edge Cases ⚡

1. `Find flights for 0 adults and 3 children` → ❌ Needs adult
2. `Book for 5 seniors and 10 lap infants` → ❌ Max 5 (1 per senior)
3. `Search for 1 adult, 1 senior, 16 children` → ✅ Valid (2×8=16)
4. `Find for 10 adults` → ✅ Valid (no dependents)
5. `Book for 1 senior, 2 seat infants, 1 lap infant` → ✅ Valid (all within limits)

---

## Commands to Use During Testing

- `/history` - View conversation
- `/context` - Check current state
- `/save` - Save conversation to file
- `/clear` - Reset and start fresh
- `/exit` - Exit playground

---

## Expected Outcomes Summary

✅ **Should Allow:**
- Valid passenger configurations within limits
- Modification requests (triggers new search)
- Filter applications (direct, airlines, cabin)
- Multiple children with ages provided

❌ **Should Block:**
- Lap infants > adults+seniors (1:1 ratio)
- Seat infants > (adults+seniors)×2
- Children > (adults+seniors)×8
- Children without ages
- Any dependents without adult/senior

🔄 **Should Trigger Re-search:**
- Any parameter modification
- Adding/removing passengers
- Changing dates, class, filters

---

Run these tests and verify the agent:
1. Asks for children ages when missing
2. Blocks invalid passenger configurations
3. Re-searches on modifications
4. Saves history with `/save`
