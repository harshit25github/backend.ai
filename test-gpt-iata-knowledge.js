import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log('🧪 Testing GPT-4.1 Knowledge of Airport IATA Codes\n');
console.log('='.repeat(80));

const testCities = [
  // Major cities
  { city: 'Delhi', country: 'India', expected: 'DEL' },
  { city: 'Mumbai', country: 'India', expected: 'BOM' },
  { city: 'Chennai', country: 'India', expected: 'MAA' },
  { city: 'Bangalore', country: 'India', expected: 'BLR' },
  { city: 'Kolkata', country: 'India', expected: 'CCU' },
  { city: 'Hyderabad', country: 'India', expected: 'HYD' },

  // Medium cities
  { city: 'Goa', country: 'India', expected: 'GOI' },
  { city: 'Pune', country: 'India', expected: 'PNQ' },
  { city: 'Jaipur', country: 'India', expected: 'JAI' },

  // Smaller cities
  { city: 'Jabalpur', country: 'India', expected: 'JLR' },
  { city: 'Nellore', country: 'India', expected: 'No airport (nearest: TIR - Tirupati)' },

  // International
  { city: 'New York', country: 'USA', expected: 'JFK/LGA/EWR' },
  { city: 'London', country: 'UK', expected: 'LHR/LGW/STN' },
  { city: 'Paris', country: 'France', expected: 'CDG/ORY' },
  { city: 'Dubai', country: 'UAE', expected: 'DXB' },
];

async function testIATAKnowledge() {
  console.log('\n📋 Testing cities:\n');

  let correct = 0;
  let total = 0;

  for (const test of testCities) {
    total++;

    const prompt = `What is the airport IATA code for ${test.city}, ${test.country}?

IMPORTANT:
- Only respond with the 3-letter IATA code(s).
- If the city has multiple airports, list all major ones separated by comma.
- If the city has no airport, say "No airport" and mention the nearest airport with its IATA code.
- Do NOT use web search or external tools. Use only your training data.
- Format: Just the code(s), nothing else.

Example responses:
- "DEL"
- "JFK, LGA, EWR"
- "No airport (nearest: TIR - Tirupati, 120km)"`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Using cheaper model first to test
        messages: [{ role: 'user', content: prompt }],
        temperature: 0, // Deterministic
        max_tokens: 50
      });

      const answer = response.choices[0].message.content.trim();
      const isCorrect = answer.includes(test.expected.split('/')[0].split(',')[0]);

      console.log(`${isCorrect ? '✅' : '❌'} ${test.city.padEnd(12)} | Expected: ${test.expected.padEnd(30)} | Got: ${answer}`);

      if (isCorrect) correct++;

      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.log(`❌ ${test.city.padEnd(12)} | Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Results: ${correct}/${total} correct (${((correct/total)*100).toFixed(1)}%)`);

  if (correct / total > 0.9) {
    console.log('\n✅ GPT-4.1 has excellent IATA code knowledge! You can skip web_search for most cities.');
  } else if (correct / total > 0.7) {
    console.log('\n⚠️  GPT-4.1 has good IATA knowledge for major cities, but may need web_search for smaller cities.');
  } else {
    console.log('\n❌ GPT-4.1 IATA knowledge is unreliable. Keep using web_search.');
  }
}

testIATAKnowledge().catch(console.error);
