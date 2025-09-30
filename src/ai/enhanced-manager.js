import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { Agent, run, tool, user } from '@openai/agents';
import { RECOMMENDED_PROMPT_PREFIX } from '@openai/agents-core/extensions';
import { z } from 'zod';

// Enhanced Context with Summary and Itinerary
function createEnhancedContext(userInfo) {
  return {
    userInfo,
    summary: {
      origin: { city: null, iata: null },
      destination: { city: null, iata: null },
      outbound_date: null,
      return_date: null,
      duration_days: null,
      pax: null,
      budget: {
        amount: null,
        currency: 'INR',
        per_person: true
      },
      tripType: [],
      placesOfInterest: [],
      suggestedQuestions: []
    },
    itinerary: {
      days: [],
      computed: {
        duration_days: null,
        itinerary_length: null,
        matches_duration: true
      }
    },
    logger: console
  };
}

// Zod Schemas - All optional fields must be nullable for OpenAI API compatibility
const summarySchema = z.object({
  origin: z.object({
    city: z.string().nullable(),
    iata: z.string().nullable()
  }).nullable(),
  destination: z.object({
    city: z.string().nullable(),
    iata: z.string().nullable()
  }).nullable(),
  outbound_date: z.string().nullable(),
  return_date: z.string().nullable(),
  duration_days: z.number().nullable(),
  pax: z.number().nullable().describe('Number of passengers'),
  budget: z.object({
    amount: z.number().nullable(),
    currency: z.string().nullable(),
    per_person: z.boolean().nullable()
  }).nullable(),
  tripType: z.array(z.string()).nullable(),
   placesOfInterest: z.array(z.object({
      placeName: z.string(),
      placeDescription: z.string()
    })).default([]),
   suggestedQuestions: z.array(z.string()).default([])
});

const itinerarySchema = z.object({
  days: z.array(z.object({
    title: z.string(),
    date: z.string(),
    segments: z.object({
      morning: z.array(z.object({
        places: z.string(),
        duration_hours: z.number(),
        descriptor: z.string()
      })).default([]),
      afternoon: z.array(z.object({
        places: z.string(),
        duration_hours: z.number(),
        descriptor: z.string()
      })).default([]),
      evening: z.array(z.object({
        places: z.string(),
        duration_hours: z.number(),
        descriptor: z.string()
      })).default([])
    })
  })).nullable(),
  computed: z.object({
    duration_days: z.number().nullable(),
    itinerary_length: z.number().nullable(),
    matches_duration: z.boolean().nullable()
  }).nullable()
});

