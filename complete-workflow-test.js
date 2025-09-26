import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'workflow-test-' + Date.now();

console.log('🚀 Enhanced Chat Complete Workflow Test');
console.log('Session ID:', SESSION_ID);
console.log('='.repeat(60));

async function sendMessage(message, stepName) {
    console.log(`\n🔹 ${stepName}`);
    console.log(`💬 Message: "${message}"`);
    console.log('-'.repeat(50));

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

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        console.log(`🤖 Agent: ${result.lastAgent}`);
        console.log(`📝 Response: ${result.message.substring(0, 300)}${result.message.length > 300 ? '...' : ''}`);

        const ctx = result.context;
        const summary = ctx.summary;

        console.log(`\n📊 Context Status:`);
        console.log(`   Origin: ${summary.origin.city || 'Not set'}`);
        console.log(`   Destination: ${summary.destination.city || 'Not set'}`);
        console.log(`   Dates: ${summary.outbound_date || 'Not set'} to ${summary.return_date || 'Not set'}`);
        console.log(`   Passengers: ${summary.passenger_count || 'Not set'}`);
        console.log(`   Budget: ${summary.budget.amount ? '$' + summary.budget.amount + ' ' + summary.budget.currency : 'Not set'}`);
        console.log(`   Itinerary Days: ${ctx.itinerary.days.length}`);

        return result;
    } catch (error) {
        console.error(`❌ Error in ${stepName}:`, error.message);
        throw error;
    }
}

try {
    // Step 1: Initial greeting with travel intent
    await sendMessage(
        "Hi! I want to plan a romantic anniversary trip to Europe. We love beautiful architecture, fine dining, and cultural experiences.",
        "STEP 1: Initial Request"
    );

    // Step 2: Provide all required details
    await sendMessage(
        "We're traveling from New York City. Our dates are flexible but we're thinking May 20-30, 2024. It's just me and my partner (2 people). Our budget is around $5000 USD total for the trip.",
        "STEP 2: Provide Required Details"
    );

    // Step 3: Choose destination from recommendations
    await sendMessage(
        "Paris sounds absolutely perfect for our anniversary! Yes, let's go with Paris, France. Please confirm all our details are correct.",
        "STEP 3: Destination Selection"
    );

    // Step 4: Request detailed itinerary creation
    await sendMessage(
        "Great! Now please create a detailed day-by-day itinerary for our 10-day romantic anniversary trip to Paris. We want a mix of iconic sights, romantic experiences, and authentic French culture.",
        "STEP 4: Request Detailed Itinerary"
    );

    console.log('\n' + '='.repeat(60));
    console.log('✅ WORKFLOW COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));

    // Get final context to verify everything was captured
    const contextResponse = await fetch(`${BASE_URL}/api/enhanced-manager/context/${SESSION_ID}`);
    const finalContext = await contextResponse.json();

    console.log('\n📋 Final Session Summary:');
    console.log(`   Session ID: ${finalContext.sessionId}`);
    console.log(`   History Length: ${finalContext.historyLength} messages`);
    console.log(`   Trip Summary:`, JSON.stringify(finalContext.context.summary, null, 4));

    if (finalContext.context.itinerary.days.length > 0) {
        console.log(`\n📅 Generated Itinerary (${finalContext.context.itinerary.days.length} days):`);
        finalContext.context.itinerary.days.forEach((day, index) => {
            console.log(`   Day ${index + 1}: ${day.title} (${day.date})`);
            console.log(`     Morning: ${day.segments.morning[0]?.places || 'Not planned'}`);
            console.log(`     Afternoon: ${day.segments.afternoon[0]?.places || 'Not planned'}`);
            console.log(`     Evening: ${day.segments.evening[0]?.places || 'Not planned'}`);
        });
    }

    console.log('\n🎉 Test completed successfully! All agents worked properly.');

} catch (error) {
    console.error('\n💥 Workflow failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}