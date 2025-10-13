# Flight Specialist Agent - Complete Workflow Demonstration

## Overview
This document shows the complete workflow with context updates at each turn when a user searches for flights.

---

## 🔄 COMPLETE WORKFLOW EXAMPLE

### Initial State (Context Before Any Interaction)

```json
{
  "summary": {
    "origin": { "city": null, "iata": null },
    "destination": { "city": null, "iata": null },
    "outbound_date": null,
    "return_date": null,
    "pax": null,
    "budget": { "currency": "INR", "per_person": true }
  },
  "flights": {
    "tripType": "roundtrip",
    "cabinClass": "economy",
    "resolvedOrigin": {},
    "resolvedDestination": {},
    "searchResults": [],
    "bookingStatus": "pending"
  }
}
```

---

## 📍 TURN 1: User Provides Flight Details

### User Input
```
"Find flights from Delhi to Goa on December 25, 2025, returning January 2, 2026, 2 passengers, economy class"
```

### Agent Processing (GPT-4.1 Agentic Workflow)

#### Step 1: Agent Thinks Out Loud
```
"The user wants to find flights from Delhi to Goa. They've provided:
- Origin: Delhi
- Destination: Goa  
- Outbound: December 25, 2025
- Return: January 2, 2026
- Passengers: 2
- Class: Economy
- Trip type: Roundtrip (implied by return date)

I need to call flight_search to store this information and check if we can search for flights."
```

#### Step 2: Agent Calls `flight_search` (Initial Call)
```javascript
flight_search({
  origin: "Delhi",
  destination: "Goa",
  outbound_date: "2025-12-25",
  return_date: "2026-01-02",
  pax: 2,
  cabin_class: "economy",
  trip_type: "roundtrip"
})
```

#### Step 3: Tool Execution & Context Update

**Context Updated:**
```json
{
  "summary": {
    "origin": { "city": "Delhi", "iata": null },
    "destination": { "city": "Goa", "iata": null },
    "outbound_date": "2025-12-25",
    "return_date": "2026-01-02",
    "pax": 2
  },
  "flights": {
    "tripType": "roundtrip",
    "cabinClass": "economy",
    "resolvedOrigin": { "userCity": "Delhi", "airportIATA": null },
    "resolvedDestination": { "userCity": "Goa", "airportIATA": null },
    "searchResults": [],
    "bookingStatus": "pending"
  }
}
```

**Tool Response:**
```
Flight context updated. Missing required fields: origin_iata, dest_iata.

NEXT STEPS:
1. Use web_search to find airport IATA codes for: origin city "Delhi" and destination city "Goa"
   Example search: "Delhi airport IATA code, if no airport then nearest airport with IATA and distance"
2. Once you have IATA codes from web search, call flight_search again with:
   - origin_iata="[code from search]"
   - destination_iata="[code from search]"
   - Plus all other flight details
```

---

## 📍 TURN 1 (Continued): Agent Resolves IATA Codes

### Agent Thinks Out Loud
```
"The tool told me I need IATA codes. Let me search for the airport codes for Delhi and Goa."
```

### Step 4: Agent Calls `web_search` for Origin
```javascript
web_search("Delhi airport IATA code")
```

**Web Search Result:**
```
Indira Gandhi International Airport (IATA: DEL) is the primary international airport serving Delhi, India. Located in Palam, 15 km southwest of New Delhi.
```

### Step 5: Agent Calls `web_search` for Destination
```javascript
web_search("Goa airport IATA code")
```

**Web Search Result:**
```
Goa International Airport (IATA: GOI), also known as Dabolim Airport, is the only airport in Goa, India, serving both domestic and international flights.
```

### Step 6: Agent Thinks Out Loud
```
"Great! I found the airport codes:
- Delhi: DEL (Indira Gandhi International Airport)
- Goa: GOI (Goa International Airport)

Now I'll call flight_search again with all the details including the IATA codes."
```

### Step 7: Agent Calls `flight_search` (Final Call with IATA)
```javascript
flight_search({
  origin: "Delhi",
  origin_iata: "DEL",
  origin_airport_name: "Indira Gandhi International Airport",
  origin_distance_km: 0,
  destination: "Goa",
  destination_iata: "GOI",
  destination_airport_name: "Goa International Airport",
  destination_distance_km: 0,
  outbound_date: "2025-12-25",
  return_date: "2026-01-02",
  pax: 2,
  cabin_class: "economy",
  trip_type: "roundtrip"
})
```