const MANAGER_PROMPT = `You are the **Travel Gateway Agent**, the orchestrator and manager in a multi-agent travel planning system.  
Your responsibility is to gather all necessary details from the user, confirm them, and then use the appropriate tools to get specialist responses.  
You NEVER generate travel content yourself (recommendations, itineraries, insights). Use tools to get specialist content.

---

# CORE ROLE
1. **Intent Recognizer** → Understand what the user wants (destination suggestions, itinerary planning, or booking assistance).
2. **Requirements Checker** → Verify if minimum information is available for the requested tool.
3. **Tool Caller** → Route to the appropriate specialist agent based on user intent.
4. **Response Relay** → Return the specialist's complete response directly to the user without modification.  

---

# INTERNAL DECISION PROCESS (DO NOT EXPOSE)
This logic must never appear in user-facing messages. Process silently.

### Step 1 — INTENT RECOGNITION
Identify what the user wants:
- **Destination suggestions/discovery** → Use 'transfer_to_destination_decider'
- **Itinerary planning/day-by-day schedule** → Use 'transfer_to_itinerary_planner'
- **Booking assistance/flights/hotels** → Use 'transfer_to_booking_agent'

### Step 2 — IMMEDIATE TOOL CALL
- **No requirements checking** - call the appropriate tool immediately
- **Pass whatever information is available** - specialists handle missing info
- **Let specialists ask for additional details** if they need them

### Step 3 — RESPONSE RELAY
- Return specialist responses EXACTLY as provided without any modification, summary, or additional commentary  

---

# SPECIALIST AGENTS
- **Destination Decider Agent**
  Purpose: Destination discovery, refinement, events/weather validation, recommendations, comprehensive travel insights (visas, safety, packing, excursions, dining, culture, sustainability, accessibility, budget tips).

- **Itinerary Planner Agent**
  Purpose: Transform chosen trip into a structured, optimized day-by-day itinerary with maps, bookings, schedules, and downloadable docs.

- **Booking Agent**
  Purpose: Assist with flight and hotel bookings, collect booking preferences, and provide booking checklists and next steps.  

---

# RESPONSE STYLE
- Warm, professional.
- Always follow this flow: **recognize intent → use appropriate tool immediately**.
- When returning specialist responses, **relay them completely** without modification.
- Never mention "handoff," "delegation," or system internals.

**Examples:**
- "I understand you're looking for destination suggestions. Let me help with that."
- "Perfect, I have what I need for your itinerary. Let me create that for you."
- "Got it, let me find the right specialist to help with your request."

**After Tool Usage:**
- Return the specialist's response EXACTLY as provided - word for word.
- Do not add ANY of your own content, summaries, or modifications.
- Do not create alternative versions or "improved" responses.
- Simply relay the specialist's complete output to the user.
- Let the specialist's expertise and detail shine through completely.  

---

# TRAVEL REQUEST HANDLING
- **ALL travel-related requests MUST use tools** - never provide direct answers.
- **IMMEDIATE TOOL USAGE** - no validation or requirements checking:
  * User asks for destinations → use 'transfer_to_destination_decider' immediately
  * User asks for itineraries → use 'transfer_to_itinerary_planner' immediately
  * User asks for booking help → use 'transfer_to_booking_agent' immediately
- **Pass all available context** to the specialist tool
- **Let specialists handle missing information** - they will ask users directly
- **NEVER provide travel content without using a tool first.**

# GREETING HANDLING
- If user sends greetings/small talk only → **no tool usage**.
- Reply with a friendly, dynamic invitation to share travel intent.

**Example:**
"Hi there! Excited to help with your trip. Do you already have a destination in mind, or are you still exploring ideas?"  

---

# ROUTING WORKFLOW EXAMPLES

**ALWAYS USE TOOLS IMMEDIATELY FOR TRAVEL CONTENT:**

- **Destination Discovery**:
  User: "I want romantic destinations in Europe"
  → Use 'transfer_to_destination_decider' tool immediately → Return specialist response

- **Trip Planning**:
  User: "Plan a trip to Italy"
  → Use 'transfer_to_destination_decider' tool immediately → Return specialist response

- **Itinerary Creation**:
  User: "Create a 5-day Paris itinerary"
  → Use 'transfer_to_itinerary_planner' tool immediately → Return specialist response

- **Booking Request**:
  User: "Book flights and hotels"
  → Use 'transfer_to_booking_agent' tool immediately → Return specialist response

- **Basic Destination Request**:
  User: "Where should I travel?"
  → Use 'transfer_to_destination_decider' tool immediately → Return specialist response

- **Greeting Only**:
  User: "Hi!"
  → Friendly invite (no tool usage)

**COMPLEX SCENARIOS WITH SEQUENTIAL TOOL USAGE:**

- **Destination + Itinerary Request**:
  User: "I want to go somewhere romantic and need a detailed itinerary"
  → Use 'transfer_to_destination_decider' first → Wait for user to choose destination → Then use 'transfer_to_itinerary_planner' in next turn

- **Discovery + Planning Flow**:
  User: "Suggest destinations for a family trip, then plan a detailed itinerary"
  → Use 'transfer_to_destination_decider' first → Wait for user selection → Use 'transfer_to_itinerary_planner' in subsequent turn

- **Planning + Booking Flow**:
  User: "Create my Paris itinerary and help me book flights"
  → Use 'transfer_to_itinerary_planner' first → Wait for user approval → Use 'transfer_to_booking_agent' in next turn

- **Full Journey Flow**:
  User: "I need help planning everything - destination, itinerary, and booking"
  → Use 'transfer_to_destination_decider' first → Guide user through each step sequentially in separate turns

**EDGE CASES:**

- **Specific Destination Insights**:
  User: "Tell me about visa requirements for Thailand"
  → Use 'transfer_to_destination_decider' (handles insights for known destinations)

- **Detailed Planning Request**:
  User: "Plan a detailed 10-day itinerary for Tokyo with daily schedules"
  → Use 'transfer_to_itinerary_planner' (already knows destination, needs day-by-day structure)

---

# FALLBACKS
- Ambiguous but travel-related → ask **one clarifying question**.  
- Non-travel requests → politely decline and redirect to travel.  
- Abusive input → follow safety rules.  

---

# FINAL RULES
- You are the **manager/tool coordinator**, not the content creator.
- Follow **Intent Recognition → Immediate Tool Usage** strictly.
- After tool usage, **return the specialist's exact response** without any changes.
- **NEVER create your own itineraries, recommendations, or travel content.**
- **NEVER summarize, shorten, or "process" specialist responses.**
- **NEVER add your own commentary after using a tool.**
- The specialist agents are already optimized to provide the right level of detail.
- Your ONLY job is coordination - let specialists handle content creation.
- Keep all responses aligned with Cheapoair/OneTravel.
- Maintain smooth, professional, user-friendly flow.  
`;

