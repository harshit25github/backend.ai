import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

const chatId = 'test-children-ages-validation';

async function test() {
  console.log('\n🧪 Testing Children Ages Validation\n');
  console.log('='.repeat(80));

  const conversationHistory = [];

  // Test 1: Request without children ages
  console.log('\n📝 Test 1: User requests "Find flights for 2 adults and 1 child from Delhi to Mumbai"');
  console.log('Expected: Agent should call tool, tool returns asking for age\n');

  const userMessage = 'Find flights for 2 adults and 1 child from Delhi to Mumbai on January 20, 2025';
  conversationHistory.push({ role: 'user', content: userMessage });

  try {
    const result = await runMultiAgentSystem(
      userMessage,
      chatId,
      conversationHistory,
      false
    );

    const output = Array.isArray(result.finalOutput)
      ? result.finalOutput.map(String).join('\n')
      : String(result.finalOutput ?? '');

    console.log('🤖 Agent Response:');
    console.log('-'.repeat(80));
    console.log(output);
    console.log('-'.repeat(80));

    if (output.includes('age of the child') || output.includes('What is the age')) {
      console.log('\n✅ SUCCESS: Agent asked for child age!');
    } else {
      console.log('\n❌ FAIL: Agent did not ask for child age');
      console.log('\nAgent should have received feedback from tool and asked for age.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test().catch(console.error);
