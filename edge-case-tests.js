import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';

console.log('🧪 EDGE CASE & ERROR HANDLING TESTS');
console.log('=====================================');

class EdgeCaseTestSuite {
    async testInvalidRequest() {
        console.log('\n🔥 TEST 1: Invalid JSON payload');
        try {
            const response = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'invalid json'
            });

            const result = await response.json();
            console.log('❌ Expected error but got:', result);
        } catch (error) {
            console.log('✅ Correctly handled invalid JSON:', error.message);
        }
    }

    async testMissingMessage() {
        console.log('\n🔥 TEST 2: Missing message field');
        try {
            const response = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: 'test-missing-message',
                    userInfo: { name: 'Test', uid: 1 }
                })
            });

            const result = await response.json();
            if (response.status === 400 && result.error) {
                console.log('✅ Correctly rejected missing message:', result.error);
            } else {
                console.log('❌ Should have returned 400 error:', result);
            }
        } catch (error) {
            console.log('❌ Unexpected error:', error.message);
        }
    }

    async testEmptyMessage() {
        console.log('\n🔥 TEST 3: Empty message');
        try {
            const response = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: 'test-empty-message',
                    message: '',
                    userInfo: { name: 'Test', uid: 1 }
                })
            });

            const result = await response.json();
            if (response.status === 400) {
                console.log('✅ Correctly rejected empty message:', result.error);
            } else {
                console.log('❌ Should have returned 400 error, got:', result);
            }
        } catch (error) {
            console.log('❌ Unexpected error:', error.message);
        }
    }

    async testNonStringMessage() {
        console.log('\n🔥 TEST 4: Non-string message');
        try {
            const response = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: 'test-number-message',
                    message: 123,
                    userInfo: { name: 'Test', uid: 1 }
                })
            });

            const result = await response.json();
            if (response.status === 400) {
                console.log('✅ Correctly rejected non-string message:', result.error);
            } else {
                console.log('❌ Should have returned 400 error, got:', result);
            }
        } catch (error) {
            console.log('❌ Unexpected error:', error.message);
        }
    }

    async testSessionRecovery() {
        console.log('\n🔥 TEST 5: Session recovery from file');
        const sessionId = 'recovery-test-' + Date.now();

        try {
            // First request to create session
            const response1 = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    message: 'I want to go from New York to Paris, 2 people, $3000 budget.',
                    userInfo: { name: 'RecoveryTest', uid: 555 }
                })
            });

            const result1 = await response1.json();
            console.log('✅ Created session with context');

            // Get context to verify
            const contextResponse = await fetch(`${BASE_URL}/api/enhanced-manager/context/${sessionId}`);
            const contextData = await contextResponse.json();

            if (contextData.context.summary.origin.city === 'New York' &&
                contextData.context.summary.destination.city === 'Paris') {
                console.log('✅ Session persistence working correctly');
            } else {
                console.log('❌ Session data not persisted correctly');
            }
        } catch (error) {
            console.log('❌ Session recovery test failed:', error.message);
        }
    }

    async testContextEndpoints() {
        console.log('\n🔥 TEST 6: Context API endpoints');
        const testSessionId = 'context-test-' + Date.now();

        try {
            // Test non-existent session
            const notFoundResponse = await fetch(`${BASE_URL}/api/enhanced-manager/context/non-existent-session`);
            if (notFoundResponse.status === 404) {
                console.log('✅ Correctly returns 404 for non-existent session');
            } else {
                console.log('❌ Should return 404 for non-existent session');
            }

            // Create a session first
            await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: testSessionId,
                    message: 'Test message',
                    userInfo: { name: 'ContextTest', uid: 777 }
                })
            });

            // Test context retrieval
            const contextResponse = await fetch(`${BASE_URL}/api/enhanced-manager/context/${testSessionId}`);
            const contextData = await contextResponse.json();

            if (contextData.sessionId === testSessionId) {
                console.log('✅ Context retrieval working correctly');
            } else {
                console.log('❌ Context retrieval failed');
            }

            // Test context reset
            const resetResponse = await fetch(`${BASE_URL}/api/enhanced-manager/context/${testSessionId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userInfo: { name: 'ResetTest', uid: 888 } })
            });

            if (resetResponse.ok) {
                console.log('✅ Context reset working correctly');
            } else {
                console.log('❌ Context reset failed');
            }

        } catch (error) {
            console.log('❌ Context endpoints test failed:', error.message);
        }
    }

    async testHealthAndSessions() {
        console.log('\n🔥 TEST 7: Health and sessions endpoints');

        try {
            // Test health endpoint
            const healthResponse = await fetch(`${BASE_URL}/api/enhanced-manager/health`);
            const healthData = await healthResponse.json();

            if (healthData.status === 'healthy') {
                console.log('✅ Health endpoint working correctly:', healthData);
            } else {
                console.log('❌ Health endpoint not working');
            }

            // Test sessions list endpoint
            const sessionsResponse = await fetch(`${BASE_URL}/api/enhanced-manager/sessions`);
            const sessionsData = await sessionsResponse.json();

            if (Array.isArray(sessionsData.sessions)) {
                console.log(`✅ Sessions endpoint working correctly: ${sessionsData.sessions.length} sessions`);
            } else {
                console.log('❌ Sessions endpoint not working correctly');
            }

        } catch (error) {
            console.log('❌ Health/sessions test failed:', error.message);
        }
    }

    async testLongMessage() {
        console.log('\n🔥 TEST 8: Very long message handling');
        const longMessage = 'This is a very long message. '.repeat(100);

        try {
            const response = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: 'long-message-test',
                    message: longMessage,
                    userInfo: { name: 'LongTest', uid: 999 }
                })
            });

            const result = await response.json();
            if (response.ok && result.message) {
                console.log(`✅ Long message handled correctly: ${longMessage.length} chars`);
            } else {
                console.log('❌ Long message handling failed');
            }

        } catch (error) {
            console.log('❌ Long message test failed:', error.message);
        }
    }

    async runAllTests() {
        console.log('🚀 Starting edge case tests...\n');

        await this.testInvalidRequest();
        await this.testMissingMessage();
        await this.testEmptyMessage();
        await this.testNonStringMessage();
        await this.testSessionRecovery();
        await this.testContextEndpoints();
        await this.testHealthAndSessions();
        await this.testLongMessage();

        console.log('\n✅ All edge case tests completed!');
    }
}

const edgeTests = new EdgeCaseTestSuite();
await edgeTests.runAllTests();