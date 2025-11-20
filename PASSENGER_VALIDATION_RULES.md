# Passenger Validation Rules - Flight Search Tool

## Overview
The `flight_search` tool now includes strict passenger validation rules that match airline industry requirements. These validations run **before** any API call and immediately return detailed error messages if rules are violated.

---

## 🚨 Critical Validation Rules

### Rule 1: Lap Infants
**Requirement**: Lap infants require adult/senior supervision with strict ratio limits

#### Conditions
- ✅ **Must have**: At least 1 adult OR senior present
- ✅ **Maximum ratio**: 1 lap infant per adult/senior passenger
- ✅ **Calculation**: `lapInfants <= (adults + seniors)`

#### Valid Examples
```javascript
✅ { adults: 1, lapInfants: 1 }
✅ { adults: 2, lapInfants: 2 }
✅ { seniors: 1, lapInfants: 1 }
✅ { adults: 1, seniors: 1, lapInfants: 2 }
```

#### Invalid Examples
```javascript
❌ { adults: 0, lapInfants: 1 }          // No adult/senior
❌ { adults: 1, lapInfants: 2 }          // 2 infants > 1 adult (ratio violated)
❌ { adults: 2, lapInfants: 3 }          // 3 infants > 2 adults
```

#### Error Message
```
❌ Passenger Validation Failed: Maximum 1 lap infant per adult/senior passenger.

📋 Current Configuration:
- Lap Infants: 2
- Adults + Seniors: 1

✅ Airline Requirement: Each lap infant must sit on the lap of one adult or senior.

Please either:
1. Reduce lap infants to 1 or fewer, OR
2. Add 1 more adult/senior passenger(s), OR
3. Convert some lap infants to seat infants (with their own seat)
```

---

### Rule 2: Seat Infants
**Requirement**: Seat infants require adult/senior supervision with ratio limits

#### Conditions
- ✅ **Must have**: At least 1 adult OR senior present
- ✅ **Maximum ratio**: 2 seat infants per adult/senior passenger
- ✅ **Calculation**: `seatInfants <= (adults + seniors) * 2`

#### Valid Examples
```javascript
✅ { adults: 1, seatInfants: 1 }
✅ { adults: 1, seatInfants: 2 }
✅ { adults: 2, seatInfants: 4 }
✅ { seniors: 1, seatInfants: 2 }
✅ { adults: 1, seniors: 1, seatInfants: 4 }
```

#### Invalid Examples
```javascript
❌ { adults: 0, seatInfants: 1 }         // No adult/senior
❌ { adults: 1, seatInfants: 3 }         // 3 infants > 2 max per adult
❌ { adults: 2, seatInfants: 5 }         // 5 infants > 4 max (2 adults * 2)
```

#### Error Message
```
❌ Passenger Validation Failed: Maximum 2 seat infants per adult/senior passenger.

📋 Current Configuration:
- Seat Infants: 3
- Adults + Seniors: 1
- Maximum Allowed Seat Infants: 2

✅ Airline Requirement: Each adult or senior can accompany up to 2 seat infants.

Please either:
1. Reduce seat infants to 2 or fewer, OR
2. Add 1 more adult/senior passenger(s)
```

---

### Rule 3: Children
**Requirement**: Children require adult/senior supervision, ratio limits, and individual ages

#### Conditions
- ✅ **Must have**: At least 1 adult OR senior present
- ✅ **Maximum ratio**: 8 children per adult/senior passenger
- ✅ **Ages required**: Must provide individual ages for ALL children (3-15 years)
- ✅ **Calculation**: `children <= (adults + seniors) * 8`
- ✅ **Ages validation**: `childrenAges.length === children`

#### Valid Examples
```javascript
✅ { adults: 1, children: 1, childrenAges: [5] }
✅ { adults: 1, children: 8, childrenAges: [3,4,5,6,7,8,9,10] }
✅ { adults: 2, children: 10, childrenAges: [3,4,5,6,7,8,9,10,11,12] }
✅ { seniors: 1, children: 2, childrenAges: [8, 12] }
```

#### Invalid Examples
```javascript
❌ { adults: 0, children: 1, childrenAges: [5] }           // No adult/senior
❌ { adults: 1, children: 9, childrenAges: [3,4,5...] }    // 9 children > 8 max
❌ { adults: 1, children: 2, childrenAges: [] }            // Missing ages
❌ { adults: 1, children: 2, childrenAges: [5] }           // Ages count mismatch
```

#### Error Messages

**Missing Adult/Senior:**
```
❌ Passenger Validation Failed: Child passengers require at least one adult or senior.

📋 Current Configuration:
- Children: 2
- Adults: 0
- Seniors: 0

✅ Required: At least 1 adult or senior must be present for children.
```

**Ratio Violation:**
```
❌ Passenger Validation Failed: Maximum 8 children per adult/senior passenger.

📋 Current Configuration:
- Children: 9
- Adults + Seniors: 1
- Maximum Allowed Children: 8

✅ Airline Requirement: Each adult or senior can accompany up to 8 children.

Please either:
1. Reduce children to 8 or fewer, OR
2. Add 1 more adult/senior passenger(s)
```

**Missing Ages:**
```
❌ Passenger Validation Failed: Children ages required.

You specified 2 child passenger(s) but didn't provide their ages.
Airlines require individual ages for each child (3-15 years) for accurate pricing.

✅ Required: Provide the age of each child.

Example: children_ages=[5, 8, 12]
```

