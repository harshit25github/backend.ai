import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'turn-update-test-' + Date.now();

console.log('🔄 TESTING: suggestedQuestions Update on Every Turn');
console.log('===============================================');
console.log('Session ID:', SESSION_ID);

async function testTurn(message, turnDescription) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`${turnDescription}`);
    console.log(`Message: "${message}"`);
    console.log('='.repeat(50));

    const response = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId: SESSION_ID,
            message,
            userInfo: { name: 'TurnTest', uid: 777 }
        })
    });

    const result = await response.json();
    const questions = result.context.summary.suggestedQuestions || [];

    console.log(`🤖 Agent: ${result.lastAgent}`);
    console.log(`❓ Questions count: ${questions.length}`);
    console.log(`📋 Questions:`);
    questions.forEach((q, i) => {
        console.log(`   ${i + 1}. ${q}`);
    });

    return { questions, agent: result.lastAgent };
}

try {
    // Turn 1: Greeting
    const turn1 = await testTurn(
        "Hi, I want to plan a vacation!",
        "TURN 1: Initial Greeting"
    );

    // Turn 2: Add details
    const turn2 = await testTurn(
        "I'm from New York, 2 people, going to Barcelona, $4000 budget, traveling in October.",
        "TURN 2: Provide Trip Details"
    );

    // Turn 3: Ask for insights
    const turn3 = await testTurn(
        "Tell me about Barcelona attractions and Spanish culture tips.",
        "TURN 3: Request Destination Insights"
    );

    // Compare questions across turns
    console.log('\n' + '='.repeat(50));
    console.log('📊 COMPARISON ACROSS TURNS');
    console.log('='.repeat(50));

    const q1String = JSON.stringify(turn1.questions.sort());
    const q2String = JSON.stringify(turn2.questions.sort());
    const q3String = JSON.stringify(turn3.questions.sort());

    console.log(`✅ Turn 1→2 Changed: ${q1String !== q2String ? 'YES' : 'NO'}`);
    console.log(`✅ Turn 2→3 Changed: ${q2String !== q3String ? 'YES' : 'NO'}`);

    if (q1String === q2String && q2String === q3String) {
        console.log('❌ ISSUE: Questions are NOT updating every turn!');
        console.log('❌ Same questions across all turns');
    } else {
        console.log('✅ SUCCESS: Questions are updating across turns!');
    }

    // Show unique questions
    const allQuestions = [...new Set([...turn1.questions, ...turn2.questions, ...turn3.questions])];
    console.log(`\n📈 Total unique questions seen: ${allQuestions.length}`);
    console.log(`📊 Expected: Different questions per turn based on context`);

} catch (error) {
    console.error('❌ Test failed:', error.message);
}