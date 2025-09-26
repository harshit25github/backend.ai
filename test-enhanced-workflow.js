import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'test-complex-' + Date.now();

class EnhancedChatTester {
    constructor(baseUrl = BASE_URL) {
        this.baseUrl = baseUrl;
        this.sessionId = SESSION_ID;
    }

    async sendMessage(message, stepName) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`STEP: ${stepName}`);
        console.log(`MESSAGE: "${message}"`);
        console.log(`${'='.repeat(60)}`);

        try {
            const response = await fetch(`${this.baseUrl}/api/enhanced-manager/enhanced-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    message,
                    userInfo: { name: 'TestUser', uid: Date.now() }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            console.log(`\nRESPONSE from ${result.lastAgent}:`);
            console.log(result.message);

            console.log(`\nCONTEXT SUMMARY:`);
            console.log('Origin:', result.context.summary.origin);
            console.log('Destination:', result.context.summary.destination);
            console.log('Dates:', result.context.summary.outbound_date, 'to', result.context.summary.return_date);
            console.log('Passengers:', result.context.summary.passenger_count);
            console.log('Budget:', result.context.summary.budget);
            console.log('Itinerary Days:', result.context.itinerary.days.length);

            return result;
        } catch (error) {
            console.error(`ERROR in ${stepName}:`, error.message);
            throw error;
        }
    }

    async getContext() {
        try {
            const response = await fetch(`${this.baseUrl}/api/enhanced-manager/context/${this.sessionId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('ERROR getting context:', error.message);
            throw error;
        }
    }

    async runComplexTest() {
        console.log('🚀 Starting Enhanced Chat Complex Workflow Test');
        console.log('Session ID:', this.sessionId);

        try {
            // Step 1: Initial greeting/request
            await this.sendMessage(
                "Hi! I'm planning a romantic anniversary trip to Europe. I want somewhere beautiful with great food and culture.",
                "1. Initial Request"
            );

            // Step 2: Provide origin and basic details
            await this.sendMessage(
                "We're from New York. We want to travel in late May, maybe around May 20th to 30th. We're a couple and our budget is around $4000 total.",
                "2. Basic Details"
            );

            // Step 3: Confirm destination choice
            await this.sendMessage(
                "Paris sounds perfect! Yes, let's go with Paris. Can you confirm all our details and help us plan this trip?",
                "3. Destination Confirmation"
            );

            // Step 4: Request detailed itinerary
            await this.sendMessage(
                "Great! Now please create a detailed day-by-day itinerary for our 10-day romantic Paris trip.",
                "4. Itinerary Request"
            );

            // Step 5: Get final context
            console.log('\n' + '='.repeat(60));
            console.log('FINAL CONTEXT CHECK');
            console.log('='.repeat(60));

            const finalContext = await this.getContext();
            console.log('\nFinal Session State:');
            console.log('History Length:', finalContext.historyLength);
            console.log('Summary:', JSON.stringify(finalContext.context.summary, null, 2));
            console.log('Itinerary Days:', finalContext.context.itinerary.days.length);

            if (finalContext.context.itinerary.days.length > 0) {
                console.log('\nItinerary Overview:');
                finalContext.context.itinerary.days.forEach((day, index) => {
                    console.log(`Day ${index + 1}: ${day.title} (${day.date})`);
                });
            }

            console.log('\n✅ Complex workflow test completed successfully!');

        } catch (error) {
            console.error('\n❌ Test failed:', error.message);
            throw error;
        }
    }
}

// Check if server is running first
async function checkServer() {
    try {
        const response = await fetch(`${BASE_URL}/api/enhanced-manager/health`);
        if (response.ok) {
            const health = await response.json();
            console.log('✅ Server is running:', health);
            return true;
        } else {
            console.error('❌ Server health check failed:', response.status);
            return false;
        }
    } catch (error) {
        console.error('❌ Cannot connect to server:', error.message);
        return false;
    }
}

// Main execution
async function main() {
    console.log('🧪 Enhanced Chat Endpoint Complex Test');
    console.log('=====================================\n');

    // Check server availability
    const serverUp = await checkServer();
    if (!serverUp) {
        console.log('\n💡 Please start the server with: npm start');
        process.exit(1);
    }

    // Run the test
    const tester = new EnhancedChatTester();
    try {
        await tester.runComplexTest();
    } catch (error) {
        console.error('\n💥 Test suite failed:', error.message);
        process.exit(1);
    }
}

main().catch(console.error);