### Step 8: Tool Execution & API Call

**Context Updated:**
```json
{
  "summary": {
    "origin": { "city": "Delhi", "iata": "DEL" },
    "destination": { "city": "Goa", "iata": "GOI" },
    "outbound_date": "2025-12-25",
    "return_date": "2026-01-02",
    "pax": 2
  },
  "flights": {
    "tripType": "roundtrip",
    "cabinClass": "economy",
    "resolvedOrigin": {
      "userCity": "Delhi",
      "airportIATA": "DEL",
      "airportName": "Indira Gandhi International Airport",
      "distance_km": 0
    },
    "resolvedDestination": {
      "userCity": "Goa",
      "airportIATA": "GOI",
      "airportName": "Goa International Airport",
      "distance_km": 0
    },
    "bookingStatus": "searching"
  }
}
```

**Tool calls `callFlightSearchAPI` function:**
```javascript
callFlightSearchAPI({
  origin: "DEL",
  destination: "GOI",
  departureDate: "12/25/2025",  // Converted to mm/dd/yyyy
  returnDate: "01/02/2026",     // Converted to mm/dd/yyyy
  passengers: 2,
  cabinClass: "economy"
})
```

**API Returns Results:**
```json
{
  "searchResults": [
    {
      "flightId": "FL001",
      "airline": { "code": "6E", "name": "IndiGo" },
      "departure": { "airport": "DEL", "time": "2025-12-25T06:30:00", "terminal": "3" },
      "arrival": { "airport": "GOI", "time": "2025-12-25T09:15:00", "terminal": "1" },
      "duration_minutes": 165,
      "stops": 0,
      "price": { "amount": 4500, "currency": "INR" },
      "baggage": { "checkin": "15 kg", "cabin": "7 kg" },
      "refundable": false
    },
    {
      "flightId": "FL002",
      "airline": { "code": "AI", "name": "Air India" },
      "departure": { "airport": "DEL", "time": "2025-12-25T08:00:00", "terminal": "3" },
      "arrival": { "airport": "GOI", "time": "2025-12-25T10:50:00", "terminal": "1" },
      "duration_minutes": 170,
      "stops": 0,
      "price": { "amount": 5200, "currency": "INR" },
      "baggage": { "checkin": "25 kg", "cabin": "7 kg" },
      "refundable": true
    },
    {
      "flightId": "FL003",
      "airline": { "code": "UK", "name": "Vistara" },
      "departure": { "airport": "DEL", "time": "2025-12-25T14:15:00", "terminal": "3" },
      "arrival": { "airport": "GOI", "time": "2025-12-25T17:00:00", "terminal": "1" },
      "duration_minutes": 165,
      "stops": 0,
      "price": { "amount": 5800, "currency": "INR" },
      "baggage": { "checkin": "20 kg", "cabin": "7 kg" },
      "refundable": true
    }
  ],
  "deeplink": "https://www.cheapoair.com/flights/results?origin=DEL&destination=GOI&departure=2025-12-25&return=2026-01-02&pax=2&class=economy"
}
```

**Final Context After API Call:**
```json
{
  "summary": {
    "origin": { "city": "Delhi", "iata": "DEL" },
    "destination": { "city": "Goa", "iata": "GOI" },
    "outbound_date": "2025-12-25",
    "return_date": "2026-01-02",
    "pax": 2
  },
  "flights": {
    "tripType": "roundtrip",
    "cabinClass": "economy",
    "resolvedOrigin": {
      "userCity": "Delhi",
      "airportIATA": "DEL",
      "airportName": "Indira Gandhi International Airport",
      "distance_km": 0
    },
    "resolvedDestination": {
      "userCity": "Goa",
      "airportIATA": "GOI",
      "airportName": "Goa International Airport",
      "distance_km": 0
    },
    "searchResults": [
      // ... 3 flight options as shown above
    ],
    "deeplink": "https://www.cheapoair.com/flights/results?origin=DEL&destination=GOI...",
    "bookingStatus": "results_shown"
  }
}
```

### Step 9: Agent Presents Results to User

