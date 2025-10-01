import { enhancedManagerAgent, createEnhancedContext } from './src/ai/enhanced-manager.js';
import { run, user } from '@openai/agents';

console.log('='.repeat(80));
console.log('TESTING SUGGESTED QUESTIONS PERSPECTIVE');
console.log('Expected: Questions from USER asking AGENT');
console.log('Wrong: Questions from AGENT asking USER');
console.log('='.repeat(80));

const appContext = createEnhancedContext({ name: 'Test User', uid: 1 });

const userMessage = "Create a 3-day Rome itinerary for 2 people, budget 1200 EUR";
console.log('\nUSER:', userMessage);

try {
  const res = await run(enhancedManagerAgent, [{ role: 'user', content: userMessage }], { context: appContext });

  console.log('\n' + '='.repeat(80));
  console.log('SUGGESTED QUESTIONS CAPTURED:');
  console.log('='.repeat(80));

  const questions = appContext.summary.suggestedQuestions;
  console.log(`\nCount: ${questions.length}\n`);

  // Analyze each question
  const wrongPatterns = [
    'would you like',
    'do you want',
    'are you interested',
    'should i',
    'can i',
    'shall i'
  ];

  const correctPatterns = [
    'what',
    'how',
    'where',
    'which',
    'when',
    'who'
  ];

  let correctCount = 0;
  let wrongCount = 0;

  questions.forEach((q, idx) => {
    const lowerQ = q.toLowerCase();
    const isWrong = wrongPatterns.some(pattern => lowerQ.includes(pattern));
    const isCorrect = correctPatterns.some(pattern => lowerQ.startsWith(pattern));

    console.log(`${idx + 1}. ${q}`);

    if (isWrong) {
      console.log(`   ❌ WRONG - Agent asking user`);
      wrongCount++;
    } else if (isCorrect) {
      console.log(`   ✅ CORRECT - User asking agent`);
      correctCount++;
    } else {
      console.log(`   ⚠️  UNCLEAR`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION RESULT');
  console.log('='.repeat(80));
  console.log(`Correct (user asking agent): ${correctCount}`);
  console.log(`Wrong (agent asking user): ${wrongCount}`);
  console.log(`Total: ${questions.length}`);

  const passed = wrongCount === 0 && correctCount >= 3;
  console.log(`\nOVERALL: ${passed ? '✅ PASS' : '❌ FAIL'}`);

  if (!passed) {
    console.log('\n⚠️  Issues found:');
    if (wrongCount > 0) {
      console.log(`   - ${wrongCount} questions are from agent asking user (should be user asking agent)`);
    }
    if (correctCount < 3) {
      console.log(`   - Only ${correctCount} correct questions (need at least 3)`);
    }
  }

} catch (err) {
  console.error('❌ ERROR:', err.message);
}