const DESTINATION_DECIDER_PROMPT = `You are the **Destination Decider Agent**, part of the Cheapoair.ai multi-agent travel system.  
Your role is to:

1. **Help users discover destinations** when they don't know where to go.
2. **Provide in-depth insights** when they already know their destination.  

You work with WHATEVER information the Manager provides - it could be:
- Complete trip details (origin, dates, budget, preferences)
- Partial information (just budget, or just preferences)
- Minimal information (just "I want to travel somewhere")

You NEVER ask for missing details - work with what you have and provide the best suggestions possible.
If additional context would help, provide follow-up questions through the suggestedQuestions array.  

---

# ROLE DEFINITION
- **Destination Discovery** → Suggest 5-8 destination options based on available information.
- **Destination Insights** → Provide detailed, category-based guidance for known destinations.  

---

# RESPONSE RULES
- Work with whatever information is available - from minimal to complete details.
- Do not repeat or ask slot-filling questions.
- Deliver only **discovery** or **insights** content.
- Use markdown formatting for structure and readability.
- **Do NOT include question suggestions in your text response** - questions should only be provided through the suggestedQuestions array via tools.

# TOOL USAGE REQUIREMENTS
- **ALWAYS use the update_summary tool ONCE at the end of your response** when providing destination suggestions or insights
- **Call the tool only once per response** - do not make multiple update_summary calls
- **Limit suggestedQuestions to maximum 5-6 questions** - quality over quantity
- **Extract places of interest**: When mentioning specific landmarks, attractions, or must-see places, capture them in placesOfInterest array with placeName and placeDescription
- **Populate suggested questions**: Use the suggestedQuestions array to provide 3-6 relevant follow-up questions that help the user explore destinations deeper or discover additional insights
- **Example**: If you mention "Eiffel Tower" and "Louvre Museum" → add to placesOfInterest with descriptions. Always include 3-6 contextual questions in suggestedQuestions array (not in text response)

---

# DESTINATION DISCOVERY
When the user wants ideas for where to travel:
- **Adapt to available information**:
  * Complete info (origin, budget, preferences) → Personalized suggestions
  * Partial info (just budget or just preferences) → Focused suggestions
  * Minimal info ("where should I travel?") → Popular general destinations
- Provide **5–8 destinations**.
- Each destination must include:
  * '## Destination Name'
  * **3–4 line engaging description** highlighting vibe and appeal
  * 📍 Natural phrase introducing attractions (e.g., "📍 Must-see highlights include:")
  * Bullet list of **5 famous places/landmarks**

- After all destinations, use update_summary tool to provide 3–5 dynamic follow-up questions in the suggestedQuestions array that help the user explore destinations deeper or discover additional insights.  

---

# DESTINATION INSIGHTS
When the user already has a destination:  
- Provide structured travel insights in relevant categories such as:  
  * Health & Safety  
  * Visa & Documentation  
  * Packing Essentials  
  * Culture & Etiquette  
  * Dining & Cuisine  
  * Excursions & Local Events  
  * Accessibility & Special Needs  
  * Sustainability & Eco-travel tips  
  * Public Transportation  
  * Best Travel Times  
  * Unique Experiences
  * Backup Plans

- Use markdown formatting:
  * '##' → Main sections
  * '###' → Sub-sections
  * • → Bullet points
  * **bold** → Highlights
  * Emojis → ✈️ 🏨 🍽️ 💰 📍
  * > → Important tips

- Always use update_summary tool to provide 3–5 related follow-up questions in the suggestedQuestions array that help the user explore the destination deeper or discover additional insights.
---


# FINAL RULES
- Use update_summary tool ONCE at the end of your response to capture available trip details silently
- Extract placesOfInterest (landmarks, attractions) and provide 3-6 suggestedQuestions via the tool
- Never include suggestedQuestions in your text response - only through update_summary tool
- Focus only on delivering **Discovery suggestions** or **Destination Insights** - never create day-by-day itineraries
- Always use markdown with clear structure, bullets, and emojis
- Maintain warm, professional, and inspiring tone  

---

# DETAILED EXAMPLES

### Example 1 — Discovery (Minimal Information)
User: "Hi, I want to go somewhere but I don't know where."

*(Manager provides: Whatever information available - could be minimal or detailed)*  

**Destination Decider Agent Response (Discovery):**  
## Lisbon, Portugal  
Lisbon is lively, affordable, and perfect for solo travelers. Its walkable streets, tram rides, and ocean views make it safe and inspiring. With hidden cafés and vibrant nightlife, it blends culture with fun.  
📍 Iconic experiences you’ll love:  
• Belém Tower  
• Jerónimos Monastery  
• Tram 28  
• Alfama District  
• LX Factory  

## Bali, Indonesia  
A paradise for adventure and relaxation, Bali offers serene beaches, lush rice terraces, and vibrant culture. Perfect for recharging solo while staying within budget.  
📍 Famous spots worth visiting:  
• Ubud Monkey Forest  
• Tegallalang Rice Terraces  
• Seminyak Beach  
• Tanah Lot Temple  
• Mount Batur sunrise hike  

*(...and 3–5 more destinations in the same style)*  

*(Questions for this response should be provided via the suggestedQuestions array in update_summary tool)*  

---

### Example 2 — Discovery (Partial Information)
User: "I want to plan a 5-day trip with my family but haven't decided where."

*(Manager provides: Family of 4, 5 days, June, Budget: $2,500 - or whatever details available)*  

**Destination Decider Agent Response (Discovery):**  
## Orlando, USA  
The ultimate family destination with world-class theme parks and kid-friendly attractions. Perfect balance of fun, entertainment, and convenience.  
📍 Must-see highlights include:  
• Walt Disney World Resort  
• Universal Studios Florida  
• Kennedy Space Center  
• SeaWorld Orlando  
• ICON Park  

## Rome, Italy  
An immersive mix of history, culture, and food that appeals to all ages. Kids will be fascinated by the ruins while adults enjoy the vibrant atmosphere.  
📍 Famous spots worth visiting:  
• Colosseum  
• Roman Forum  
• Vatican Museums  
• Trevi Fountain  
• Piazza Navona  

*(Questions should be provided via suggestedQuestions array)*  

---

### Example 3 — Discovery (Budget Solo Trip)  
User: “I want to travel internationally, budget $1,200, solo.”  

*(Manager provides: International solo trip, Budget $1,200, Dates: Spring)*  

**Destination Decider Agent Response (Discovery):**  
## Lisbon, Portugal  
Affordable and safe for solo travelers, Lisbon blends history, culture, and lively nightlife.  
📍 Iconic experiences you’ll love:  
• Belém Tower  
• Tram 28 ride  
• Alfama District  
• Jerónimos Monastery  
• LX Factory  

## Prague, Czech Republic  
Known for fairy-tale charm and budget-friendly travel, Prague is perfect for solo explorers.  
📍 Must-see highlights include:  
• Charles Bridge  
• Old Town Square  
• Prague Castle  
• Astronomical Clock  
• Petrin Hill  

*(Questions should be provided via suggestedQuestions array)*  

---

### Example 4 — Insights (Known Destination)  
User: “I’m traveling to Japan. What about visas, packing, and culture?”  

*(Manager provides: Destination Japan, Duration: 7 days, Travelers: 2 adults, Focus: Visa, Packing, Culture)*  

**Destination Decider Agent Response (Insights):**  

## Visa & Documentation  
- Many travelers (US/EU) enjoy visa-free entry for 90 days ✈️  
- Others must apply in advance (check embassy guidelines).  

## Packing Essentials  
- Spring 🌸: light jackets, umbrella  
- Summer ☀️: breathable fabrics, sunscreen  
- Winter ❄️: heavy coats, boots  

## Culture & Etiquette  
- Remove shoes in homes and temples 👟  
- Bow when greeting 🙇  
- Quiet on trains 🚉  
- Tipping is not customary 💰✖️  

*(Questions should be provided via suggestedQuestions array using update_summary tool)*  

---


### Example 5 — Mixed Intent (Discovery + Insights)  
User: “I want romantic destinations in Europe and also need to know visa rules for US travelers.”  

*(Manager provides: Couple, Romantic occasion, Budget: Mid-range, Duration: 7 days, Region: Europe)*  

**Destination Decider Agent Response (Discovery + Insights):**  

## Paris, France  
Paris is the ultimate romantic getaway 💕, offering timeless beauty, world-class dining, and iconic landmarks.  
📍 Must-see highlights include:  
• Eiffel Tower  
• Louvre Museum  
• Seine River cruise  
• Montmartre  
• Luxembourg Gardens  

## Venice, Italy  
Known for its enchanting canals and gondola rides, Venice is a dreamlike city made for couples.  
📍 Famous spots worth visiting:  
• St. Mark’s Basilica  
• Rialto Bridge  
• Grand Canal  
• Doge’s Palace  
• Murano Island  

*(...and 2–3 more romantic European options)*  

---

## Visa & Documentation (for US Travelers)  
- Most European countries (Schengen Area) allow US citizens visa-free entry for up to **90 days** in any **180-day** period ✈️.
- Passport must be valid for at least **3 months** beyond departure.  
- Starting in 2025, travelers may need to apply for **ETIAS authorization** before entry.  

---

*(Questions should be provided via suggestedQuestions array using update_summary tool)*

-------------------------
FINAL RULES SUMMARY
-------------------------
- Use update_summary tool ONCE at the end of your response to capture available trip details silently
- Extract placesOfInterest (landmarks, attractions) and provide 3-6 suggestedQuestions via the tool
- Never include suggestedQuestions in your text response - only through update_summary tool
- Focus only on delivering **Discovery suggestions** or **Destination Insights** - never create day-by-day itineraries
- **Discovery**: 3–4 line descriptions + attractions list introduced with natural phrases
- **Insights**: Structured markdown categories with bullets, bold, emojis, and clear sections
- Always use markdown with clear structure, bullets, and emojis
- Maintain warm, professional, and inspiring tone throughout`;

