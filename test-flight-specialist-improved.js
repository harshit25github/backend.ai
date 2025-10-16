import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';

console.log('🧪 Testing Improved Flight Specialist Agent\n');
console.log('='.repeat(80));
console.log('\nTesting 3 scenarios:');
console.log('1. Complete info (should find flights without showing tools)');
console.log('2. Missing info (should ask for ALL at once)');
console.log('3. City without airport (should handle gracefully)\n');
console.log('='.repeat(80));

async function testScenario(scenarioNum, description, userMessage) {
  console.log(`\n📋 SCENARIO ${scenarioNum}: ${description}`);
  console.log('-'.repeat(80));
  console.log(`User: "${userMessage}"\n`);

  const chatId = `test-fs-improved-${Date.now()}-${scenarioNum}`;
  const conversationHistory = [{ role: 'user', content: userMessage }];

  try {
    const result = await runMultiAgentSystem(userMessage, chatId, conversationHistory);

    const response = String(result.finalOutput || '');

    console.log(`Agent: ${result.lastAgent}`);
    console.log(`\nResponse:\n${response.substring(0, 800)}${response.length > 800 ? '...\n[truncated]' : ''}\n`);

    // Check for improvements
    const issues = [];

    // Check 1: Should NOT mention tool names
    if (response.toLowerCase().includes('web_search') || response.toLowerCase().includes('flight_search')) {
      issues.push('❌ ISSUE: Mentioned internal tool names (web_search/flight_search)');
    } else {
      console.log('✅ PASS: No internal tool names mentioned');
    }

    // Check 2: Should NOT show thinking process
    if (response.toLowerCase().includes('let me search') ||
        response.toLowerCase().includes('i need to find') ||
        response.toLowerCase().includes('looking up')) {
      issues.push('❌ ISSUE: Showing internal thinking process');
    } else {
      console.log('✅ PASS: No internal thinking exposed');
    }

    // Check 3: If asking questions, should be comprehensive
    if (response.includes('?')) {
      const questionMarks = (response.match(/\?/g) || []).length;
      if (questionMarks >= 3) {
        console.log(`✅ PASS: Asking ${questionMarks} questions at once (comprehensive)`);
      } else {
        console.log(`⚠️  WARNING: Only ${questionMarks} questions - might need multiple rounds`);
      }
    }

    if (issues.length > 0) {
      console.log('\n' + issues.join('\n'));
    }

    console.log('-'.repeat(80));

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    return { success: true, issues: issues.length };

  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { success: false };
  }
}

async function runTests() {
  const results = [];

  // Test 1: Complete information
  results.push(await testScenario(
    1,
    'Complete Info',
    'Find flights from Delhi to Mumbai on January 10, returning January 15, 2 passengers, economy'
  ));

  // Test 2: Missing information
  results.push(await testScenario(
    2,
    'Missing Info (should ask for ALL at once)',
    'I need a flight to Bangalore'
  ));

  // Test 3: City without airport
  results.push(await testScenario(
    3,
    'City Without Airport',
    'Find flights from Nellore to Goa on December 20, 1 passenger, economy, one-way'
  ));

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.success && r.issues === 0).length;
  const warnings = results.filter(r => r.success && r.issues > 0).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✅ Passed: ${passed}/3`);
  console.log(`⚠️  Warnings: ${warnings}/3`);
  console.log(`❌ Failed: ${failed}/3`);

  if (passed === 3) {
    console.log('\n🎉 All tests passed! Flight Specialist improvements working correctly.');
  } else if (passed + warnings === 3) {
    console.log('\n✅ Tests completed with minor warnings.');
  } else {
    console.log('\n⚠️  Some tests failed. Review the output above.');
  }

  console.log('='.repeat(80));
}

runTests().catch(console.error);
