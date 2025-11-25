import fs from 'fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFutureDate(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Condensed system prompt for supervised examples
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the CheapOair Flight Specialist Agent.

Hard rules:
- Never mention competitor OTAs (Expedia, Kayak, Skyscanner, MakeMyTrip, etc.). If users mention them, redirect to CheapOair without repeating competitor names.
- Never mention tool names or internal steps.
- Dates must be in the future and within 12 months; reject past/over-12-month dates.
- Always gather/confirm: origin, destination, dates (YYYY-MM-DD), pax breakdown (adults/seniors/children with ages, seat vs lap infants), cabin, trip type, IATAs.
- Modifications (any change to pax, dates, cabin, trip type, filters, destination) must trigger a new search/response—do not reuse old results.
- Use labels: Recommended 1, Recommended 2, Recommended 3 (if only 1, use Recommended 1; if 2, use Recommended 1 and Recommended 2).
- No hallucinated data; only show structured results we "have".
- Clean markdown: headings with ##/###, hyphen bullets, blank lines before/after lists.
`;

// ---------------------------------------------------------------------------
// Example generation helpers
// ---------------------------------------------------------------------------

function makeOptions(origin, destination, dates, paxLine, cabin, labels) {
  const lbls = labels && labels.length ? labels : [
    '### 🏅 Recommended 1: [Airline A]',
    '### 🏅 Recommended 2: [Airline B]',
    '### 🏅 Recommended 3: [Airline C]'
  ];
  const blocks = lbls.map((l) => `${l}
- Outbound: [Date/Time] from ${origin}
- Return: [Date/Time] from ${destination}
- Duration: [X hours], Stops: [Direct/1 Stop]
- Baggage: [Check-in/Cabin]

---`).join('\n\n');

  return `## ✈️ Flight Options: ${origin} → ${destination}

**Travel Dates:** ${dates}
**Passengers:** ${paxLine}
**Cabin:** ${cabin}

---

${blocks}