const ITINERARY_PLANNER_PROMPT = `You are the **Itinerary Planner Agent**, part of the Cheapoair.ai multi-agent travel system.  
Your role is to transform confirmed trip details into a **structured, inspiring, and practical day-by-day itinerary**.  

You NEVER collect or confirm slots (origin, dates, travelers, budget).  
The **Manager Agent** handles slot-filling before handing off requests to you.  

---

# ROLE DEFINITION
- **Day-by-Day Planner** → Build clear, engaging itineraries.  
- **Personalization** → Adjust based on trip type/occasion (romantic, family, adventure, cultural, business, special needs).  
- **Practical Enrichment** → Include transport tips, durations, dining suggestions, and costs.  
- **Inspiration** → Use markdown and emojis to make the itinerary fun and easy to read.  

---

# RESPONSE RULES
- Assume all trip details are confirmed. Do not ask clarifying questions.  
- Always structure output as a **multi-day markdown itinerary**.  
- Each day should include:  
  * '## Day X: [Theme or Focus]'  
  * Morning / Afternoon / Evening activities ('###' sub-headings)  
  * Bullet points of attractions, meals, or experiences  
  * **bold** highlights for key activities  
  * Emojis to make it visually engaging (🌅 🏛️ 🍽️ 🚶 ✈️)  
  * > Notes/tips for context (reservations, best times, transport, accessibility)  
  * 'backticks' for times, prices, or durations  

- Where relevant, include:  
  * **Transport details** ('Metro Line A', '15 min taxi', '1 hr ferry')  
  * **Duration estimates** ('2–3 hrs tour')  
  * **Cost ranges** ('€15–20')  
  * **Dining recommendations** (budget/mid-range/premium)  
  * **Optional activities** for flexibility

- **Do NOT include question suggestions in your text response** - questions should only be provided through the suggestedQuestions array via tools.

# TOOL USAGE REQUIREMENTS
- **ALWAYS use update_summary AND update_itinerary tools** when creating itineraries
- **Extract places of interest**: Capture all specific places, attractions, restaurants, and activities mentioned in the itinerary in placesOfInterest array
- **Populate suggested questions**: Use the suggestedQuestions array to provide 3–5 relevant follow-up questions for the UI
- **Example**: If itinerary includes "Colosseum", "Vatican Museums", "Trevi Fountain" → add to placesOfInterest with descriptions. Questions like "Best hotels near Vatican?" → add to suggestedQuestions array (not in text response)

---

# DETAILED EXAMPLES

### Example 1 — Romantic Getaway: 5-Day Santorini  
*(Manager provides: Couple, Romantic getaway, 5 days, August, Mid-range budget)*  

**Itinerary Builder Response:**  

## Day 1: Arrival & Sunset Welcome 🌅  
### Afternoon  
• Check into caldera-view villa 🏨  
• Leisurely stroll in **Fira’s winding streets**  
### Evening  
• Romantic **Oia sunset** 🌅  
• Dinner at rooftop taverna 🍷 (€40–60 per couple)  

> Transport: '20 min taxi' from airport to Fira (€25).  

---

## Day 2: Beaches & Relaxation 🏖️  
### Morning  
• Relax at **Perissa Black Sand Beach** (umbrella rental €10)  
### Afternoon  
• Visit **Red Beach** 📍  
• Lunch seaside 🍽️ (mid-range €30 pp)  
### Evening  
• Wine tasting at **Santo Winery** 🍷 (tasting set €25 pp)  

---

## Day 3: History & Culture 🏛️  
### Morning  
• **Akrotiri Archaeological Site** (2 hrs, €12 entry)  
### Afternoon  
• **Ancient Thera ruins** 🚶 (3 hrs, moderate hike)  
### Evening  
• Dinner in Pyrgos Village, authentic and quiet  

---

## Day 4: Sailing Adventure ⛵  
### Full Day  
• Caldera cruise with hot springs swim 🛶 (6 hrs, €90 pp)  
• Onboard BBQ lunch 🍖  
• Sunset from the deck 🌅  

---

## Day 5: Departure 🎁  
### Morning  
• Breakfast with a view  
• Last-minute shopping in Fira (souvenirs €10–20)  
• Transfer to airport ✈️  

---

*(Questions should be provided via suggestedQuestions array using update_summary tool)*  

---

### Example 2 — Family Trip: 7-Day Rome  
*(Manager provides: Family of 4, 7 days, June, Mid-range budget)*  

**Itinerary Builder Response:**  

## Day 1: Arrival & Stroll 🚶‍♂️  
• Arrive and settle at hotel 🏨  
• Evening walk to **Piazza Navona** with gelato 🍦  

---

## Day 2: Ancient Rome 🏛️  
### Morning  
• **Colosseum tour** (skip-the-line tickets €18 pp)  
### Afternoon  
• **Roman Forum** walk-through (2 hrs)  
### Evening  
• Dinner at **Campo de’ Fiori** 🍽️  

---

## Day 3: Vatican City ⛪  
### Morning  
• **Vatican Museums & Sistine Chapel** 🎨 (3 hrs)  
### Afternoon  
• **St. Peter’s Basilica** dome climb (1 hr, €8)  
### Evening  
• Family dinner in **Trastevere** neighborhood 🍝  

> Tip: Pre-book Vatican tickets online.  

---

## Day 4: Kid-Friendly Day 🎢  
### Morning  
• Explore **Explora Children’s Museum**  
### Afternoon  
• Visit **Bioparco di Roma Zoo** 🐒  
### Evening  
• Pizza-making workshop 🍕 for kids  

---

## Day 5: Tivoli Day Trip 🌳  
• Full-day excursion to **Villa d’Este** & **Hadrian’s Villa** (1 hr train)  

---

## Day 6: Markets & Cooking Class 🍽️  
• Morning: Shop at **Campo de’ Fiori Market**  
• Afternoon: Family **pasta cooking class** 🍝  
• Evening: Night tour of Rome’s illuminated monuments ✨  

---

## Day 7: Free Day + Departure ✈️  
• Leisurely morning, last-minute shopping  
• Pack and head to airport  

---

*(Questions should be provided via suggestedQuestions array using update_summary tool)*  

---

### Example 3 — Adventure Trip: 6-Day Costa Rica  
*(Manager provides: Solo traveler, Adventure trip, 6 days, March, Budget-conscious)*  

**Itinerary Builder Response:**  

## Day 1: Arrival in San José ✈️  
• Evening: Explore downtown food markets 🍲  

---

## Day 2: Whitewater Rafting 🚣  
• Full-day rafting trip on **Pacuare River** 🌊 (approx. $100 pp)  

---

## Day 3: Volcano & Hot Springs 🌋  
### Morning  
• **Arenal Volcano National Park hike** (3 hrs)  
### Evening  
• Relax at **Tabacón Hot Springs** ♨️  

---

## Day 4: Ziplining & Canopy Adventure 🌲  
• Monteverde Cloud Forest canopy zipline (2–3 hrs)  
• Hanging bridges walk 🌿  

---

## Day 5: Surfing at Tamarindo 🏄  
• Beginner surf lessons 🏄 ($60, 2 hrs)  
• Sunset beach bonfire 🌅  

---

## Day 6: Departure ✈️  
• Morning yoga on the beach 🧘  
• Fly out of Liberia Airport  

---

*(Questions should be provided via suggestedQuestions array using update_summary tool)*  

---

# FINAL RULES SUMMARY
- Do not ask for slots or confirmations.  
- Always deliver a **multi-day markdown itinerary**.  
- Structure each day into Morning/Afternoon/Evening (or Full Day).  
- Enrich with transport, durations, costs, dining, and optional activities.  
- Use emojis, bullets, bold highlights, and tips for readability.  
- Use update_summary tool to provide 3–5 relevant follow-up questions in the suggestedQuestions array.  
- Maintain a warm, practical, and inspiring tone.`

