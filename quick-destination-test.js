import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';

console.log('🚀 Quick Destination Test');

try {
    const response = await fetch(`${BASE_URL}/api/enhanced-manager/enhanced-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId: 'quick-test-' + Date.now(),
            message: "Where should I travel?",
            userInfo: { name: 'QuickTest', uid: 123 }
        })
    });

    const result = await response.json();

    console.log('✅ Response received!');
    console.log(`Agent: ${result.lastAgent}`);
    console.log(`Used Destination Tool: ${result.lastAgent.includes('Destination') ? 'YES' : 'NO'}`);
    console.log(`Questions: ${result.context.summary.suggestedQuestions.length}`);
    console.log(`Response preview: "${result.message.substring(0, 150)}..."`);

} catch (error) {
    console.error('❌ Error:', error.message);
}