📖 Summary: Showing ${lbls.length} option(s). Book on CheapOair.com.`;
}

function addExample(examples, messages) {
  examples.push({ messages });
}

// ---------------------------------------------------------------------------
// Brutal multi-turn examples (target ~80)
// ---------------------------------------------------------------------------

const brutalRoutes = [
  ['Delhi', 'Bangkok'],
  ['New York', 'Paris'],
  ['London', 'Dubai'],
  ['Mumbai', 'Kochi'],
  ['San Francisco', 'Tokyo'],
  ['Toronto', 'Lisbon'],
  ['Sydney', 'Bali'],
  ['Chicago', 'Rome'],
  ['Bengaluru', 'Goa'],
  ['Los Angeles', 'Mexico City']
];

const cabins = ['economy', 'business', 'premium economy'];
const tripTypes = ['roundtrip', 'oneway'];

const brutalExamples = [];
let counter = 0;

for (const [origin, destination] of brutalRoutes) {
  for (const cabin of cabins) {
    const tripType = tripTypes[counter % tripTypes.length];
    const outbound = getFutureDate(10 + counter);
    const ret = tripType === 'roundtrip' ? getFutureDate(17 + counter) : null;
    const dates = tripType === 'roundtrip' ? `${outbound} to ${ret}` : outbound;

    // Infant seat ↔ lap toggles with child
    addExample(brutalExamples, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Find ${tripType} flights from ${origin} to ${destination} on ${dates} for 2 adults, 1 child age 6, and 2 seat infants, cabin ${cabin}.` },
      { role: 'assistant', content: makeOptions(origin, destination, dates, '2 adults, 1 child (6), 2 seat infants', cabin) },
      { role: 'user', content: 'Make it 1 seat infant and 1 lap infant; keep the rest the same.' },
      { role: 'assistant', content: makeOptions(origin, destination, dates, '2 adults, 1 child (6), 1 seat infant, 1 lap infant', cabin) },
      { role: 'user', content: 'Now both lap infants.' },
      { role: 'assistant', content: makeOptions(origin, destination, dates, '2 adults, 1 child (6), 2 lap infants', cabin) }
    ]);
    counter++;

    // Trip type and cabin flips
    const newOut = getFutureDate(25 + counter);
    const newRet = getFutureDate(32 + counter);
    addExample(brutalExamples, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Need flights ${origin} to ${destination}, ${tripType}, ${cabin}, 2 adults + 1 lap infant on ${dates}.` },
      { role: 'assistant', content: makeOptions(origin, destination, dates, '2 adults, 1 lap infant', cabin) },
      { role: 'user', content: `Switch to business and move dates to ${newOut}${tripType === 'roundtrip' ? ' returning ' + newRet : ''}.` },
      { role: 'assistant', content: makeOptions(origin, destination, tripType === 'roundtrip' ? `${newOut} to ${newRet}` : newOut, '2 adults, 1 lap infant', 'business') },
      { role: 'user', content: 'Back to economy, same dates.' },
      { role: 'assistant', content: makeOptions(origin, destination, tripType === 'roundtrip' ? `${newOut} to ${newRet}` : newOut, '2 adults, 1 lap infant', 'economy') }
    ]);
    counter++;

    // Direct-only and preferred airline toggles
    addExample(brutalExamples, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Flights from ${origin} to ${destination} on ${dates} for 2 adults, direct flights only, cabin ${cabin}.` },
      { role: 'assistant', content: makeOptions(origin, destination, dates, '2 adults', cabin, ['### 🏅 Recommended 1: [Airline Direct A]', '### 🏅 Recommended 2: [Airline Direct B]']) },
      { role: 'user', content: 'Remove direct-only, prefer Air France.' },
      { role: 'assistant', content: makeOptions(origin, destination, dates, '2 adults', cabin, ['### 🏅 Recommended 1: Air France', '### 🏅 Recommended 2: [Airline B]', '### 🏅 Recommended 3: [Airline C]']) }
    ]);
    counter++;

    // Competitor mention redirection
    addExample(brutalExamples, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Show me options like on Expedia for ${origin} to ${destination} on ${dates}, 2 adults, 1 seat infant.` },
      { role: 'assistant', content: `I'll handle this on CheapOair.com. Here are your options:\n\n${makeOptions(origin, destination, dates, '2 adults, 1 seat infant', cabin, ['### 🏅 Recommended 1: [Airline A]', '### 🏅 Recommended 2: [Airline B]'])}` }
    ]);
    counter++;

    if (counter >= 80) break;
  }
  if (counter >= 80) break;
}

// Trim to target count
const TARGET = 80;
const trimmedExamples = brutalExamples.slice(0, TARGET);

// ---------------------------------------------------------------------------
// Final dataset composition
// ---------------------------------------------------------------------------

const allTrainingExamples = trimmedExamples;

console.log(`\n🚀 Flight Agent Training Data Summary:`);
console.log(`   - Brutal multi-turn examples: ${allTrainingExamples.length}`);

// Split 80-20 for train/validation
const splitIndex = Math.floor(allTrainingExamples.length * 0.8);
const trainData = allTrainingExamples.slice(0, splitIndex);
const validData = allTrainingExamples.slice(splitIndex);

function writeJSONL(filename, data) {
  const content = data.map((ex) => JSON.stringify(ex)).join('\n');
  fs.writeFileSync(filename, content, 'utf8');
  console.log(`✅ Generated ${filename} with ${data.length} examples`);
}

console.log('\n⏳ Generating Flight Agent fine-tuning data...\n');
writeJSONL('flight-train.jsonl', trainData);
writeJSONL('flight-valid.jsonl', validData);

console.log(`\n📦 Final Summary:`);
console.log(`   Training examples: ${trainData.length}`);
console.log(`   Validation examples: ${validData.length}`);
console.log(`   Total examples: ${allTrainingExamples.length}`);
console.log(`\nCoverage: infant toggles, date/cabin/trip-type shifts, direct/preferred filters, competitor redirection, Recommended 1/2/3 labels, brand safety.`);
