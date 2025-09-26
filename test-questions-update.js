import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'questions-update-test-' + Date.now();

console.log('🔍 TESTING SUGGESTED QUESTIONS UPDATE ON EVERY TURN');
console.log('==================================================');
console.log('Session ID:', SESSION_ID);

async function sendMessageAndCheckQuestions(message, stepName) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${stepName}`);
    console.log(`Message: "${message}"`);
    console.log('='.repeat(60));

    const response = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            sessionId: SESSION_ID,
            message,
            userInfo: { name: 'QuestionsTest', uid: 777 }
        })
    });

    const result = await response.json();

    console.log(`\n🤖 Agent: ${result.lastAgent}`);
    console.log(`📝 Response preview: ${result.message.substring(0, 150)}...`);

    // Check if response contains "You might want to ask"
    const hasQuestionSection = result.message.includes('You might want to ask') ||
                              result.message.includes('might want to ask') ||
                              result.message.includes('You may want to ask');

    console.log(`❓ Response contains question suggestions: ${hasQuestionSection ? 'YES' : 'NO'}`);

    // Check context
    const questions = result.context.summary.suggestedQuestions || [];
    console.log(`📊 Suggested questions in context: ${questions.length} items`);

    if (questions.length > 0) {
        console.log(`📋 Current questions:`);
        questions.forEach((q, index) => {
            console.log(`   ${index + 1}. ${q}`);
        });
    } else {
        console.log(`❌ NO QUESTIONS CAPTURED IN CONTEXT`);
    }

    return result;
}

try {
    console.log('\n🚀 Starting questions update test...');

    // Turn 1: Initial greeting
    await sendMessageAndCheckQuestions(
        "Hi, I want to plan a trip somewhere exotic.",
        "TURN 1: Initial greeting"
    );

    // Turn 2: Add some details
    await sendMessageAndCheckQuestions(
        "I'm from London and want to go to Thailand for 2 weeks with a budget of $3000.",
        "TURN 2: Provide trip details"
    );

    // Turn 3: Ask for destination insights
    await sendMessageAndCheckQuestions(
        "Tell me more about Thailand. What are the must-see places and any travel tips?",
        "TURN 3: Request destination insights"
    );

    console.log('\n' + '='.repeat(60));
    console.log('📊 ANALYSIS: Questions Should Update Every Turn');
    console.log('='.repeat(60));
    console.log('✅ Expected: Different questions after each agent response');
    console.log('❌ Issue: Questions only set once and not updated on subsequent turns');

} catch (error) {
    console.error('\n💥 Test failed:', error.message);
}