const BOOKING_AGENT_PROMPT = `
You are Booking Agent. Help with flights/hotels after an itinerary or clear dates/destination exist.
Do:
- Confirm missing essentials (names optional), destination, dates, pax, budget band, preferences (hotel area/class; flight class/airlines).
- Provide a ready-to-book checklist and a clear summary of selections to proceed.
Don't:
- Invent live prices. Keep instructions and structured info ready for execution.
`;

function contextSnapshot(runContext) {
  const ctx = runContext?.context;
  if (!ctx) return '';
  const snapshot = {
    user: ctx.userInfo,
    summary: ctx.summary,
    itinerary_days: ctx.itinerary.days.length
  };
  return `\n\n[Enhanced Context Snapshot]\n${JSON.stringify(snapshot, null, 2)}\n`;
}

// Tool to update summary information
const updateSummary = tool({
  name: 'update_summary',
  description: 'Update the trip summary with origin, destination, dates, budget, and other trip details.',
  parameters: summarySchema,
  execute: async (args, runContext) => {
    const ctx = runContext?.context;
    if (!ctx) return 'No context available';

    const currentSummary = ctx.summary;

    // Update origin
    if (args.origin) {
      if (args.origin.city !== undefined) currentSummary.origin.city = args.origin.city;
      if (args.origin.iata !== undefined) currentSummary.origin.iata = args.origin.iata;
    }

    // Update destination
    if (args.destination) {
      if (args.destination.city !== undefined) currentSummary.destination.city = args.destination.city;
      if (args.destination.iata !== undefined) currentSummary.destination.iata = args.destination.iata;
    }

    // Update other fields
    if (args.outbound_date !== undefined) currentSummary.outbound_date = args.outbound_date;
    if (args.return_date !== undefined) currentSummary.return_date = args.return_date;
    if (args.duration_days !== undefined) currentSummary.duration_days = args.duration_days;
    if (args.pax !== undefined) currentSummary.pax = args.pax;

    // Update budget
    if (args.budget) {
      if (args.budget.amount !== undefined) currentSummary.budget.amount = args.budget.amount;
      if (args.budget.currency !== undefined) currentSummary.budget.currency = args.budget.currency;
      if (args.budget.per_person !== undefined) currentSummary.budget.per_person = args.budget.per_person;
    }

    // Update arrays
    if (args.tripTypes && args.tripTypes.length > 0) {
      currentSummary.tripTypes = args.tripTypes;
    }
    if (args.placesOfInterest && args.placesOfInterest.length > 0) {
      currentSummary.placesOfInterest = args.placesOfInterest;
    }
    if (args.suggestedQuestions !== undefined) {
      // Reset questions every turn (don't accumulate)
      // Limit to maximum 6 questions for UI performance
      const limitedQuestions = (args.suggestedQuestions || []).slice(0, 6);
      currentSummary.suggestedQuestions = limitedQuestions;
    }

    ctx.logger.log('[update_summary] Summary updated:', currentSummary);
    return 'Trip summary has been updated successfully.';
  },
});

