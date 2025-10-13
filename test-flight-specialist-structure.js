/**
 * STRUCTURE VALIDATION TEST
 * Tests the Flight Specialist Agent configuration without API calls
 */

import { flightSpecialistAgent, flight_search } from './src/ai/multiAgentSystem.js';
import { AGENT_PROMPTS } from './src/ai/handoff-prompt.js';

console.log('🔍 FLIGHT SPECIALIST AGENT - STRUCTURE VALIDATION TEST\n');
console.log('='.repeat(80));

// Test 1: Agent Configuration
console.log('\n✅ TEST 1: Agent Configuration');
console.log(`   Agent Name: ${flightSpecialistAgent.name}`);
console.log(`   Model: ${flightSpecialistAgent.model}`);
console.log(`   Tools Count: ${flightSpecialistAgent.tools?.length || 0}`);

if (flightSpecialistAgent.model === 'gpt-4.1') {
  console.log('   ✓ Using GPT-4.1 model');
} else {
  console.log('   ✗ NOT using GPT-4.1 (current: ' + flightSpecialistAgent.model + ')');
}

// Test 2: Tool Count (Should be 2: flight_search + web_search)
console.log('\n✅ TEST 2: Tool Count Verification');
const toolCount = flightSpecialistAgent.tools?.length || 0;
console.log(`   Expected: 2 tools (flight_search + web_search)`);
console.log(`   Actual: ${toolCount} tools`);

if (toolCount === 2) {
  console.log('   ✓ Correct number of tools');
  
  // List the tool names
  console.log('\n   Tool Names:');
  flightSpecialistAgent.tools.forEach((tool, idx) => {
    const toolName = tool.schema?.name || tool.name || 'unknown';
    console.log(`   ${idx + 1}. ${toolName}`);
  });
} else {
  console.log(`   ✗ INCORRECT tool count (should be 2, got ${toolCount})`);
}

// Test 3: flight_search tool parameters
console.log('\n✅ TEST 3: flight_search Tool Parameters');
const flightSearchTool = flightSpecialistAgent.tools.find(
  t => (t.schema?.name || t.name) === 'flight_search'
);

if (flightSearchTool) {
  const params = flightSearchTool.schema?.parameters?.shape || {};
  const paramKeys = Object.keys(params);
  
  console.log(`   Total parameters: ${paramKeys.length}`);
  console.log(`   Parameters: ${paramKeys.join(', ')}`);
  
  // Check for new IATA parameters
  const hasOriginIATA = paramKeys.includes('origin_iata');
  const hasDestIATA = paramKeys.includes('destination_iata');
  const hasOriginAirportName = paramKeys.includes('origin_airport_name');
  const hasOriginDistance = paramKeys.includes('origin_distance_km');
  
  console.log(`\n   New IATA Parameters:`);
  console.log(`   ✓ origin_iata: ${hasOriginIATA ? 'Present' : 'MISSING'}`);
  console.log(`   ✓ destination_iata: ${hasDestIATA ? 'Present' : 'MISSING'}`);
  console.log(`   ✓ origin_airport_name: ${hasOriginAirportName ? 'Present' : 'MISSING'}`);
  console.log(`   ✓ origin_distance_km: ${hasOriginDistance ? 'Present' : 'MISSING'}`);
  
  if (hasOriginIATA && hasDestIATA && hasOriginAirportName && hasOriginDistance) {
    console.log('\n   ✓ All new IATA parameters present - Tool enhanced correctly!');
  } else {
    console.log('\n   ✗ Some IATA parameters missing');
  }
} else {
  console.log('   ✗ flight_search tool not found!');
}

// Test 4: Check for old update_flight_airports tool (should NOT exist)
console.log('\n✅ TEST 4: Old Tool Removal Verification');
const hasOldTool = flightSpecialistAgent.tools.some(
  t => (t.schema?.name || t.name) === 'update_flight_airports'
);

if (!hasOldTool) {
  console.log('   ✓ Old update_flight_airports tool removed successfully');
} else {
  console.log('   ✗ Old update_flight_airports tool still present (should be removed)');
}

// Test 5: Prompt Structure
console.log('\n✅ TEST 5: GPT-4.1 Prompt Structure');
const prompt = AGENT_PROMPTS.FLIGHT_SPECIALIST;

// Define all prompt check variables
let hasAgenticReminders, hasPersistence, hasToolCalling, hasPlanning;
let hasWorkflow, hasExample, hasChecklist, hasCheapOair, hasTwoTools;
let hasUpdateAirportsRef, hasThreeToolRef;

