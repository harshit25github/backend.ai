import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log('🧪 Minimal Test: GPT-4o-mini IATA Code Knowledge\n');
console.log('='.repeat(60));

const testCities = [
  // Just 3 major cities to start
  { city: 'Delhi', country: 'India', expected: 'DEL' },
  { city: 'Mumbai', country: 'India', expected: 'BOM' },
  { city: 'New York', country: 'USA', expected: 'JFK' }
];

async function testIATAKnowledge() {
  console.log('\n📋 Testing 3 major cities:\n');

  let correct = 0;
  let total = 0;

  for (const test of testCities) {
    total++;

    const prompt = `What is the airport IATA code for ${test.city}, ${test.country}?

IMPORTANT:
- Only respond with the 3-letter IATA code(s).
- If multiple airports exist, list the main/primary one first.
- Do NOT use web search. Use only your training data.
- Format: Just the code(s), nothing else.

Example: "DEL" or "JFK, LGA, EWR"`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 30
      });

      const answer = response.choices[0].message.content.trim();
      const isCorrect = answer.includes(test.expected);

      console.log(`${isCorrect ? '✅' : '❌'} ${test.city.padEnd(12)} | Expected: ${test.expected.padEnd(20)} | Got: ${answer}`);

      if (isCorrect) correct++;

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`❌ ${test.city.padEnd(12)} | Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Results: ${correct}/${total} correct (${((correct/total)*100).toFixed(1)}%)`);

  if (correct === total) {
    console.log('\n✅ gpt-4o-mini knows IATA codes for major cities!');
    console.log('Next step: Test with more cities including smaller ones.');
  } else {
    console.log('\n❌ gpt-4o-mini does not reliably know IATA codes.');
    console.log('Recommendation: Continue using web_search for all cities.');
  }
}

testIATAKnowledge().catch(console.error);
