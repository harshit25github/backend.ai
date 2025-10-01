import { enhancedManagerAgent, createEnhancedContext } from './src/ai/enhanced-manager.js';
import { run, user } from '@openai/agents';

async function testSilentQuestions() {
  console.log('='.repeat(80));
  console.log('TESTING SILENT QUESTIONS (should NOT mention in response)');
  console.log('='.repeat(80));

  const appContext = createEnhancedContext({ name: 'Test User', uid: 1 });
  let thread = [];

  const userMessage = "Create a 3-day Rome itinerary for 2 people, budget 1200 EUR";
  console.log('\nUSER:', userMessage);

  try {
    const res = await run(enhancedManagerAgent, thread.concat(user(userMessage)), { context: appContext });
    thread = res.history;

    const agentResponse = Array.isArray(res.finalOutput) ? res.finalOutput.join('\n') : res.finalOutput;

    console.log('\n' + '='.repeat(80));
    console.log('AGENT RESPONSE ANALYSIS');
    console.log('='.repeat(80));

    // Check for problematic phrases
    const problematicPhrases = [
      'questions have been prepared',
      'questions to personalize',
      'prepared silently',
      'questions will help',
      'follow-up questions',
      'i\'ve created questions',
      'questions for you'
    ];

    let foundProblematic = false;
    const lowerResponse = agentResponse.toLowerCase();

    problematicPhrases.forEach(phrase => {
      if (lowerResponse.includes(phrase)) {
        console.log(`❌ FOUND PROBLEMATIC PHRASE: "${phrase}"`);
        foundProblematic = true;
      }
    });

    if (!foundProblematic) {
      console.log('✅ Response does NOT mention questions');
    }

    // Check questions captured
    console.log('\n' + '='.repeat(80));
    console.log('QUESTIONS CAPTURED (silently)');
    console.log('='.repeat(80));
    console.log(`Count: ${appContext.summary.suggestedQuestions.length}`);

    if (appContext.summary.suggestedQuestions.length > 0) {
      appContext.summary.suggestedQuestions.forEach((q, idx) => {
        console.log(`${idx + 1}. ${q}`);
      });
    }

    // Validation
    const validation = {
      questionsNotMentioned: !foundProblematic,
      questionsCaptured: appContext.summary.suggestedQuestions.length > 0,
      questionsCount: appContext.summary.suggestedQuestions.length
    };

    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION RESULT');
    console.log('='.repeat(80));
    console.log(`Questions NOT mentioned in response: ${validation.questionsNotMentioned ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Questions captured silently: ${validation.questionsCaptured ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Questions count: ${validation.questionsCount}`);

    const overallPass = validation.questionsNotMentioned && validation.questionsCaptured;
    console.log(`\nOVERALL: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);

    if (!overallPass && foundProblematic) {
      console.log('\n📝 Response preview (first 500 chars):');
      console.log(agentResponse.substring(0, 500));
    }

  } catch (err) {
    console.error('❌ ERROR:', err.message);
  }
}

testSilentQuestions().catch(console.error);
