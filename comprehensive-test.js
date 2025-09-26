import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'comprehensive-test-' + Date.now();

console.log('🧪 COMPREHENSIVE ENHANCED CHAT TEST');
console.log('====================================');
console.log('Session ID:', SESSION_ID);
console.log('Test Started:', new Date().toISOString());

class ComprehensiveTestSuite {
    constructor() {
        this.sessionId = SESSION_ID;
        this.stepNumber = 0;
        this.testResults = {
            passed: 0,
            failed: 0,
            steps: []
        };
    }

    async sendMessage(message, expectedAgent, testDescription) {
        this.stepNumber++;
        const stepId = `STEP ${this.stepNumber}`;

        console.log(`\n${'='.repeat(70)}`);
        console.log(`${stepId}: ${testDescription}`);
        console.log(`Expected Agent: ${expectedAgent}`);
        console.log(`Message: "${message}"`);
        console.log('='.repeat(70));

        try {
            const startTime = Date.now();

            const response = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    message,
                    userInfo: { name: 'ComprehensiveTestUser', uid: 999999 }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            const duration = Date.now() - startTime;

            // Verify expected agent
            const agentMatch = result.lastAgent === expectedAgent;
            console.log(`\n✅ Response received in ${duration}ms`);
            console.log(`🤖 Actual Agent: ${result.lastAgent} ${agentMatch ? '✅' : '❌'}`);
            console.log(`📝 Response Length: ${result.message.length} characters`);

            // Show response preview
            const preview = result.message.substring(0, 200);
            console.log(`📝 Response Preview: ${preview}${result.message.length > 200 ? '...' : ''}`);

            // Analyze context changes
            const ctx = result.context;
            console.log(`\n📊 CONTEXT STATUS:`);
            console.log(`   Origin: ${ctx.summary.origin.city || 'Not set'}`);
            console.log(`   Destination: ${ctx.summary.destination.city || 'Not set'}`);
            console.log(`   Outbound Date: ${ctx.summary.outbound_date || 'Not set'}`);
            console.log(`   Return Date: ${ctx.summary.return_date || 'Not set'}`);
            console.log(`   Duration: ${ctx.summary.duration_days || 'Not set'} days`);
            console.log(`   Passengers: ${ctx.summary.passenger_count || 'Not set'}`);
            console.log(`   Budget: ${ctx.summary.budget.amount ? '$' + ctx.summary.budget.amount + ' ' + ctx.summary.budget.currency : 'Not set'}`);
            console.log(`   Trip Type: ${ctx.summary.tripType?.join(', ') || 'Not set'}`);
            console.log(`   Places of Interest: ${ctx.summary.placesOfInterest?.length || 0} items`);
            console.log(`   Itinerary Days: ${ctx.itinerary.days.length}`);
            console.log(`   Computed Duration: ${ctx.itinerary.computed.duration_days || 'Not computed'}`);
            console.log(`   Itinerary Length: ${ctx.itinerary.computed.itinerary_length || 'Not computed'}`);

            // Record test results
            const stepResult = {
                step: stepId,
                description: testDescription,
                expectedAgent,
                actualAgent: result.lastAgent,
                agentMatch,
                duration,
                contextValid: this.validateContext(ctx),
                responseLength: result.message.length,
                success: agentMatch
            };

            this.testResults.steps.push(stepResult);
            if (stepResult.success) {
                this.testResults.passed++;
                console.log(`🎉 ${stepId} PASSED`);
            } else {
                this.testResults.failed++;
                console.log(`❌ ${stepId} FAILED - Expected ${expectedAgent}, got ${result.lastAgent}`);
            }

            return result;

        } catch (error) {
            console.error(`\n💥 ERROR in ${stepId}:`, error.message);

            const stepResult = {
                step: stepId,
                description: testDescription,
                expectedAgent,
                actualAgent: 'ERROR',
                agentMatch: false,
                error: error.message,
                success: false
            };

            this.testResults.steps.push(stepResult);
            this.testResults.failed++;
            throw error;
        }
    }

    validateContext(ctx) {
        // Basic context validation
        return {
            hasSummary: !!ctx.summary,
            hasItinerary: !!ctx.itinerary,
            hasUserInfo: !!ctx.userInfo,
            summaryFieldsCount: Object.keys(ctx.summary).length,
            itineraryDaysCount: ctx.itinerary.days.length
        };
    }

    async verifyPersistence() {
        console.log('\n' + '='.repeat(70));
        console.log('🔍 PERSISTENCE VERIFICATION');
        console.log('='.repeat(70));

        try {
            const response = await fetch(`${BASE_URL}/api/enhanced-manager/context/${this.sessionId}`);
            const contextData = await response.json();

            console.log(`\n📋 RETRIEVED CONTEXT:`);
            console.log(`   Session ID: ${contextData.sessionId}`);
            console.log(`   History Length: ${contextData.historyLength} messages`);
            console.log(`   Context Summary Fields: ${Object.keys(contextData.context.summary).length}`);
            console.log(`   Itinerary Days: ${contextData.context.itinerary.days.length}`);

            if (contextData.context.itinerary.days.length > 0) {
                console.log(`\n📅 DETAILED ITINERARY VERIFICATION:`);
                contextData.context.itinerary.days.forEach((day, index) => {
                    console.log(`   Day ${index + 1}: ${day.title} (${day.date})`);
                    console.log(`     Morning: ${day.segments.morning.length} activities`);
                    console.log(`     Afternoon: ${day.segments.afternoon.length} activities`);
                    console.log(`     Evening: ${day.segments.evening.length} activities`);
                });
            }

            return contextData;
        } catch (error) {
            console.error('❌ Persistence verification failed:', error.message);
            throw error;
        }
    }

