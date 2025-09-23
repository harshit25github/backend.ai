import { structuredItineraryExtractor } from './src/ai/multiAgentSystem.js';
import { user, run } from '@openai/agents';

async function testExtractor() {
  const testResponse = `### Day 1: Arrival & Exploring South Mumbai

**🌅 Morning**
- **Arrival in Mumbai**: Fly from Delhi to Mumbai and arrive at Chhatrapati Shivaji Maharaj International Airport.
- **Breakfast at Café Madras**: Head to Matunga for some authentic South Indian breakfast.

**☀️ Afternoon**
- **Visit Gateway of India**: Explore this iconic arch monument around 11:00 AM.
- **Take a Ferry to Elephanta Caves**: Ferry departs at 1:00 PM, takes about 1 hour.

**🌆 Evening**
- **Marine Drive**: Take a relaxing walk along the promenade as the sun sets.
- **Dinner at Bademiya**: Famous for its kebabs and rolls.

---

### Day 2: Culture & Shopping

**🌅 Morning**
- **Breakfast at hotel** and set out to visit Siddhivinayak Temple.
- **Chhatrapati Shivaji Maharaj Terminus (CST)**: Explore the UNESCO World Heritage Site.

**☀️ Afternoon**
- **Lunch at Café Madras**: Known for South Indian delicacies.
- **Shopping at Colaba Causeway**: Browse through local shops for souvenirs.

**🌆 Evening**
- **Bandra-Worli Sea Link**: Drive over this architectural marvel at sunset.
- **Dinner at The Bombay Canteen**: Experience a modern twist on Indian cuisine.`;

  console.log('Testing structuredItineraryExtractor...');
  console.log('Test response length:', testResponse.length);
  console.log('Contains Day patterns:', /\bDay\b/i.test(testResponse));
  console.log('Contains time segments:', /(Morning|Afternoon|Evening)/i.test(testResponse));

  try {
    const result = await run(structuredItineraryExtractor, [user(testResponse)]);
    console.log('✅ Extraction successful!');
    console.log('Result:', JSON.stringify(result.output, null, 2));

    if (result.output?.days?.length > 0) {
      console.log(`✅ Successfully extracted ${result.output.days.length} days!`);
    } else {
      console.log('❌ No days extracted');
    }
  } catch (error) {
    console.error('❌ Extraction failed:', error.message);
    console.error('❌ Error stack:', error.stack);
  }
}

testExtractor();
