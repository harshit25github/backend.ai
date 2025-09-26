import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'enhancement-test-' + Date.now();

console.log('🧪 TESTING ENHANCEMENTS: Places of Interest & Suggested Questions');
console.log('================================================================');
console.log('Session ID:', SESSION_ID);

async function sendMessage(message, stepDescription) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${stepDescription}`);
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
            userInfo: { name: 'EnhancementTester', uid: 12345 }
        })
    });

    const result = await response.json();

    console.log(`\n🤖 Agent: ${result.lastAgent}`);
    console.log(`📝 Response Preview: ${result.message.substring(0, 200)}...`);

    // Check enhancements
    const ctx = result.context;
    console.log(`\n✨ ENHANCEMENT CHECK:`);
    console.log(`   Places of Interest: ${ctx.summary.placesOfInterest?.length || 0} items`);
    if (ctx.summary.placesOfInterest && ctx.summary.placesOfInterest.length > 0) {
        console.log(`   📍 Places found:`);
        ctx.summary.placesOfInterest.slice(0, 3).forEach(place => {
            console.log(`      • ${place.placeName}: ${place.placeDescription}`);
        });
        if (ctx.summary.placesOfInterest.length > 3) {
            console.log(`      ... and ${ctx.summary.placesOfInterest.length - 3} more`);
        }
    }

    console.log(`   Suggested Questions: ${ctx.summary.suggestedQuestions?.length || 0} items`);
    if (ctx.summary.suggestedQuestions && ctx.summary.suggestedQuestions.length > 0) {
        console.log(`   ❓ Questions found:`);
        ctx.summary.suggestedQuestions.forEach(question => {
            console.log(`      • ${question}`);
        });
    }

    return result;
}

try {
    console.log('\n🚀 Starting enhancement tests...\n');

    // Step 1: Set up basic trip details
    await sendMessage(
        "I want to plan a trip from Mumbai to Paris for 2 people with a budget of $4000. We're traveling September 15-25, 2024.",
        "STEP 1: Setup basic trip details"
    );

    // Step 2: Request destination insights (should trigger place suggestions)
    await sendMessage(
        "Great! Tell me more about traveling to Paris. What are the must-see attractions and any travel insights?",
        "STEP 2: Request destination insights (should populate places of interest)"
    );

    // Step 3: Get final context to verify data persistence
    console.log('\n' + '='.repeat(60));
    console.log('FINAL CONTEXT VERIFICATION');
    console.log('='.repeat(60));

    const contextResponse = await fetch(`${BASE_URL}/api/enhanced-manager/context/${SESSION_ID}`);
    const finalContext = await contextResponse.json();

    console.log(`\n📊 FINAL ENHANCEMENT STATUS:`);
    console.log(`   Session ID: ${finalContext.sessionId}`);
    console.log(`   Places of Interest: ${finalContext.context.summary.placesOfInterest?.length || 0} total`);
    console.log(`   Suggested Questions: ${finalContext.context.summary.suggestedQuestions?.length || 0} total`);

    if (finalContext.context.summary.placesOfInterest && finalContext.context.summary.placesOfInterest.length > 0) {
        console.log(`\n📍 COMPLETE PLACES OF INTEREST LIST:`);
        finalContext.context.summary.placesOfInterest.forEach((place, index) => {
            console.log(`   ${index + 1}. ${place.placeName}`);
            console.log(`      ${place.placeDescription}`);
        });
    }

    if (finalContext.context.summary.suggestedQuestions && finalContext.context.summary.suggestedQuestions.length > 0) {
        console.log(`\n❓ COMPLETE SUGGESTED QUESTIONS LIST:`);
        finalContext.context.summary.suggestedQuestions.forEach((question, index) => {
            console.log(`   ${index + 1}. ${question}`);
        });
    }

    // Test if questions reset on next turn
    console.log('\n' + '='.repeat(60));
    console.log('TESTING QUESTION RESET ON NEW TURN');
    console.log('='.repeat(60));

    await sendMessage(
        "Now create a detailed itinerary for our Paris trip.",
        "STEP 3: Request itinerary (should reset questions)"
    );

    console.log('\n✅ Enhancement tests completed!');
    console.log('\n🎯 EXPECTED BEHAVIOR:');
    console.log('   ✅ Places of Interest: Should be populated when agent mentions specific places');
    console.log('   ✅ Suggested Questions: Should reset every turn with fresh questions');
    console.log('   ✅ Data Persistence: Should be saved and retrievable via context API');

} catch (error) {
    console.error('\n💥 Enhancement test failed:', error.message);
}