**Agent Response:**
```markdown
Perfect! I found **3 flight options** from Delhi (DEL) to Goa (GOI) for 2 passengers.

## ✈️ Flight Options: Delhi (DEL) → Goa (GOI)

### Option 1: IndiGo - ₹4,500 💰 Cheapest
**Departure**: Dec 25 at 6:30 AM from DEL Terminal 3
**Arrival**: Dec 25 at 9:15 AM at GOI Terminal 1
**Duration**: 2h 45m | **Stops**: Direct
**Refundable**: No
**Baggage**: Check-in 15kg, Cabin 7kg

---

### Option 2: Air India - ₹5,200 ⭐ Best Value
**Departure**: Dec 25 at 8:00 AM from DEL Terminal 3
**Arrival**: Dec 25 at 10:50 AM at GOI Terminal 1
**Duration**: 2h 50m | **Stops**: Direct
**Refundable**: Yes
**Baggage**: Check-in 25kg, Cabin 7kg

---

### Option 3: Vistara - ₹5,800 
**Departure**: Dec 25 at 2:15 PM from DEL Terminal 3
**Arrival**: Dec 25 at 5:00 PM at GOI Terminal 1
**Duration**: 2h 45m | **Stops**: Direct
**Refundable**: Yes
**Baggage**: Check-in 20kg, Cabin 7kg

---

## 🎟️ Ready to Book?

👉 **[Book Now on CheapOair.com](https://www.cheapoair.com/flights/results?origin=DEL&destination=GOI&departure=2025-12-25&return=2026-01-02&pax=2&class=economy)**

*Showing 3 available flights. All prices are per person.*

💡 **Pro Tips**:
• Book soon - prices change frequently
• Air India offers the best baggage allowance (25kg check-in)
• IndiGo is the cheapest option but non-refundable
• All flights are direct - no layovers!
```

---

## 📊 Context Update Summary

### What Changed During This Interaction:

1. **summary.origin** - `null` → `{ city: "Delhi", iata: "DEL" }`
2. **summary.destination** - `null` → `{ city: "Goa", iata: "GOI" }`
3. **summary.outbound_date** - `null` → `"2025-12-25"`
4. **summary.return_date** - `null` → `"2026-01-02"`
5. **summary.pax** - `null` → `2`
6. **flights.resolvedOrigin** - `{}` → Full airport details with IATA
7. **flights.resolvedDestination** - `{}` → Full airport details with IATA
8. **flights.searchResults** - `[]` → Array of 3 flight options
9. **flights.deeplink** - `null` → CheapOair booking URL
10. **flights.bookingStatus** - `"pending"` → `"results_shown"`

---

## 🔧 Tools Used (In Order)

1. **flight_search** (Initial) - Stored user input, returned missing IATA codes
2. **web_search** - Found Delhi airport code (DEL)
3. **web_search** - Found Goa airport code (GOI)
4. **flight_search** (Final) - Called API with IATA codes, returned results

**Total: 4 tool calls (using only 2 different tools)**

---

## ✅ GPT-4.1 Agentic Behaviors Demonstrated

1. **Persistence** - Didn't stop after first tool call, kept going until results found
2. **Tool-Calling** - Used web_search to gather missing information (IATA codes)
3. **Planning** - Thought out loud about what was needed at each step
4. **No Guessing** - Used tools to find accurate airport codes instead of assuming
5. **Chain-of-Thought** - Explained reasoning between each tool call

---

## 🎯 How to Run This Workflow

1. Set your OpenAI API key:
   ```bash
   export OPENAI_API_KEY="your-api-key-here"
   ```

2. Run the test:
   ```bash
   node test-flight-workflow-detailed.js
   ```

3. Or integrate into your application:
   ```javascript
   import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';
   
   const result = await runMultiAgentSystem(
     userMessage,
     chatId,
     conversationHistory
   );
   
   console.log('Agent Response:', result.finalOutput);
   console.log('Updated Context:', result.context);
   ```

---

## 📝 Notes

- Context is automatically saved after each interaction
- All context updates happen through tool calls
- The 2-tool workflow is simpler and more reliable than the old 3-tool approach
- GPT-4.1 handles the agentic workflow autonomously
- No manual state management needed - tools update context automatically