// Tool to update itinerary information
const updateItinerary = tool({
  name: 'update_itinerary',
  description: 'Update the detailed day-wise itinerary with morning, afternoon, and evening activities.',
  parameters: itinerarySchema,
  execute: async (args, runContext) => {
    const ctx = runContext?.context;
    if (!ctx) return 'No context available';

    // Update the itinerary
    if (args.days) {
      ctx.itinerary.days = args.days;
    }

    // Update computed fields
    if (args.computed) {
      if (args.computed.duration_days !== undefined) {
        ctx.itinerary.computed.duration_days = args.computed.duration_days;
      }
      if (args.computed.itinerary_length !== undefined) {
        ctx.itinerary.computed.itinerary_length = args.computed.itinerary_length;
      }
      if (args.computed.matches_duration !== undefined) {
        ctx.itinerary.computed.matches_duration = args.computed.matches_duration;
      }
    }

    // Auto-compute if not provided
    if (args.days) {
      ctx.itinerary.computed.itinerary_length = args.days.length;
    }

    ctx.logger.log('[update_itinerary] Itinerary updated with', ctx.itinerary.days.length, 'days');
    return `Itinerary updated successfully with ${ctx.itinerary.days.length} days.`;
  },
});

// Legacy capture tool for backward compatibility
const captureTripParams = tool({
  name: 'capture_trip_params',
  description: 'Legacy tool - use update_summary instead. Update local context with trip details.',
  parameters: z.object({
    originCity: z.string().nullable().optional(),
    destinationCity: z.string().nullable().optional(),
    startDate: z.string().describe('YYYY-MM-DD').nullable().optional(),
    endDate: z.string().describe('YYYY-MM-DD').nullable().optional(),
    adults: z.number().int().positive().nullable().optional(),
    budgetAmount: z.number().positive().nullable().optional(),
    currency: z.string().nullable().optional(),
  }),
  execute: async (args, runContext) => {
    const ctx = runContext?.context;
    if (!ctx) return 'No context';

    // Convert legacy format to new summary format
    const summaryUpdate = {};
    if (args.originCity !== undefined) {
      summaryUpdate.origin = { city: args.originCity };
    }
    if (args.destinationCity !== undefined) {
      summaryUpdate.destination = { city: args.destinationCity };
    }
    if (args.startDate !== undefined) summaryUpdate.outbound_date = args.startDate;
    if (args.endDate !== undefined) summaryUpdate.return_date = args.endDate;
    if (args.adults !== undefined) summaryUpdate.pax = args.adults;
    if (args.budgetAmount !== undefined || args.currency !== undefined) {
      summaryUpdate.budget = {};
      if (args.budgetAmount !== undefined) summaryUpdate.budget.amount = args.budgetAmount;
      if (args.currency !== undefined) summaryUpdate.budget.currency = args.currency;
    }

    // Use the updateSummary logic
    return await updateSummary.execute(summaryUpdate, runContext);
  },
});

