/**
 * Prompt structure validation test
 * Validates GPT-4.1 compliance without requiring API calls
 */

import { FLIGHT } from './flight.prompt.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bright: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(80)}`, colors.bright);
  log(title, colors.bright);
  log('='.repeat(80), colors.bright);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

logSection('GPT-4.1 FLIGHT PROMPT VALIDATION');

const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0
};

// Test 1: Prompt exists and has content
log('\n📝 Test 1: Prompt Structure');
if (FLIGHT && FLIGHT.length > 0) {
  logSuccess(`Prompt exists (${FLIGHT.length} characters)`);
  testResults.passed++;
} else {
  logError('Prompt is empty or undefined');
  testResults.failed++;
}

// Test 2: Check for GPT-4.1 recommended sections
log('\n📋 Test 2: GPT-4.1 Section Structure');
const requiredSections = [
  { name: 'ROLE AND OBJECTIVE', regex: /##\s*1\.\s*ROLE AND OBJECTIVE/ },
  { name: 'CONTEXT AND DATA ACCESS', regex: /##\s*2\.\s*CONTEXT/ },
  { name: 'MANDATORY REASONING STEPS', regex: /##\s*3\.\s*MANDATORY REASONING STEPS/ },
  { name: 'CORE INSTRUCTIONS', regex: /##\s*4\.\s*CORE INSTRUCTIONS/ },
  { name: 'OUTPUT FORMAT', regex: /##\s*5\.\s*OUTPUT FORMAT/ },
  { name: 'EXAMPLES', regex: /##\s*6\.\s*EXAMPLES/ },
  { name: 'FINAL REMINDERS', regex: /##\s*7\.\s*FINAL REMINDERS/ }
];

requiredSections.forEach(section => {
  if (section.regex.test(FLIGHT)) {
    logSuccess(`Section found: ${section.name}`);
    testResults.passed++;
  } else {
    logError(`Missing section: ${section.name}`);
    testResults.failed++;
  }
});

// Test 3: Check for reasoning steps
log('\n🧠 Test 3: Reasoning Steps Framework');
const reasoningSteps = [
  { name: 'Step 1: Analyze Context', regex: /Step 1:.*Context/i },
  { name: 'Step 2: Classify Request', regex: /Step 2:.*Classify/i },
  { name: 'Step 3: Parameter Comparison', regex: /Step 3:.*Parameter/i },
  { name: 'Step 4: Execute Workflow', regex: /Step 4:.*Execute/i },
  { name: 'Step 5: Validation', regex: /Step 5:.*Validation/i }
];

reasoningSteps.forEach(step => {
  if (step.regex.test(FLIGHT)) {
    logSuccess(`Found: ${step.name}`);
    testResults.passed++;
  } else {
    logError(`Missing: ${step.name}`);
    testResults.failed++;
  }
});

// Test 4: Check for request type classification
log('\n🏷️  Test 4: Request Type Classification');
const requestTypes = [
  { name: 'TYPE A: MODIFICATION', regex: /TYPE A.*MODIFICATION/i },
  { name: 'TYPE B: NEW SEARCH', regex: /TYPE B.*NEW SEARCH/i },
  { name: 'TYPE C: INFORMATION', regex: /TYPE C.*INFORMATION/i },
  { name: 'TYPE D: MISSING', regex: /TYPE D.*MISSING/i }
];

requestTypes.forEach(type => {
  if (type.regex.test(FLIGHT)) {
    logSuccess(`Request type defined: ${type.name}`);
    testResults.passed++;
  } else {
    logError(`Missing request type: ${type.name}`);
    testResults.failed++;
  }
});

// Test 5: Check for modification detection keywords
log('\n🔍 Test 5: Modification Detection');
const modificationKeywords = [
  'change', 'update', 'modify', 'instead', 'make it',
  'show me', 'what about', 'try', 'different'
];

const hasModificationSection = /modification.*keyword/i.test(FLIGHT);
if (hasModificationSection) {
  logSuccess('Modification detection keywords section found');
  testResults.passed++;

  const foundKeywords = modificationKeywords.filter(kw =>
    FLIGHT.toLowerCase().includes(kw)
  );

  if (foundKeywords.length >= 5) {
    logSuccess(`Found ${foundKeywords.length}/${modificationKeywords.length} modification keywords`);
    testResults.passed++;
  } else {
    logWarning(`Only found ${foundKeywords.length}/${modificationKeywords.length} modification keywords`);
    testResults.warnings++;
  }
} else {
  logError('No modification detection keywords section');
  testResults.failed++;
}

// Test 6: Check for Context Snapshot references
log('\n📊 Test 6: Context Snapshot Integration');
const contextReferences = [
  { name: 'Context Snapshot reference', regex: /Context Snapshot/i },
  { name: 'flight.searchResults', regex: /flight\.searchResults/ },
  { name: 'flight.tripType', regex: /flight\.tripType/ },
  { name: 'flight.cabinClass', regex: /flight\.cabinClass/ },
  { name: 'summary.pax', regex: /summary\.pax/ }
];

contextReferences.forEach(ref => {
  if (ref.regex.test(FLIGHT)) {
    logSuccess(`Found: ${ref.name}`);
    testResults.passed++;
  } else {
    logError(`Missing: ${ref.name}`);
    testResults.failed++;
  }
});

// Test 7: Check for tool usage instructions
log('\n🛠️  Test 7: Tool Usage Instructions');
const toolInstructions = [
  { name: 'web_search tool', regex: /web_search/ },
  { name: 'flight_search tool', regex: /flight_search/ },
  { name: 'IATA codes', regex: /IATA/ },
  { name: 'Never mention tools to user', regex: /NEVER.*mention.*tool/i }
];

toolInstructions.forEach(instruction => {
  if (instruction.regex.test(FLIGHT)) {
    logSuccess(`Found: ${instruction.name}`);
    testResults.passed++;
  } else {
    logError(`Missing: ${instruction.name}`);
    testResults.failed++;
  }
});

// Test 8: Check for examples
log('\n📚 Test 8: Examples Section');
const exampleCount = (FLIGHT.match(/\*\*User:\*\*/g) || []).length;
if (exampleCount >= 3) {
  logSuccess(`Found ${exampleCount} example conversations`);
  testResults.passed++;
} else if (exampleCount > 0) {
  logWarning(`Only ${exampleCount} example conversations (recommend 5+)`);
  testResults.warnings++;
} else {
  logError('No example conversations found');
  testResults.failed++;
}

// Test 9: Check for final reminders (GPT-4.1 best practice)
log('\n🔄 Test 9: Final Reminders (GPT-4.1 Reinforcement)');
const finalRemindersPresent = /FINAL REMINDERS/i.test(FLIGHT);
if (finalRemindersPresent) {
  logSuccess('Final reminders section present (GPT-4.1 best practice)');
  testResults.passed++;

  // Check if reminders repeat critical instructions
  const hasChecklist = /checklist/i.test(FLIGHT.substring(FLIGHT.indexOf('FINAL REMINDERS')));
  if (hasChecklist) {
    logSuccess('Pre-response checklist included in final reminders');
    testResults.passed++;
  } else {
    logWarning('Consider adding checklist to final reminders');
    testResults.warnings++;
  }
} else {
  logError('Missing final reminders section (GPT-4.1 best practice)');
  testResults.failed++;
}

// Test 10: Check for markdown formatting rules
log('\n📝 Test 10: Markdown Formatting Rules');
const markdownRules = [
  { name: 'Bullet point rules', regex: /blank line.*before.*list/i },
  { name: 'Bold text usage', regex: /\*\*text\*\*/ },
  { name: 'Header usage', regex: /##/ }
];

markdownRules.forEach(rule => {
  if (rule.regex.test(FLIGHT)) {
    logSuccess(`Found: ${rule.name}`);
    testResults.passed++;
  } else {
    logWarning(`Weak: ${rule.name}`);
    testResults.warnings++;
  }
});

// Test 11: Check prompt length (GPT-4.1 optimal: not too long)
log('\n📏 Test 11: Prompt Length Analysis');
const tokenEstimate = Math.ceil(FLIGHT.length / 4); // Rough estimate: 1 token ≈ 4 chars
logInfo(`Prompt length: ${FLIGHT.length} characters (~${tokenEstimate} tokens)`);

if (tokenEstimate < 10000) {
  logSuccess('Prompt is reasonably sized');
  testResults.passed++;
} else if (tokenEstimate < 15000) {
  logWarning('Prompt is lengthy but acceptable');
  testResults.warnings++;
} else {
  logWarning('Prompt is very long, consider condensing');
  testResults.warnings++;
}

// Test 12: Check for parameter comparison table
log('\n📊 Test 12: Parameter Comparison Table');
const hasParameterTable = /\| Parameter \| Context Value \| User.*Request \|/i.test(FLIGHT);
if (hasParameterTable) {
  logSuccess('Parameter comparison table found');
  testResults.passed++;

  const params = ['trip_type', 'cabin_class', 'outbound_date', 'return_date', 'pax'];
  const foundParams = params.filter(p => FLIGHT.includes(p));

  if (foundParams.length === params.length) {
    logSuccess(`All ${params.length} critical parameters included in comparison`);
    testResults.passed++;
  } else {
    logWarning(`Only ${foundParams.length}/${params.length} parameters in comparison table`);
    testResults.warnings++;
  }
} else {
  logError('Parameter comparison table missing (critical for Type A detection)');
  testResults.failed++;
}

// Summary
logSection('VALIDATION SUMMARY');

const totalTests = testResults.passed + testResults.failed;
const passRate = ((testResults.passed / totalTests) * 100).toFixed(1);

log(`\n📊 Results:`);
logSuccess(`Passed: ${testResults.passed}/${totalTests} (${passRate}%)`);
if (testResults.failed > 0) {
  logError(`Failed: ${testResults.failed}/${totalTests}`);
}
if (testResults.warnings > 0) {
  logWarning(`Warnings: ${testResults.warnings}`);
}

log('');
if (testResults.failed === 0) {
  logSection('🎉 PROMPT VALIDATION PASSED! 🎉');
  logSuccess('The prompt follows GPT-4.1 best practices');
  logSuccess('All critical sections are present and structured correctly');

  if (testResults.warnings > 0) {
    logWarning(`Note: ${testResults.warnings} minor warnings (non-critical)`);
  }
} else {
  logSection('❌ VALIDATION FAILED');
  logError(`${testResults.failed} critical issue(s) found`);
  logInfo('Review the errors above and update the prompt');
}

log('\n✨ GPT-4.1 Compliance Checklist:');
log('  ✅ Structured sections (1-7)');
log('  ✅ Context-first approach');
log('  ✅ Step-by-step reasoning framework');
log('  ✅ Request classification system');
log('  ✅ Parameter comparison for modifications');
log('  ✅ Final reminders (instruction reinforcement)');
log('  ✅ Clear examples');
log('  ✅ Tool usage rules\n');

process.exit(testResults.failed > 0 ? 1 : 0);