**Ages Count Mismatch:**
```
❌ Passenger Validation Failed: Children ages count mismatch.

You provided 1 age(s) but specified 2 child passenger(s).

✅ Required: Provide exactly 2 age(s), one for each child.
```

---

## Combined Rules & Complex Scenarios

### Valid Complex Configurations
```javascript
✅ Family Trip
{
  adults: 2,
  children: 3,
  childrenAges: [5, 8, 12],
  lapInfants: 1,
  seatInfants: 1
}
// 2 adults can handle: 3 children, 1 lap infant, 1 seat infant

✅ Large Family
{
  adults: 2,
  seniors: 1,
  children: 8,
  childrenAges: [3,4,5,6,7,8,9,10]
}
// 3 adults/seniors can handle 8 children (max 24, using 8)

✅ Multi-Generation
{
  adults: 1,
  seniors: 2,
  children: 4,
  childrenAges: [6,7,10,12],
  seatInfants: 2
}
// 3 total adults/seniors: 4 children (max 24), 2 seat infants (max 6)
```

### Invalid Complex Configurations
```javascript
❌ Too Many Dependents
{
  adults: 1,
  children: 2,
  childrenAges: [5, 8],
  lapInfants: 1,
  seatInfants: 3
}
// Seat infants: 3 > 2 (max for 1 adult)

❌ No Supervision
{
  children: 3,
  childrenAges: [8, 10, 12],
  seatInfants: 1
}
// No adults or seniors present

❌ Missing Ages
{
  adults: 2,
  children: 3,
  childrenAges: [5, 8]  // Only 2 ages for 3 children
}
```

---

## Implementation Details

### Location
File: `src/ai/multiAgentSystem.js`
Lines: 790-863

### Execution Flow
1. Tool receives passenger parameters
2. **BEFORE** checking other required fields
3. **BEFORE** calling flight API
4. Runs all validation rules
5. If ANY rule fails → Returns error immediately
6. If all pass → Continues to API call

### Console Logging
All validations log to console for debugging:
```javascript
// Failures
[flight_search] ❌ VALIDATION FAILED: Too many lap infants (2) for adults/seniors (1)

// Success
[flight_search] ✅ Passenger validation passed: Adults=2, Seniors=1, Children=3, SeatInfants=1, LapInfants=0
```

---

## Agent Behavior

### The agent should:
1. ✅ **Understand** validation rules and communicate them naturally
2. ✅ **Pre-validate** passenger counts before calling tool (when possible)
3. ✅ **Handle errors** gracefully by explaining airline requirements
4. ✅ **Suggest solutions** from the error messages
5. ✅ **Wait** for user to fix configuration before retrying

### The agent should NOT:
1. ❌ Ignore validation errors
2. ❌ Retry with same invalid configuration
3. ❌ Proceed to search without fixing issues
4. ❌ Show technical error messages directly to users

---

## Testing Scenarios

### Test Case 1: Lap Infant Validation
```
Input: "Find flights for 1 adult and 2 lap infants"
Expected: Tool returns validation error
Agent: Explains 1:1 ratio rule, suggests adding adult or reducing infants
```

### Test Case 2: Seat Infant Validation
```
Input: "Search for 1 adult, 3 seat infants"
Expected: Tool returns validation error
Agent: Explains 2:1 ratio rule, suggests adding adult or reducing to 2 infants
```

### Test Case 3: Children Validation - Ratio
```
Input: "Find flights for 1 adult, 9 children ages 3-11"
Expected: Tool returns validation error
Agent: Explains 8:1 ratio rule, suggests adding adult or reducing children
```

### Test Case 4: Children Validation - Ages
```
Input: "Search for 2 adults, 2 children" (no ages provided)
Expected: Tool returns validation error
Agent: Asks for ages of the 2 children
```

### Test Case 5: Valid Complex Configuration
```
Input: "2 adults, 3 children ages 5,8,12, 1 lap infant"
Expected: ✅ Passes validation, proceeds to flight search
```

### Test Case 6: No Adult Supervision
```
Input: "Find flights for 3 children ages 10, 12, 14"
Expected: Tool returns validation error
Agent: Explains children need adult supervision
```

---

## Benefits

### For Users
- ✅ Clear error messages explaining airline rules
- ✅ Helpful suggestions to fix configuration
- ✅ Prevents booking failures at airline level
- ✅ Ensures compliance before search

### For System
- ✅ Catches errors early (before API call)
- ✅ Reduces invalid API requests
- ✅ Saves API costs
- ✅ Consistent validation across all searches

### For Airlines
- ✅ Matches industry safety requirements
- ✅ Proper supervision ratios enforced
- ✅ Accurate passenger data collected
- ✅ Compliance with regulations

---

## Summary

The flight_search tool now enforces **3 critical validation rules**:

1. **Lap Infants**: Max 1 per adult/senior, requires supervision
2. **Seat Infants**: Max 2 per adult/senior, requires supervision
3. **Children**: Max 8 per adult/senior, requires supervision + individual ages

All validations run **immediately** in the tool, returning detailed error messages with:
- 📋 Current configuration details
- ✅ Airline requirements explanation
- 🔧 Suggested solutions

This ensures **airline compliance** and **better user experience** by catching issues early.
