import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'improved-manager-' + Date.now();

console.log('🎯 Testing Improved Manager Logic');
console.log('================================');
console.log('Testing different tool requirements:');
console.log('1. Destination suggestions: Origin + Budget');
console.log('2. Itinerary: Destination + Dates + Passengers');
console.log('3. Booking: ALL fields required');
console.log('');

async function testScenario(message, scenarioName, expectTool = false) {
    console.log(`\n--- ${scenarioName} ---`);
    console.log(`Message: "${message}"`);

    const response = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId: SESSION_ID,
            message,
            userInfo: { name: 'ImprovedTest', uid: 456 }
        })
    });

    const result = await response.json();
    const usedTool = result.lastAgent !== 'Enhanced Manager Agent';

    console.log(`Agent: ${result.lastAgent}`);
    console.log(`Used Tool: ${usedTool ? 'YES ✅' : 'NO'}`);
    console.log(`Expected Tool: ${expectTool ? 'YES' : 'NO'}`);
    console.log(`Result: ${usedTool === expectTool ? 'CORRECT ✅' : 'WRONG ❌'}`);

    return usedTool === expectTool;
}

try {
    // Test 1: Partial info for destination suggestions
    const test1 = await testScenario(
        "I'm from Chicago with a $3000 budget, where should I travel?",
        "TEST 1: Destination Request (Has: Origin + Budget)",
        true // Should use destination tool
    );

    // Test 2: Missing info for destination
    const test2 = await testScenario(
        "I want travel suggestions but no budget info",
        "TEST 2: Destination Request (Missing: Budget)",
        false // Should NOT use tool, ask for budget
    );

    // Test 3: Itinerary request with required info
    const test3 = await testScenario(
        "Create itinerary for Barcelona, 2 people, March 10-17",
        "TEST 3: Itinerary Request (Has: Destination + Dates + Passengers)",
        true // Should use itinerary tool
    );

    const passedTests = [test1, test2, test3].filter(Boolean).length;
    console.log(`\n🎯 RESULTS: ${passedTests}/3 tests passed`);
    console.log(`${passedTests === 3 ? '🎉 SUCCESS! Improved logic working!' : '⚠️ Some issues remain'}`);

} catch (error) {
    console.error('Test failed:', error.message);
}