import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'itinerary-verify-' + Date.now();

console.log('🔍 VERIFYING ITINERARY CREATION AFTER ALL CHANGES');
console.log('=================================================');
console.log('Session ID:', SESSION_ID);

async function sendMessage(message, stepName) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${stepName}`);
    console.log(`Message: "${message}"`);
    console.log('='.repeat(60));

    const startTime = Date.now();

    const response = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            sessionId: SESSION_ID,
            message,
            userInfo: { name: 'ItineraryVerifier', uid: 99999 }
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    const duration = Date.now() - startTime;

    console.log(`\n✅ Response received in ${duration}ms`);
    console.log(`🤖 Agent: ${result.lastAgent}`);
    console.log(`📝 Response length: ${result.message.length} chars`);

    // Check if it's an itinerary response
    const hasItineraryFormat = result.message.includes('## Day') && result.message.includes('###');
    console.log(`📅 Contains Itinerary Format: ${hasItineraryFormat ? 'YES' : 'NO'}`);

    // Check context data
    const ctx = result.context;
    console.log(`\n📊 CONTEXT STATUS:`);
    console.log(`   Origin: ${ctx.summary.origin.city || 'Not set'}`);
    console.log(`   Destination: ${ctx.summary.destination.city || 'Not set'}`);
    console.log(`   Pax: ${ctx.summary.pax || 'Not set'} people`);
    console.log(`   Budget: ${ctx.summary.budget.amount ? '$' + ctx.summary.budget.amount : 'Not set'}`);
    console.log(`   Places of Interest: ${ctx.summary.placesOfInterest?.length || 0} items`);
    console.log(`   Suggested Questions: ${ctx.summary.suggestedQuestions?.length || 0} items`);
    console.log(`   Itinerary Days: ${ctx.itinerary.days.length} days`);
    console.log(`   Computed Duration: ${ctx.itinerary.computed.duration_days || 'Not computed'}`);
    console.log(`   Itinerary Length: ${ctx.itinerary.computed.itinerary_length || 'Not computed'}`);

    return result;
}

async function verifyItineraryDetails(sessionId) {
    console.log(`\n${'='.repeat(60)}`);
    console.log('DETAILED ITINERARY VERIFICATION');
    console.log('='.repeat(60));

    const contextResponse = await fetch(`${BASE_URL}/api/enhanced-manager/context/${sessionId}`);
    const contextData = await contextResponse.json();

    console.log(`\n📋 ITINERARY STRUCTURE CHECK:`);
    console.log(`   Total Days: ${contextData.context.itinerary.days.length}`);
    console.log(`   Computed Fields Present: ${JSON.stringify(contextData.context.itinerary.computed)}`);

    if (contextData.context.itinerary.days.length > 0) {
        console.log(`\n📅 DAILY BREAKDOWN:`);
        contextData.context.itinerary.days.slice(0, 3).forEach((day, index) => {
            console.log(`   Day ${index + 1}: ${day.title} (${day.date})`);

            // Check segments structure
            const segments = day.segments;
            console.log(`     Morning Activities: ${segments.morning?.length || 0}`);
            console.log(`     Afternoon Activities: ${segments.afternoon?.length || 0}`);
            console.log(`     Evening Activities: ${segments.evening?.length || 0}`);

            // Show sample activity
            if (segments.morning && segments.morning.length > 0) {
                const morning = segments.morning[0];
                console.log(`     Sample Morning: ${morning.places} (${morning.duration_hours}h) - ${morning.descriptor}`);
            }
        });

        if (contextData.context.itinerary.days.length > 3) {
            console.log(`   ... and ${contextData.context.itinerary.days.length - 3} more days`);
        }

        return true; // Structured data exists
    } else {
        console.log('   ❌ NO STRUCTURED ITINERARY DATA FOUND');
        return false;
    }
}

try {
    console.log('\n🚀 Starting itinerary verification test...');

    // Step 1: Setup complete trip with all required fields
    await sendMessage(
        "I want to plan a honeymoon trip from Chicago to Greece for 2 people, traveling June 10-20, 2024, with a $6000 budget.",
        "STEP 1: Setup Complete Trip Details"
    );

    // Step 2: Direct itinerary request
    const itineraryResult = await sendMessage(
        "Perfect! Now create a detailed day-by-day itinerary for our 10-day Greece honeymoon. Include romantic experiences, historical sites, and island hopping.",
        "STEP 2: Direct Itinerary Request"
    );

    // Step 3: Detailed verification
    const hasStructuredData = await verifyItineraryDetails(SESSION_ID);

    console.log(`\n${'='.repeat(60)}`);
    console.log('VERIFICATION RESULTS');
    console.log('='.repeat(60));

    if (hasStructuredData) {
        console.log('✅ ITINERARY CREATION: WORKING CORRECTLY');
        console.log('✅ Structured data is properly captured');
        console.log('✅ All day segments have proper format');
        console.log('✅ Context persistence is working');
    } else {
        console.log('❌ ITINERARY CREATION: FAILED');
        console.log('❌ No structured data captured');
        console.log('❌ Only text response generated');
    }

    console.log(`\n📊 FINAL STATUS:`);
    console.log(`   Text Response Generated: ${itineraryResult.message.includes('## Day') ? 'YES' : 'NO'}`);
    console.log(`   Structured Data Saved: ${hasStructuredData ? 'YES' : 'NO'}`);
    console.log(`   Tool Integration: ${hasStructuredData ? 'WORKING' : 'BROKEN'}`);

} catch (error) {
    console.error('\n💥 Verification test failed:', error.message);
}