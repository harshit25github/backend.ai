import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'simple-final-' + Date.now();

console.log('✅ SIMPLE FINAL TEST: Agent-Driven Questions');
console.log('==========================================');

async function test() {
    try {
        // Test 1: Basic trip setup
        const response1 = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: SESSION_ID,
                message: "I want to travel to Tokyo from Chicago",
                userInfo: { name: 'Final', uid: 123 }
            })
        });

        const result1 = await response1.json();
        const questions1 = result1.context.summary.suggestedQuestions;
        const hasTextQuestions1 = result1.message.toLowerCase().includes('you might want to ask');

        console.log(`\n📊 Turn 1 Results:`);
        console.log(`   Questions in array: ${questions1.length}`);
        console.log(`   Text questions in response: ${hasTextQuestions1 ? 'YES (❌)' : 'NO (✅)'}`);
        console.log(`   Sample: "${questions1[0]}"`);

        // Test 2: Add more details
        const response2 = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: SESSION_ID,
                message: "2 people, $4000 budget, interested in culture and food",
                userInfo: { name: 'Final', uid: 123 }
            })
        });

        const result2 = await response2.json();
        const questions2 = result2.context.summary.suggestedQuestions;
        const hasTextQuestions2 = result2.message.toLowerCase().includes('you might want to ask');
        const questionsChanged = JSON.stringify(questions1) !== JSON.stringify(questions2);

        console.log(`\n📊 Turn 2 Results:`);
        console.log(`   Questions in array: ${questions2.length}`);
        console.log(`   Text questions in response: ${hasTextQuestions2 ? 'YES (❌)' : 'NO (✅)'}`);
        console.log(`   Questions changed from turn 1: ${questionsChanged ? 'YES (✅)' : 'NO (❌)'}`);
        console.log(`   Sample: "${questions2[0]}"`);

        const success = !hasTextQuestions1 && !hasTextQuestions2 && questionsChanged && questions1.length > 0 && questions2.length > 0;

        console.log(`\n🎯 FINAL STATUS: ${success ? 'SUCCESS ✅' : 'NEEDS FIX ❌'}`);
        console.log(`   ✅ Agent-driven questions (no auto-generation): ${success ? 'WORKING' : 'BROKEN'}`);
        console.log(`   ✅ Questions update every turn: ${questionsChanged ? 'WORKING' : 'BROKEN'}`);
        console.log(`   ✅ No text questions in responses: ${!hasTextQuestions1 && !hasTextQuestions2 ? 'WORKING' : 'BROKEN'}`);

        return success;

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

await test();