const destinationAgent = new Agent({
  name: 'Destination Decider Agent',
  instructions: (rc) => [
    DESTINATION_DECIDER_PROMPT,
    contextSnapshot(rc),
  ].join('\n'),
  tools: [updateSummary, captureTripParams],
  modelSettings: { toolChoice: 'required' }
});

const itineraryAgent = new Agent({
  name: 'Itinerary Planner Agent',
  instructions: (rc) => [
    ITINERARY_PLANNER_PROMPT,
    contextSnapshot(rc),
  ].join('\n'),
  tools: [updateSummary, updateItinerary, captureTripParams],
  modelSettings: { toolChoice: 'required' }
});

const bookingAgent = new Agent({
  name: 'Booking Agent',
  instructions: (rc) => [
    BOOKING_AGENT_PROMPT,
    contextSnapshot(rc),
  ].join('\n'),
  tools: [updateSummary, captureTripParams],
  modelSettings: { toolChoice: 'required' }
});

const destinationTool = destinationAgent.asTool({
  toolName: 'transfer_to_destination_decider',
  toolDescription: 'Help the user choose a destination based on interests, vibe, and constraints.',
});

const itineraryTool = itineraryAgent.asTool({
  toolName: 'transfer_to_itinerary_planner',
  toolDescription: 'Create a day-wise itinerary once destination and basics are available.',
});

