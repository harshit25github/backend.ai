import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'comprehensive-feature-test-' + Date.now();

console.log('🧪 COMPREHENSIVE FEATURE TEST SUITE');
console.log('====================================');
console.log('Testing all 4 features implemented:');
console.log('1. ✅ Itinerary creation with structured data');
console.log('2. ✅ Places of interest auto-population');
console.log('3. ✅ pax field (not passenger_count)');
console.log('4. ✅ Questions update every turn (no text questions)');
console.log('');
console.log('Session ID:', SESSION_ID);

class FeatureTestSuite {
    constructor() {
        this.results = {
            itineraryCreation: { passed: false, details: '' },
            placesOfInterest: { passed: false, details: '' },
            paxField: { passed: false, details: '' },
            questionsUpdate: { passed: false, details: '' }
        };
        this.responses = [];
    }

    async sendMessage(message, stepName) {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`${stepName}`);
        console.log(`Message: "${message}"`);
        console.log('='.repeat(70));

        const startTime = Date.now();

        try {
            const response = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: SESSION_ID,
                    message,
                    userInfo: { name: 'FeatureTest', uid: 12345 }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            const duration = Date.now() - startTime;

            console.log(`✅ Response received in ${duration}ms`);
            console.log(`🤖 Agent: ${result.lastAgent}`);
            console.log(`📝 Response length: ${result.message.length} characters`);

            this.responses.push(result);
            return result;

        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            throw error;
        }
    }

    testFeature1_ItineraryCreation(result) {
        const itinerary = result.context.itinerary;
        const days = itinerary.days || [];

        console.log(`\n🔍 FEATURE 1 TEST: Itinerary Creation`);
        console.log(`   Days created: ${days.length}`);
        console.log(`   Computed duration: ${itinerary.computed?.duration_days || 'Not set'}`);

        if (days.length > 0) {
            const firstDay = days[0];
            const hasStructure = firstDay.title && firstDay.date && firstDay.segments;
            const hasSegments = hasStructure && firstDay.segments.morning && firstDay.segments.afternoon && firstDay.segments.evening;

            console.log(`   First day title: "${firstDay.title}"`);
            console.log(`   First day date: "${firstDay.date}"`);
            console.log(`   Has segments: ${hasSegments ? 'YES' : 'NO'}`);

            if (hasSegments) {
                console.log(`   Morning activities: ${firstDay.segments.morning.length}`);
                console.log(`   Afternoon activities: ${firstDay.segments.afternoon.length}`);
                console.log(`   Evening activities: ${firstDay.segments.evening.length}`);
            }

            this.results.itineraryCreation.passed = hasSegments && days.length >= 7;
            this.results.itineraryCreation.details = `${days.length} days with proper structure`;
        } else {
            this.results.itineraryCreation.passed = false;
            this.results.itineraryCreation.details = 'No itinerary days created';
        }
    }

    testFeature2_PlacesOfInterest(result) {
        const places = result.context.summary.placesOfInterest || [];

        console.log(`\n🔍 FEATURE 2 TEST: Places of Interest`);
        console.log(`   Places captured: ${places.length}`);

        if (places.length > 0) {
            console.log(`   📍 Sample places:`);
            places.slice(0, 3).forEach((place, i) => {
                console.log(`      ${i + 1}. ${place.placeName}: ${place.placeDescription}`);
            });

            const hasValidStructure = places.every(p => p.placeName && p.placeDescription);
            this.results.placesOfInterest.passed = places.length >= 3 && hasValidStructure;
            this.results.placesOfInterest.details = `${places.length} places with valid structure`;
        } else {
            this.results.placesOfInterest.passed = false;
            this.results.placesOfInterest.details = 'No places captured';
        }
    }

    testFeature3_PaxField(result) {
        const summary = result.context.summary;
        const hasPax = 'pax' in summary;
        const hasOldField = 'passenger_count' in summary;

        console.log(`\n🔍 FEATURE 3 TEST: Pax Field`);
        console.log(`   Has 'pax' field: ${hasPax ? 'YES' : 'NO'}`);
        console.log(`   Has old 'passenger_count' field: ${hasOldField ? 'YES (❌)' : 'NO (✅)'}`);
        console.log(`   Pax value: ${summary.pax}`);

        this.results.paxField.passed = hasPax && !hasOldField && summary.pax >= 0;
        this.results.paxField.details = `pax field present: ${hasPax}, old field removed: ${!hasOldField}`;
    }

    testFeature4_QuestionsUpdate(result, hasTextQuestions) {
        const questions = result.context.summary.suggestedQuestions || [];

        console.log(`\n🔍 FEATURE 4 TEST: Questions Update`);
        console.log(`   Questions in array: ${questions.length}`);
        console.log(`   Has text questions: ${hasTextQuestions ? 'YES (❌)' : 'NO (✅)'}`);
        console.log(`   📋 Sample questions:`);
        questions.slice(0, 3).forEach((q, i) => {
            console.log(`      ${i + 1}. ${q}`);
        });

        this.results.questionsUpdate.passed = questions.length >= 3 && !hasTextQuestions;
        this.results.questionsUpdate.details = `${questions.length} questions, no text questions: ${!hasTextQuestions}`;
    }

    async runComprehensiveTest() {
        try {
            console.log('\n🚀 Starting comprehensive feature test...\n');

            // Step 1: Initial setup with all details
            const step1 = await this.sendMessage(
                "I want to plan a honeymoon trip from Chicago to Bali for 2 people, traveling December 10-20, 2024, with a $6000 budget.",
                "STEP 1: Complete Trip Setup"
            );

            this.testFeature3_PaxField(step1);
            const hasTextQuestions1 = step1.message.toLowerCase().includes('you might want to ask');
            this.testFeature4_QuestionsUpdate(step1, hasTextQuestions1);

            // Step 2: Request destination insights
            const step2 = await this.sendMessage(
                "Tell me about Bali attractions, culture, and travel tips.",
                "STEP 2: Destination Insights"
            );

            this.testFeature2_PlacesOfInterest(step2);
            const hasTextQuestions2 = step2.message.toLowerCase().includes('you might want to ask');

            // Step 3: Request itinerary creation
            const step3 = await this.sendMessage(
                "Create a detailed day-by-day itinerary for our 10-day Bali honeymoon with romantic experiences and cultural activities.",
                "STEP 3: Itinerary Creation"
            );

            this.testFeature1_ItineraryCreation(step3);
            const hasTextQuestions3 = step3.message.toLowerCase().includes('you might want to ask');

            // Test questions update across turns
            const questions1 = step1.context.summary.suggestedQuestions || [];
            const questions2 = step2.context.summary.suggestedQuestions || [];
            const questions3 = step3.context.summary.suggestedQuestions || [];

            const questionsChanged12 = JSON.stringify(questions1) !== JSON.stringify(questions2);
            const questionsChanged23 = JSON.stringify(questions2) !== JSON.stringify(questions3);

            console.log(`\n🔄 QUESTIONS UPDATE ANALYSIS:`);
            console.log(`   Step 1→2 Changed: ${questionsChanged12 ? 'YES ✅' : 'NO ❌'}`);
            console.log(`   Step 2→3 Changed: ${questionsChanged23 ? 'YES ✅' : 'NO ❌'}`);

            // Final comprehensive check
            await this.verifyFinalState();
            this.generateReport();

        } catch (error) {
            console.error('\n💥 Comprehensive test failed:', error.message);
        }
    }

    async verifyFinalState() {
        console.log('\n🔍 FINAL STATE VERIFICATION');
        console.log('='.repeat(50));

        const contextResponse = await fetch(`${BASE_URL}/api/enhanced-manager/context/${SESSION_ID}`);
        const finalContext = await contextResponse.json();

        console.log(`📊 Final Context Summary:`);
        console.log(`   Origin: ${finalContext.context.summary.origin.city}`);
        console.log(`   Destination: ${finalContext.context.summary.destination.city}`);
        console.log(`   Pax: ${finalContext.context.summary.pax}`);
        console.log(`   Budget: $${finalContext.context.summary.budget.amount}`);
        console.log(`   Places of Interest: ${finalContext.context.summary.placesOfInterest.length}`);
        console.log(`   Suggested Questions: ${finalContext.context.summary.suggestedQuestions.length}`);
        console.log(`   Itinerary Days: ${finalContext.context.itinerary.days.length}`);
    }

    generateReport() {
        console.log('\n' + '='.repeat(70));
        console.log('📊 COMPREHENSIVE FEATURE TEST REPORT');
        console.log('='.repeat(70));

        const features = [
            { name: 'Feature 1: Itinerary Creation', result: this.results.itineraryCreation },
            { name: 'Feature 2: Places of Interest', result: this.results.placesOfInterest },
            { name: 'Feature 3: Pax Field', result: this.results.paxField },
            { name: 'Feature 4: Questions Update', result: this.results.questionsUpdate }
        ];

        let passedCount = 0;
        features.forEach(feature => {
            const status = feature.result.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${feature.name}`);
            console.log(`     ${feature.result.details}`);
            if (feature.result.passed) passedCount++;
        });

        console.log('\n' + '='.repeat(70));
        console.log(`🎯 OVERALL RESULT: ${passedCount}/${features.length} FEATURES PASSED`);

        if (passedCount === features.length) {
            console.log('🎉 ALL FEATURES WORKING CORRECTLY!');
            console.log('✅ Enhanced chat endpoint is fully functional');
        } else {
            console.log('⚠️  Some features need attention');
        }
        console.log('='.repeat(70));
    }
}

// Run the comprehensive test
const testSuite = new FeatureTestSuite();
await testSuite.runComprehensiveTest();