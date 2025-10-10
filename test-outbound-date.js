// Quick test to verify outbound_date handling

const API_URL = 'http://localhost:3000/api/enhanced-manager/enhanced-chat';
const SESSION_ID = `test-outbound-${Date.now()}`;

console.log('🧪 Testing Outbound Date Handling');
console.log('=' .repeat(50));

async function testOutboundDate() {
  try {
    // Test 1: Vague request - should ask for travel date
    console.log('\n📍 Test 1: Vague Request');
    console.log('User: "I want to travel somewhere"');

    const response1 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        message: "I want to travel somewhere",
        userInfo: { name: 'TestUser', uid: 'test-123' }
      })
    });

    const result1 = await response1.json();
    const content1 = result1.content || '';

    const asksForDate = /when.*planning.*travel|travel.*date|starting.*date/i.test(content1);
    console.log(`✓ Agent response includes: ${content1.substring(0, 200)}...`);
    console.log(`${asksForDate ? '✅' : '❌'} Agent asks for travel date: ${asksForDate}`);

    // Test 2: User provides relative date
    console.log('\n📍 Test 2: Relative Date');
    console.log('User: "I want to go to Paris next month for 5 days, 2 people"');

    const response2 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        message: "I want to go to Paris next month for 5 days, 2 people",
        userInfo: { name: 'TestUser', uid: 'test-123' }
      })
    });

    const result2 = await response2.json();
    const summary2 = result2.context?.summary || {};

    console.log(`✓ Captured outbound_date: ${summary2.outbound_date || 'NOT CAPTURED'}`);
    console.log(`✓ Captured destination: ${summary2.destination?.city || 'NOT CAPTURED'}`);
    console.log(`✓ Captured duration: ${summary2.duration_days || 'NOT CAPTURED'} days`);
    console.log(`✓ Captured pax: ${summary2.pax || 'NOT CAPTURED'}`);

    const hasOutboundDate = !!summary2.outbound_date;
    console.log(`${hasOutboundDate ? '✅' : '❌'} outbound_date captured: ${hasOutboundDate}`);

    // Test 3: User provides specific date
    console.log('\n📍 Test 3: Specific Date');
    const newSession = `test-outbound-${Date.now()}-specific`;
    console.log('User: "I want to travel to Tokyo on 2025-12-15 for 7 days, solo trip"');

    const response3 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: newSession,
        message: "I want to travel to Tokyo on 2025-12-15 for 7 days, solo trip",
        userInfo: { name: 'TestUser', uid: 'test-123' }
      })
    });

    const result3 = await response3.json();
    const summary3 = result3.context?.summary || {};

    console.log(`✓ Captured outbound_date: ${summary3.outbound_date || 'NOT CAPTURED'}`);
    console.log(`✓ Expected: 2025-12-15`);

    const correctDate = summary3.outbound_date === '2025-12-15';
    console.log(`${correctDate ? '✅' : '❌'} Date format correct: ${correctDate}`);

    console.log('\n' + '='.repeat(50));
    console.log('✅ Test Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testOutboundDate();
