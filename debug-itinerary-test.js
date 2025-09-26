import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'debug-' + Date.now();

console.log('🔍 Debug Test: Itinerary Creation Issue');
console.log('Session ID:', SESSION_ID);

async function sendMessage(message, stepName) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${stepName}`);
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
            userInfo: { name: 'DebugUser', uid: 999 }
        })
    });

    const result = await response.json();

    console.log(`\n🤖 Agent: ${result.lastAgent}`);
    console.log(`📝 Response Length: ${result.message.length} chars`);
    console.log(`📝 Response Preview: ${result.message.substring(0, 200)}...`);

    // Check if response contains itinerary structure
    const hasItineraryFormat = result.message.includes('## Day') && result.message.includes('###');
    console.log(`📅 Contains Itinerary Format: ${hasItineraryFormat ? 'YES' : 'NO'}`);

    // Check context
    console.log(`\n📊 Context After Response:`);
    console.log(`   Origin: ${result.context.summary.origin.city || 'Not set'}`);
    console.log(`   Destination: ${result.context.summary.destination.city || 'Not set'}`);
    console.log(`   Itinerary Days: ${result.context.itinerary.days.length}`);
    console.log(`   Structured Data Present: ${result.context.itinerary.days.length > 0 ? 'YES' : 'NO'}`);

    return result;
}

try {
    // Pre-populate the session with all required data first
    console.log('\n🔧 STEP 1: Pre-populate session with complete trip data');
    await sendMessage(
        "I'm from New York, traveling to Paris from May 20-30, 2024. We are 2 people with a $5000 budget. This is confirmed.",
        "PRE-POPULATE SESSION"
    );

    console.log('\n🔧 STEP 2: Direct itinerary request (should trigger Itinerary Builder Agent)');
    const itineraryResult = await sendMessage(
        "Perfect! Now create a detailed day-by-day itinerary for our 10-day Paris trip. Include morning, afternoon, and evening activities for each day.",
        "DIRECT ITINERARY REQUEST"
    );

    // Wait a moment and check final context
    console.log('\n🔧 STEP 3: Verify final context state');
    const contextResponse = await fetch(`${BASE_URL}/api/enhanced-manager/context/${SESSION_ID}`);
    const finalContext = await contextResponse.json();

    console.log(`\n📋 Final Context Analysis:`);
    console.log(`   Session ID: ${finalContext.sessionId}`);
    console.log(`   History Length: ${finalContext.historyLength}`);
    console.log(`   Itinerary Days Count: ${finalContext.context.itinerary.days.length}`);
    console.log(`   Computed Duration: ${finalContext.context.itinerary.computed.duration_days}`);
    console.log(`   Itinerary Length: ${finalContext.context.itinerary.computed.itinerary_length}`);

    if (finalContext.context.itinerary.days.length === 0) {
        console.log('\n❌ ISSUE CONFIRMED: Itinerary was not stored as structured data');
        console.log('   The agent generated markdown text but did not call update_itinerary tool');
    } else {
        console.log('\n✅ SUCCESS: Itinerary was properly stored');
        finalContext.context.itinerary.days.forEach((day, i) => {
            console.log(`   Day ${i+1}: ${day.title}`);
        });
    }

} catch (error) {
    console.error('\n💥 Debug test failed:', error.message);
}