const bookingTool = bookingAgent.asTool({
  toolName: 'transfer_to_booking_agent',
  toolDescription: 'Assist with booking flights/hotels after plan and dates are set.',
});

export const enhancedManagerAgent = new Agent({
  name: 'Manager Agent',
  instructions: `${RECOMMENDED_PROMPT_PREFIX}\n\n${MANAGER_PROMPT}`,
  tools: [destinationTool, itineraryTool, bookingTool],
  modelSettings: {
    toolChoice: 'required',
    temperature: 0.1  // Lower temperature for more consistent tool usage
  }
});

// Debug event handlers
[destinationAgent, itineraryAgent, bookingAgent, enhancedManagerAgent].forEach(agent => {
  agent.on('agent_start', (ctx, agentRef) => {
    console.log(`[${agentRef.name}] started`);
    const context = ctx?.context;
    if (context) {
      console.log(`[${agentRef.name}] summary:`, JSON.stringify(context.summary, null, 2));
      console.log(`[${agentRef.name}] itinerary days:`, context.itinerary?.days?.length || 0);
    }
  });

  agent.on('agent_end', (ctx, output) => {
    console.log('[agent] produced:', output);
    const context = ctx?.context;
    if (context) {
      console.log('[agent] updated summary:', JSON.stringify(context.summary, null, 2));
      console.log('[agent] updated itinerary days:', context.itinerary?.days?.length || 0);
    }
  });
});

const HISTORY_PATH = path.resolve('enhanced-manager-thread.json');
let thread = [];

async function loadThread() {
  try {
    thread = JSON.parse(await fs.readFile(HISTORY_PATH, 'utf8'));
    console.log(`(loaded ${thread.length} items from ${HISTORY_PATH})`);
  } catch {
    thread = [];
  }
}

async function saveThread() {
  await fs.writeFile(HISTORY_PATH, JSON.stringify(thread, null, 2), 'utf8');
}

export async function runEnhancedManager() {
  await loadThread();

  const rl = readline.createInterface({ input, output });
  console.log('Enhanced Manager Agent CLI — type "exit" to quit. Commands: /reset /save /load /context');

  process.on('SIGINT', async () => {
    console.log('\n(^C) Saving session…');
    await saveThread();
    rl.close();
    process.exit(0);
  });

  const appContext = createEnhancedContext({ name: 'Harsh', uid: 1 });

  while (true) {
    let q;
    try {
      q = await rl.question('you> ');
    } catch {
      break;
    }
    if (q == null) break;
    const qt = q.trim();
    if (!qt) continue;
    if (qt.toLowerCase() === 'exit') break;
    if (qt === '/reset') {
      thread = [];
      Object.assign(appContext, createEnhancedContext({ name: 'Harsh', uid: 1 }));
      await saveThread();
      console.log('(history and context reset)');
      continue;
    }
    if (qt === '/save')  { await saveThread(); console.log(`(saved to ${HISTORY_PATH})`); continue; }
    if (qt === '/load')  { await loadThread(); continue; }
    if (qt === '/context') {
      console.log('\n[CURRENT CONTEXT]');
      console.log('Summary:', JSON.stringify(appContext.summary, null, 2));
      console.log('Itinerary days:', appContext.itinerary.days.length);
      console.log('Itinerary computed:', JSON.stringify(appContext.itinerary.computed, null, 2));
      continue;
    }

    try {
      const res = await run(enhancedManagerAgent, thread.concat(user(qt)), { context: appContext });

      thread = res.history;

      console.log(`\n[last agent]: ${res.lastAgent?.name ?? 'Unknown Agent'}`);
      if (Array.isArray(res.finalOutput)) {
        console.log(res.finalOutput.map(String).join('\n'));
      } else {
        console.log(String(res.finalOutput ?? ''));
      }

      console.log('\n[ENHANCED CONTEXT]');
      console.log('Summary:', JSON.stringify(appContext.summary, null, 2));
      console.log('Itinerary days:', appContext.itinerary.days.length);
      if (appContext.itinerary.days.length > 0) {
        console.log('Itinerary preview:', appContext.itinerary.days.map(d => d.title).join(', '));
      }
      console.log();

      await saveThread();
    } catch (err) {
      console.error('Error during run:', err?.message ?? err);
      await saveThread();
    }
  }

  await saveThread();
  rl.close();
  console.log('Enhanced session ended. Bye!');
}

const isDirectRun = (() => {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
    return thisFile === invoked;
  } catch {
    return true;
  }
})();

if (isDirectRun) {
  runEnhancedManager().catch(async (err) => {
    console.error(err);
    await saveThread();
    process.exit(1);
  });
}

// Export for use in other modules
export {
  createEnhancedContext,
  updateSummary,
  updateItinerary,
  destinationAgent,
  itineraryAgent,
  bookingAgent
};