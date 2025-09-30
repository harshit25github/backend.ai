import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'final-verification-' + Date.now();

console.log('🎉 FINAL VERIFICATION: All 4 Features');
console.log('=====================================');

async function verifyAllFeatures() {
    try {
        // Step 1: Setup with all details
        console.log('\n1️⃣ Setting up trip...');
        const step1 = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: SESSION_ID,
                message: "Plan a trip from NYC to Barcelona for 2 people, $3000 budget, 7 days",
                userInfo: { name: 'Verification', uid: 999 }
            })
        });
        const result1 = await step1.json();

        // Step 2: Get destination info (should populate places)
        console.log('2️⃣ Getting destination insights...');
        const step2 = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: SESSION_ID,
                message: "Tell me about Barcelona attractions and culture",
                userInfo: { name: 'Verification', uid: 999 }
            })
        });
        const result2 = await step2.json();

        // Step 3: Create itinerary
        console.log('3️⃣ Creating itinerary...');
        const step3 = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: SESSION_ID,
                message: "Create a 7-day Barcelona itinerary",
                userInfo: { name: 'Verification', uid: 999 }
            })
        });
        const result3 = await step3.json();

        // Verify all features
        console.log('\n🔍 FEATURE VERIFICATION:');

        // Feature 3: Pax field
        const hasPax = 'pax' in result3.context.summary;
        const hasOldField = 'passenger_count' in result3.context.summary;
        const paxValue = result3.context.summary.pax;
        console.log(`✅ Feature 3 - Pax Field: ${hasPax && !hasOldField ? 'PASS' : 'FAIL'} (pax=${paxValue})`);

        // Feature 4: Questions update
        const q1 = result1.context.summary.suggestedQuestions || [];
        const q2 = result2.context.summary.suggestedQuestions || [];
        const q3 = result3.context.summary.suggestedQuestions || [];
        const questionsChange12 = JSON.stringify(q1) !== JSON.stringify(q2);
        const questionsChange23 = JSON.stringify(q2) !== JSON.stringify(q3);
        console.log(`✅ Feature 4 - Questions Update: ${questionsChange12 && questionsChange23 ? 'PASS' : 'FAIL'} (changes: ${questionsChange12}/${questionsChange23})`);

        // Feature 2: Places of Interest
        const places = result2.context.summary.placesOfInterest || [];
        const hasValidPlaces = places.length > 0 && places.every(p => p.placeName && p.placeDescription);
        console.log(`✅ Feature 2 - Places of Interest: ${hasValidPlaces ? 'PASS' : 'FAIL'} (${places.length} places)`);

        // Feature 1: Itinerary Creation
        const days = result3.context.itinerary.days || [];
        const hasStructuredItinerary = days.length > 0 && days[0]?.segments?.morning;
        console.log(`✅ Feature 1 - Itinerary Creation: ${hasStructuredItinerary ? 'PASS' : 'FAIL'} (${days.length} days)`);

        const passCount = [
            hasPax && !hasOldField,
            questionsChange12 && questionsChange23,
            hasValidPlaces,
            hasStructuredItinerary
        ].filter(Boolean).length;

        console.log(`\n🎯 FINAL RESULT: ${passCount}/4 FEATURES WORKING`);
        return passCount === 4;

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        return false;
    }
}

const success = await verifyAllFeatures();
console.log(`\n${success ? '🎉 ALL FEATURES WORKING! Agent-driven updates successful!' : '⚠️ Some features need attention'}`);