import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'quick-agent-test-' + Date.now();

console.log('🚀 Quick Agent Question Update Test');
console.log('===================================');

async function testQuestionUpdate() {
    try {
        // Turn 1: Initial greeting
        console.log('\n--- TURN 1: Greeting ---');
        const turn1 = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: SESSION_ID,
                message: "Hi! I want to plan a vacation",
                userInfo: { name: 'QuickTest', uid: 123 }
            })
        });

        const result1 = await turn1.json();
        const questions1 = result1.context.summary.suggestedQuestions || [];
        console.log(`Questions (${questions1.length}): ${questions1.slice(0, 2).join(', ')}...`);

        // Turn 2: Add details
        console.log('\n--- TURN 2: Add Details ---');
        const turn2 = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: SESSION_ID,
                message: "I'm from NYC, 2 people, going to Paris, $4000 budget",
                userInfo: { name: 'QuickTest', uid: 123 }
            })
        });

        const result2 = await turn2.json();
        const questions2 = result2.context.summary.suggestedQuestions || [];
        console.log(`Questions (${questions2.length}): ${questions2.slice(0, 2).join(', ')}...`);

        // Compare
        const questionsChanged = JSON.stringify(questions1) !== JSON.stringify(questions2);
        console.log(`\n🎯 Result: Questions ${questionsChanged ? 'CHANGED ✅' : 'SAME ❌'}`);

        return questionsChanged;

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

const success = await testQuestionUpdate();
console.log(`\n📊 Overall: ${success ? 'WORKING!' : 'NEEDS FIX'}`);