if (!prompt) {
  console.log('   ✗ FLIGHT_SPECIALIST prompt not found!');
  hasAgenticReminders = hasPersistence = hasToolCalling = hasPlanning = false;
  hasWorkflow = hasExample = hasChecklist = hasCheapOair = hasTwoTools = false;
  hasUpdateAirportsRef = hasThreeToolRef = false;
} else {
  console.log(`   Prompt length: ${prompt.length} characters`);
  
  // Check for GPT-4.1 key sections
  hasAgenticReminders = prompt.includes('AGENTIC REMINDERS') || prompt.includes('PERSISTENCE');
  hasPersistence = prompt.includes('PERSISTENCE') || prompt.includes('keep going until');
  hasToolCalling = prompt.includes('TOOL-CALLING') || prompt.includes('use your tools');
  hasPlanning = prompt.includes('PLANNING') || prompt.includes('plan extensively');
  hasWorkflow = prompt.includes('WORKFLOW') || prompt.includes('Step 1') || prompt.includes('Step 2');
  hasExample = prompt.includes('EXAMPLE') || prompt.includes('thinking out loud');
  hasChecklist = prompt.includes('CHECKLIST') || prompt.includes('Before sending');
  hasCheapOair = prompt.includes('CheapOair');
  hasTwoTools = prompt.includes('2 TOOLS') || prompt.includes('ONLY 2');
  hasUpdateAirportsRef = prompt.includes('update_flight_airports');
  hasThreeToolRef = prompt.includes('3 tools') || prompt.includes('three tools');
  
  console.log('\n   GPT-4.1 Best Practices:');
  console.log(`   ✓ Agentic Reminders: ${hasAgenticReminders ? 'Present' : 'MISSING'}`);
  console.log(`   ✓ Persistence: ${hasPersistence ? 'Present' : 'MISSING'}`);
  console.log(`   ✓ Tool-Calling: ${hasToolCalling ? 'Present' : 'MISSING'}`);
  console.log(`   ✓ Planning: ${hasPlanning ? 'Present' : 'MISSING'}`);
  console.log(`   ✓ Workflow Documentation: ${hasWorkflow ? 'Present' : 'MISSING'}`);
  console.log(`   ✓ Example Interaction: ${hasExample ? 'Present' : 'MISSING'}`);
  console.log(`   ✓ Pre-Response Checklist: ${hasChecklist ? 'Present' : 'MISSING'}`);
  console.log(`   ✓ CheapOair Branding: ${hasCheapOair ? 'Present' : 'MISSING'}`);
  console.log(`   ✓ Two-Tool Emphasis: ${hasTwoTools ? 'Present' : 'MISSING'}`);
  
  const allPracticesPresent = hasAgenticReminders && hasPersistence && hasToolCalling && 
                               hasPlanning && hasWorkflow && hasExample && hasChecklist && hasTwoTools;
  
  if (allPracticesPresent) {
    console.log('\n   ✓ All GPT-4.1 best practices implemented!');
  } else {
    console.log('\n   ⚠️  Some GPT-4.1 practices may be missing');
  }
}

// Test 6: Prompt doesn't use old 3-tool workflow
console.log('\n✅ TEST 6: Old Workflow References');

if (!hasUpdateAirportsRef && !hasThreeToolRef) {
  console.log('   ✓ No references to old 3-tool workflow');
} else {
  console.log('   ✗ Still has references to old workflow');
  if (hasUpdateAirportsRef) console.log('      - Mentions update_flight_airports');
  if (hasThreeToolRef) console.log('      - Mentions 3 tools');
}

// Final Summary
console.log('\n' + '='.repeat(80));
console.log('📊 VALIDATION SUMMARY\n');

const checks = [
  { name: 'Using GPT-4.1 model', passed: flightSpecialistAgent.model === 'gpt-4.1' },
  { name: '2 tools configured', passed: toolCount === 2 },
  { name: 'flight_search has IATA parameters', passed: flightSearchTool && Object.keys(flightSearchTool.schema?.parameters?.shape || {}).includes('origin_iata') },
  { name: 'Old update_flight_airports removed', passed: !hasOldTool },
  { name: 'GPT-4.1 prompt structure', passed: hasAgenticReminders && hasPersistence && hasToolCalling && hasPlanning },
  { name: 'No old workflow references', passed: !hasUpdateAirportsRef && !hasThreeToolRef }
];

const passedChecks = checks.filter(c => c.passed).length;
const totalChecks = checks.length;

checks.forEach(check => {
  console.log(`${check.passed ? '✅' : '❌'} ${check.name}`);
});

console.log(`\n📈 Score: ${passedChecks}/${totalChecks} (${((passedChecks/totalChecks)*100).toFixed(0)}%)`);

if (passedChecks === totalChecks) {
  console.log('\n🎉 ALL STRUCTURE VALIDATIONS PASSED!');
  console.log('✨ Flight Specialist Agent is correctly configured with GPT-4.1 optimizations!');
  console.log('\n💡 To test with actual API calls, set your OPENAI_API_KEY and run:');
  console.log('   node test-flight-specialist-gpt41.js');
} else {
  console.log('\n⚠️  Some validations failed. Review the output above.');
}

console.log('\n' + '='.repeat(80));

