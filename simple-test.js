import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'complex-test-' + Date.now();

console.log('🧪 Testing Enhanced Chat - Step by Step');
console.log('Session ID:', SESSION_ID);

async function testStep(message, stepName) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`${stepName}`);
    console.log(`Message: "${message}"`);
    console.log('='.repeat(50));

    try {
        const response = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sessionId: SESSION_ID,
                message,
                userInfo: { name: 'TestUser', uid: 12345 }
            })
        });

        const result = await response.json();

        console.log(`\nAgent: ${result.lastAgent}`);
        console.log(`Response:\n${result.message}`);

        console.log(`\nContext Update:`);
        const ctx = result.context;
        console.log(`- Origin: ${ctx.summary.origin.city || 'Not set'}`);
        console.log(`- Destination: ${ctx.summary.destination.city || 'Not set'}`);
        console.log(`- Dates: ${ctx.summary.outbound_date || 'Not set'} to ${ctx.summary.return_date || 'Not set'}`);
        console.log(`- Passengers: ${ctx.summary.passenger_count || 'Not set'}`);
        console.log(`- Budget: ${ctx.summary.budget.amount ? '$' + ctx.summary.budget.amount : 'Not set'}`);
        console.log(`- Itinerary Days: ${ctx.itinerary.days.length}`);

        return result;
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

// Manual step-by-step test
console.log('\nStarting manual test...\n');

// Step 1: Greeting and initial request
await testStep(
    "Hi! I want to plan a romantic anniversary trip to Europe for me and my partner.",
    "STEP 1: Initial Request"
);

// Wait for user to continue
console.log('\n✅ Step 1 completed. The agent is asking for more details...');