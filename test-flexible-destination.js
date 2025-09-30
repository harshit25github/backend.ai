import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'flexible-dest-' + Date.now();

console.log('🎯 Testing Flexible Destination Agent (Option 2)');
console.log('===============================================');
console.log('Manager: No requirements for destination tool');
console.log('Destination Agent: Works with any level of info');
console.log('');

async function testFlexibleDestination() {
    try {
        // Test 1: Minimal request - should work immediately
        console.log('--- TEST 1: Minimal Request ---');
        console.log('Message: "Where should I travel?"');

        const response1 = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: SESSION_ID + '_1',
                message: "Where should I travel?",
                userInfo: { name: 'FlexTest', uid: 999 }
            })
        });

        const result1 = await response1.json();
        const usedDestinationTool1 = result1.lastAgent.includes('Destination');
        const questions1 = result1.context.summary.suggestedQuestions || [];

        console.log(`Agent Used: ${result1.lastAgent}`);
        console.log(`Used Destination Tool: ${usedDestinationTool1 ? 'YES ✅' : 'NO ❌'}`);
        console.log(`Questions Generated: ${questions1.length}`);
        console.log(`Sample Question: "${questions1[0] || 'None'}"`);

        // Test 2: Partial info request
        console.log('\n--- TEST 2: Partial Info Request ---');
        console.log('Message: "Romantic destinations under $3000"');

        const response2 = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: SESSION_ID + '_2',
                message: "Romantic destinations under $3000",
                userInfo: { name: 'FlexTest', uid: 999 }
            })
        });

        const result2 = await response2.json();
        const usedDestinationTool2 = result2.lastAgent.includes('Destination');
        const questions2 = result2.context.summary.suggestedQuestions || [];

        console.log(`Agent Used: ${result2.lastAgent}`);
        console.log(`Used Destination Tool: ${usedDestinationTool2 ? 'YES ✅' : 'NO ❌'}`);
        console.log(`Questions Generated: ${questions2.length}`);
        console.log(`Sample Question: "${questions2[0] || 'None'}"`);

        console.log(`\n🎯 RESULTS:`);
        console.log(`  Minimal request works: ${usedDestinationTool1 ? 'PASS ✅' : 'FAIL ❌'}`);
        console.log(`  Partial info works: ${usedDestinationTool2 ? 'PASS ✅' : 'FAIL ❌'}`);
        console.log(`  Questions for context: ${(questions1.length > 0 && questions2.length > 0) ? 'PASS ✅' : 'FAIL ❌'}`);

        const allWorking = usedDestinationTool1 && usedDestinationTool2 && questions1.length > 0;
        console.log(`  Flexible Destination Agent: ${allWorking ? 'WORKING! 🎉' : 'NEEDS WORK ⚠️'}`);

    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

await testFlexibleDestination();