    async runFullTest() {
        try {
            console.log('\n🚀 Starting comprehensive test sequence...\n');

            // Step 1: Initial greeting - should use Manager Agent
            await this.sendMessage(
                "Hi there! I'm planning a special trip and need your help.",
                "Enhanced Manager Agent",
                "Initial greeting and conversation starter"
            );

            // Step 2: Provide basic trip info - should stay with Manager Agent for gathering
            await this.sendMessage(
                "I want to plan a romantic honeymoon trip to Europe. We're from Los Angeles, have a budget of around $6000, and want to travel for about 2 weeks in September.",
                "Enhanced Manager Agent",
                "Provide basic trip information"
            );

            // Step 3: Add more specific details - should trigger destination planning
            await this.sendMessage(
                "We're thinking September 10-24, 2024. It's just me and my fiancé (2 people). We love history, great food, beautiful architecture, and romantic experiences. Maybe Italy or France?",
                "Enhanced Manager Agent",
                "Provide complete trip details with destination hints"
            );

            // Step 4: Make destination choice - should get destination insights
            await this.sendMessage(
                "Italy sounds absolutely perfect! Let's go with Italy - maybe Rome and Florence? Please tell me more about traveling there and confirm our trip details.",
                "Enhanced Manager Agent",
                "Confirm destination choice and request insights"
            );

            // Step 5: Request detailed itinerary - should trigger Itinerary Builder
            await this.sendMessage(
                "Wonderful! Now please create a detailed day-by-day itinerary for our 14-day honeymoon in Italy. We want to spend time in both Rome and Florence with romantic experiences, historical sites, and amazing food.",
                "Enhanced Manager Agent",
                "Request comprehensive itinerary creation"
            );

            // Step 6: Verify persistence and final state
            const finalContext = await this.verifyPersistence();

            // Generate test report
            this.generateTestReport(finalContext);

        } catch (error) {
            console.error('\n💥 Comprehensive test failed:', error.message);
            this.generateTestReport();
        }
    }

    generateTestReport(finalContext = null) {
        console.log('\n' + '='.repeat(70));
        console.log('📊 COMPREHENSIVE TEST REPORT');
        console.log('='.repeat(70));

        console.log(`\n📈 OVERALL RESULTS:`);
        console.log(`   Total Steps: ${this.testResults.steps.length}`);
        console.log(`   Passed: ${this.testResults.passed} ✅`);
        console.log(`   Failed: ${this.testResults.failed} ❌`);
        console.log(`   Success Rate: ${Math.round((this.testResults.passed / this.testResults.steps.length) * 100)}%`);

        console.log(`\n📋 STEP-BY-STEP RESULTS:`);
        this.testResults.steps.forEach(step => {
            const status = step.success ? '✅ PASS' : '❌ FAIL';
            const duration = step.duration ? `${step.duration}ms` : 'N/A';
            console.log(`   ${step.step}: ${status} (${duration}) - ${step.description}`);
            if (step.error) {
                console.log(`      Error: ${step.error}`);
            }
        });

        if (finalContext) {
            console.log(`\n🎯 FINAL DATA VALIDATION:`);
            const summary = finalContext.context.summary;
            const itinerary = finalContext.context.itinerary;

            console.log(`   ✅ Origin Set: ${summary.origin.city || 'Missing'}`);
            console.log(`   ✅ Destination Set: ${summary.destination.city || 'Missing'}`);
            console.log(`   ✅ Dates Set: ${summary.outbound_date && summary.return_date ? 'Yes' : 'Missing'}`);
            console.log(`   ✅ Budget Set: ${summary.budget.amount ? '$' + summary.budget.amount : 'Missing'}`);
            console.log(`   ✅ Itinerary Created: ${itinerary.days.length} days`);
            console.log(`   ✅ Structured Data: ${itinerary.days.length > 0 ? 'Yes' : 'No'}`);

            const dataComplete = summary.origin.city && summary.destination.city &&
                               summary.outbound_date && summary.return_date &&
                               summary.budget.amount && itinerary.days.length > 0;

            console.log(`   🎯 Complete Workflow: ${dataComplete ? '✅ SUCCESS' : '❌ INCOMPLETE'}`);
        }

        console.log(`\n⏱️  Test Completed: ${new Date().toISOString()}`);
        console.log(`🎉 Enhanced Chat Endpoint ${this.testResults.failed === 0 ? 'FULLY FUNCTIONAL' : 'HAS ISSUES'}`);
    }
}

// Run the comprehensive test
const testSuite = new ComprehensiveTestSuite();
await testSuite.runFullTest();