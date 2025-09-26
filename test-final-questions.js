import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'final-questions-test-' + Date.now();

console.log('🎯 FINAL TEST: Suggested Questions Update Every Turn');
console.log('==================================================');

async function testTurn(message, turnNum) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`TURN ${turnNum}: ${message.substring(0, 40)}...`);
    console.log('='.repeat(50));

    const response = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId: SESSION_ID,
            message,
            userInfo: { name: 'FinalTest', uid: 999 }
        })
    });

    const result = await response.json();

    const questions = result.context.summary.suggestedQuestions || [];
    console.log(`📊 Questions: ${questions.length} items`);

    questions.forEach((q, i) => {
        console.log(`   ${i + 1}. ${q}`);
    });

    return questions;
}

try {
    const turn1Questions = await testTurn("Hi, I want to travel somewhere amazing!", 1);
    const turn2Questions = await testTurn("I'm from Boston, 2 people, $5000 budget, going to Italy in July", 2);
    const turn3Questions = await testTurn("Tell me about Rome attractions and travel tips", 3);

    console.log('\n' + '='.repeat(50));
    console.log('📈 RESULTS SUMMARY');
    console.log('='.repeat(50));

    const questionsChanged12 = JSON.stringify(turn1Questions) !== JSON.stringify(turn2Questions);
    const questionsChanged23 = JSON.stringify(turn2Questions) !== JSON.stringify(turn3Questions);

    console.log(`✅ Questions changed Turn 1→2: ${questionsChanged12 ? 'YES' : 'NO'}`);
    console.log(`✅ Questions changed Turn 2→3: ${questionsChanged23 ? 'YES' : 'NO'}`);
    console.log(`🎯 Overall Success: ${(questionsChanged12 && questionsChanged23) ? 'WORKING!' : 'NEEDS FIX'}`);

} catch (error) {
    console.error('Test failed:', error.message);
}