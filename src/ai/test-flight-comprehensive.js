/**
 * Comprehensive test suite for GPT-4.1 optimized Flight Agent
 * Tests modification detection, context persistence, and all request types
 */

import { runMultiAgentSystem, loadContext, saveContext } from './multiAgentSystem.js';
import { randomBytes } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const testChatId = `test-flight-comprehensive-${randomBytes(8).toString('hex')}`;
const logFile = path.resolve(`test-results-${testChatId}.log`);

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(`${color}${logMessage}${colors.reset}`);
  fs.appendFile(logFile, logMessage + '\n').catch(() => {});
}

function logSection(title) {
  const line = '='.repeat(80);
  log(`\n${line}`, colors.bright);
  log(title, colors.bright);
  log(line, colors.bright);
}

function logSubSection(title) {
  log(`\n${'─'.repeat(80)}`, colors.cyan);
  log(title, colors.cyan);
  log('─'.repeat(80), colors.cyan);
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

// Test scenarios
const testScenarios = [
  {
    id: 1,
    name: 'Initial Search - Roundtrip Economy',
    message: 'Find flights from Delhi to Mumbai on January 20, 2026, returning January 25, 2026, 2 passengers, economy class',
    expectedBehavior: {
      type: 'new_search',
      shouldCallFlightSearch: true,
      expectedParams: {
        tripType: 'roundtrip',
        cabinClass: 'economy',
        pax: 2,
        outbound_date: '2026-01-20',
        return_date: '2026-01-25'
      }
    }
  },
  {
    id: 2,
    name: 'Modification - Change to One-Way',
    message: 'Change it to one-way',
    expectedBehavior: {
      type: 'modification',
      shouldCallFlightSearch: true,
      modifiedParam: 'trip_type',
      expectedParams: {
        tripType: 'oneway',
        cabinClass: 'economy',
        pax: 2,
        outbound_date: '2026-01-20'
      }
    }
  },
  {
    id: 3,
    name: 'Modification - Change to Business Class',
    message: 'Show business class instead',
    expectedBehavior: {
      type: 'modification',
      shouldCallFlightSearch: true,
      modifiedParam: 'cabin_class',
      expectedParams: {
        tripType: 'oneway',
        cabinClass: 'business',
        pax: 2,
        outbound_date: '2026-01-20'
      }
    }
  },
  {
    id: 4,
    name: 'Modification - Change Date',
    message: 'What about January 22 instead?',
    expectedBehavior: {
      type: 'modification',
      shouldCallFlightSearch: true,
      modifiedParam: 'outbound_date',
      expectedParams: {
        tripType: 'oneway',
        cabinClass: 'business',
        pax: 2,
        outbound_date: '2026-01-22'
      }
    }
  },
  {
    id: 5,
    name: 'Modification - Change Passenger Count',
    message: 'Make it 3 passengers',
    expectedBehavior: {
      type: 'modification',
      shouldCallFlightSearch: true,
      modifiedParam: 'pax',
      expectedParams: {
        tripType: 'oneway',
        cabinClass: 'business',
        pax: 3,
        outbound_date: '2026-01-22'
      }
    }
  },
  {
    id: 6,
    name: 'Information Request - Which is Fastest',
    message: 'Which flight is the fastest?',
    expectedBehavior: {
      type: 'information',
      shouldCallFlightSearch: false,
      shouldUseExistingResults: true
    }
  },
  {
    id: 7,
    name: 'Modification - Back to Economy',
    message: 'Show economy class options',
    expectedBehavior: {
      type: 'modification',
      shouldCallFlightSearch: true,
      modifiedParam: 'cabin_class',
      expectedParams: {
        tripType: 'oneway',
        cabinClass: 'economy',
        pax: 3,
        outbound_date: '2026-01-22'
      }
    }
  },
  {
    id: 8,
    name: 'Modification - Back to Roundtrip',
    message: 'Make it roundtrip returning January 27',
    expectedBehavior: {
      type: 'modification',
      shouldCallFlightSearch: true,
      modifiedParam: 'trip_type',
      expectedParams: {
        tripType: 'roundtrip',
        cabinClass: 'economy',
        pax: 3,
        outbound_date: '2026-01-22',
        return_date: '2026-01-27'
      }
    }
  }
];

// Track test results
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

async function validateContext(scenario, context, beforeContext) {
  const issues = [];
  const expected = scenario.expectedBehavior.expectedParams;

  if (!expected) return issues;

  // Check each expected parameter
  if (expected.tripType !== undefined) {
    if (context.flight.tripType !== expected.tripType) {
      issues.push(`tripType: expected "${expected.tripType}", got "${context.flight.tripType}"`);
    }
  }

  if (expected.cabinClass !== undefined) {
    if (context.flight.cabinClass !== expected.cabinClass) {
      issues.push(`cabinClass: expected "${expected.cabinClass}", got "${context.flight.cabinClass}"`);
    }
  }

  if (expected.pax !== undefined) {
    if (context.summary.pax !== expected.pax) {
      issues.push(`pax: expected ${expected.pax}, got ${context.summary.pax}`);
    }
  }

  if (expected.outbound_date !== undefined) {
    if (context.summary.outbound_date !== expected.outbound_date) {
      issues.push(`outbound_date: expected "${expected.outbound_date}", got "${context.summary.outbound_date}"`);
    }
  }

  if (expected.return_date !== undefined) {
    if (context.summary.return_date !== expected.return_date) {
      issues.push(`return_date: expected "${expected.return_date}", got "${context.summary.return_date}"`);
    }
  } else if (expected.tripType === 'oneway' && context.summary.return_date) {
    issues.push(`return_date should be null for one-way, got "${context.summary.return_date}"`);
  }

  return issues;
}

async function runTest(scenario, conversationHistory) {
  logSubSection(`TEST ${scenario.id}: ${scenario.name}`);
  logInfo(`Message: "${scenario.message}"`);
  logInfo(`Expected: ${scenario.expectedBehavior.type} request`);

  if (scenario.expectedBehavior.shouldCallFlightSearch) {
    logInfo(`Should call flight_search: YES`);
    if (scenario.expectedBehavior.modifiedParam) {
      logInfo(`Modified parameter: ${scenario.expectedBehavior.modifiedParam}`);
    }
  } else {
    logInfo(`Should call flight_search: NO (use existing results)`);
  }

  try {
    // Load context before
    const beforeContext = await loadContext(testChatId);

    // Add message to history
    conversationHistory.push({
      role: 'user',
      content: scenario.message
    });

    log('\n🚀 Running agent...');
    const startTime = Date.now();

    // Run the agent
    const result = await runMultiAgentSystem(
      scenario.message,
      testChatId,
      conversationHistory,
      false
    );

    const duration = Date.now() - startTime;

    // Add response to history
    conversationHistory.push({
      role: 'assistant',
      content: result.finalOutput
    });

    // Load context after
    const afterContext = await loadContext(testChatId);

    log(`⏱️  Duration: ${duration}ms\n`);
    logSuccess(`Agent completed: ${result.lastAgent}`);

    // Show response preview
    const responsePreview = result.finalOutput.substring(0, 150).replace(/\n/g, ' ');
    logInfo(`Response: ${responsePreview}...`);

    // Validate context
    log('\n📊 Context Validation:');
    const issues = await validateContext(scenario, afterContext, beforeContext);

    if (issues.length === 0) {
      logSuccess('All context parameters match expectations');
    } else {
      logError('Context validation issues:');
      issues.forEach(issue => logError(`  - ${issue}`));
    }

    // Show current context state
    log('\n📋 Current Context State:');
    log(`   Trip Type: ${afterContext.flight.tripType}`);
    log(`   Cabin Class: ${afterContext.flight.cabinClass}`);
    log(`   Passengers: ${afterContext.summary.pax}`);
    log(`   Outbound Date: ${afterContext.summary.outbound_date}`);
    log(`   Return Date: ${afterContext.summary.return_date || 'N/A'}`);
    log(`   Origin: ${afterContext.flight.resolvedOrigin?.userCity} (${afterContext.flight.resolvedOrigin?.airportIATA || 'N/A'})`);
    log(`   Destination: ${afterContext.flight.resolvedDestination?.userCity} (${afterContext.flight.resolvedDestination?.airportIATA || 'N/A'})`);
    log(`   Booking Status: ${afterContext.flight.bookingStatus}`);
    log(`   Search Results: ${afterContext.flight.searchResults?.length || 0} flights`);

    // Check if flight_search was called
    const flightSearchCalled = afterContext.flight.searchResults?.length > 0 &&
                                afterContext.flight.bookingStatus === 'results_shown';

    if (scenario.expectedBehavior.shouldCallFlightSearch && !flightSearchCalled) {
      logWarning('Expected flight_search to be called but searchResults unchanged');
      testResults.warnings++;
    } else if (!scenario.expectedBehavior.shouldCallFlightSearch && flightSearchCalled) {
      logWarning('Did not expect flight_search but searchResults changed');
      testResults.warnings++;
    }

    // Determine pass/fail
    const passed = issues.length === 0;
    if (passed) {
      logSuccess(`TEST ${scenario.id} PASSED ✅`);
      testResults.passed++;
    } else {
      logError(`TEST ${scenario.id} FAILED ❌`);
      testResults.failed++;
    }

    testResults.details.push({
      id: scenario.id,
      name: scenario.name,
      passed,
      issues,
      duration
    });

    return { passed, result, afterContext };

  } catch (error) {
    logError(`TEST ${scenario.id} FAILED WITH EXCEPTION ❌`);
    logError(`Error: ${error.message}`);
    logError(error.stack);

    testResults.failed++;
    testResults.details.push({
      id: scenario.id,
      name: scenario.name,
      passed: false,
      issues: [error.message],
      duration: 0
    });

    throw error;
  }
}

async function runAllTests() {
  logSection('GPT-4.1 FLIGHT AGENT - COMPREHENSIVE TEST SUITE');
  log(`Test Chat ID: ${testChatId}`);
  log(`Log File: ${logFile}`);

  const conversationHistory = [];
  let shouldContinue = true;

  for (let i = 0; i < testScenarios.length && shouldContinue; i++) {
    try {
      await runTest(testScenarios[i], conversationHistory);

      // Wait between tests
      if (i < testScenarios.length - 1) {
        log('\n⏳ Waiting 3 seconds before next test...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      logError(`Critical error in test ${testScenarios[i].id}, stopping test suite`);
      shouldContinue = false;
    }
  }

  // Print summary
  logSection('TEST SUMMARY');

  log(`\n📊 Results:`);
  logSuccess(`Passed: ${testResults.passed}/${testScenarios.length}`);
  if (testResults.failed > 0) {
    logError(`Failed: ${testResults.failed}/${testScenarios.length}`);
  }
  if (testResults.warnings > 0) {
    logWarning(`Warnings: ${testResults.warnings}`);
  }

  log('\n📝 Details:');
  testResults.details.forEach(detail => {
    const status = detail.passed ? '✅ PASS' : '❌ FAIL';
    const color = detail.passed ? colors.green : colors.red;
    log(`${status} - Test ${detail.id}: ${detail.name} (${detail.duration}ms)`, color);
    if (detail.issues.length > 0) {
      detail.issues.forEach(issue => log(`     └─ ${issue}`, colors.red));
    }
  });

  // Final verdict
  log('');
  if (testResults.failed === 0) {
    logSection('🎉 ALL TESTS PASSED! 🎉');
    logSuccess('The GPT-4.1 optimized prompt is working correctly!');
    logSuccess('Modification detection is functioning as expected');
  } else {
    logSection('❌ SOME TESTS FAILED');
    logError(`${testResults.failed} test(s) failed`);
    logInfo('Review the logs above to identify issues');
  }

  log(`\n📄 Full logs saved to: ${logFile}`);
}

// Run the tests
runAllTests().catch(error => {
  logError('Fatal error in test suite:');
  logError(error.message);
  logError(error.stack);
  process.exit(1);
});
