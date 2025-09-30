import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'smart-slot-test-' + Date.now();

console.log('🎯 Testing Smart Slot Filling for Destination Discovery');
console.log('====================================================');

async function testSmartSlotFilling() {
    try {
        // Test 1: Basic destination request - should ask for origin + budget
        console.log('\n--- TEST 1: Basic Destination Request ---');
        console.log('Message: "Where should I travel?"');

        const response1 = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: SESSION_ID,
                message: "Where should I travel?",
                userInfo: { name: 'SlotTest', uid: 789 }
            })
        });

        const result1 = await response1.json();
        const usedTool1 = result1.lastAgent !== 'Enhanced Manager Agent';

        console.log(`Agent: ${result1.lastAgent}`);
        console.log(`Used Tool: ${usedTool1 ? 'YES' : 'NO'}`);
        console.log(`Response Preview: "${result1.message.substring(0, 100)}..."`);

        // Should NOT use tool yet - should ask for origin/budget
        const expectedBehavior1 = !usedTool1 && (
            result1.message.toLowerCase().includes('origin') ||
            result1.message.toLowerCase().includes('where') ||
            result1.message.toLowerCase().includes('budget')
        );

        console.log(`Expected: Ask for missing info (origin/budget)`);
        console.log(`Result: ${expectedBehavior1 ? 'CORRECT ✅' : 'WRONG ❌'}`);

        // Test 2: Provide origin + budget - should use destination tool
        console.log('\n--- TEST 2: Complete Info Provided ---');
        console.log('Message: "From Chicago, $2500 budget, where should I go?"');

        const response2 = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: SESSION_ID,
                message: "From Chicago, $2500 budget, where should I go?",
                userInfo: { name: 'SlotTest', uid: 789 }
            })
        });

        const result2 = await response2.json();
        const usedTool2 = result2.lastAgent !== 'Enhanced Manager Agent';

        console.log(`Agent: ${result2.lastAgent}`);
        console.log(`Used Tool: ${usedTool2 ? 'YES' : 'NO'}`);
        console.log(`Questions Generated: ${result2.context.summary.suggestedQuestions.length}`);

        // Should use destination tool now
        console.log(`Expected: Use destination tool`);
        console.log(`Result: ${usedTool2 ? 'CORRECT ✅' : 'WRONG ❌'}`);

        console.log(`\n🎯 SUMMARY:`);
        console.log(`  Test 1 (Ask for info): ${expectedBehavior1 ? 'PASS' : 'FAIL'}`);
        console.log(`  Test 2 (Use tool): ${usedTool2 ? 'PASS' : 'FAIL'}`);
        console.log(`  Smart Slot Filling: ${(expectedBehavior1 && usedTool2) ? 'WORKING ✅' : 'NEEDS WORK ❌'}`);

    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

await testSmartSlotFilling();