/**
 * COMPREHENSIVE STRESS TEST for Flight Agent (OpenAI-optimized prompt)
 * Tests edge cases, rapid modifications, context persistence, error handling
 */

import { runMultiAgentSystem, loadContext, saveContext } from './multiAgentSystem.js';
import { randomBytes } from 'crypto';
import fs from 'fs/promises';

const testChatId = `stress-test-${randomBytes(8).toString('hex')}`;
const logFile = `stress-test-results-${Date.now()}.log`;

// Colors
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(msg, color = c.reset) {
  const line = `${color}${msg}${c.reset}`;
  console.log(line);
  fs.appendFile(logFile, msg + '\n').catch(() => {});
}

function header(title) {
  log(`\n${'='.repeat(80)}`, c.bright);
  log(title, c.bright);
  log('='.repeat(80), c.bright);
}

function section(title) {
  log(`\n${'─'.repeat(80)}`, c.cyan);
  log(title, c.cyan);
}

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

// Comprehensive test scenarios
const testSuite = {
  basic: [
    {
      id: 'B1',
      name: 'Initial Roundtrip Search',
      message: 'Find flights from Delhi to Mumbai on January 20, 2026, returning January 25, 2026, 2 passengers, economy',
      expected: {
        searchCalled: true,
        tripType: 'roundtrip',
        cabinClass: 'economy',
        pax: 2
      }
    },
    {
      id: 'B2',
      name: 'Change to One-Way',
      message: 'Change it to one-way',
      expected: {
        searchCalled: true,
        tripType: 'oneway',
        cabinClass: 'economy',
        pax: 2,
        returnDate: null
      }
    },
    {
      id: 'B3',
      name: 'Change Cabin to Business',
      message: 'Show business class',
      expected: {
        searchCalled: true,
        tripType: 'oneway',
        cabinClass: 'business',
        pax: 2
      }
    }
  ],

  modifications: [
    {
      id: 'M1',
      name: 'Rapid Date Change',
      message: 'What about January 22 instead?',
      expected: {
        searchCalled: true,
        outboundDate: '2026-01-22'
      }
    },
    {
      id: 'M2',
      name: 'Passenger Count Change',
      message: 'Make it 3 passengers',
      expected: {
        searchCalled: true,
        pax: 3
      }
    },
    {
      id: 'M3',
      name: 'Multiple Changes at Once',
      message: 'Change to economy and 4 passengers',
      expected: {
        searchCalled: true,
        cabinClass: 'economy',
        pax: 4
      }
    },
    {
      id: 'M4',
      name: 'Back to Roundtrip',
      message: 'Make it roundtrip returning January 28',
      expected: {
        searchCalled: true,
        tripType: 'roundtrip',
        returnDate: '2026-01-28'
      }
    }
  ],

  informationRequests: [
    {
      id: 'I1',
      name: 'Which is Fastest',
      message: 'Which flight is the fastest?',
      expected: {
        searchCalled: false,
        usesExistingResults: true
      }
    },
    {
      id: 'I2',
      name: 'Baggage Info',
      message: 'What is the baggage allowance?',
      expected: {
        searchCalled: false,
        usesExistingResults: true
      }
    },
    {
      id: 'I3',
      name: 'Price Comparison',
      message: 'Which is cheapest?',
      expected: {
        searchCalled: false,
        usesExistingResults: true
      }
    }
  ],

  edgeCases: [
    {
      id: 'E1',
      name: 'Ambiguous Modification',
      message: 'Try January 25',
      expected: {
        searchCalled: true,
        outboundDate: '2026-01-25'
      }
    },
    {
      id: 'E2',
      name: 'Unclear Intent',
      message: 'Show me more',
      expected: {
        searchCalled: false,
        clarificationNeeded: false
      }
    },
    {
      id: 'E3',
      name: 'Multiple Rapid Changes',
      messages: [
        'Make it economy',
        'Actually, business class',
        'No wait, premium economy'
      ],
      expected: {
        searchCalled: true,
        cabinClass: 'premium_economy'
      }
    },
    {
      id: 'E4',
      name: 'Date in Past (Should Auto-Correct)',
      message: 'Find flights on January 5, 2025',
      expected: {
        dateAdjusted: true,
        outboundDate: '2026-01-05'
      }
    }
  ],

  stressScenarios: [
    {
      id: 'S1',
      name: 'New Route During Session',
      message: 'Find flights from London to Paris instead',
      expected: {
        searchCalled: true,
        newRoute: true
      }
    },
    {
      id: 'S2',
      name: 'Context Persistence Check',
      message: 'Go back to my original Delhi to Mumbai search',
      expected: {
        contextAccess: true
      }
    },
    {
      id: 'S3',
      name: 'Missing Info Recovery',
      message: 'Find me cheap flights',
      expected: {
        asksForInfo: true,
        searchCalled: false
      }
    }
  ]
};

async function runSingleTest(test, conversationHistory, category) {
  section(`[${category}] Test ${test.id}: ${test.name}`);
  log(`📝 Message: "${test.message}"`);

  const beforeContext = await loadContext(testChatId);
  const beforeSearchResults = beforeContext.flight?.searchResults?.length || 0;

  try {
    // Handle multiple messages for edge cases
    const messages = test.messages || [test.message];
    let result;

    for (const msg of messages) {
      conversationHistory.push({ role: 'user', content: msg });

      result = await runMultiAgentSystem(
        msg,
        testChatId,
        conversationHistory,
        false
      );

      conversationHistory.push({ role: 'assistant', content: result.finalOutput });

      // Small delay between rapid messages
      if (messages.length > 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    const afterContext = await loadContext(testChatId);
    const afterSearchResults = afterContext.flight?.searchResults?.length || 0;

    // Validate expectations
    const issues = [];
    const { expected } = test;

    // Check if search was called
    if (expected.searchCalled !== undefined) {
      const searchWasCalled = afterSearchResults > 0 &&
                              (afterSearchResults !== beforeSearchResults ||
                               afterContext.flight.bookingStatus === 'results_shown');

      if (expected.searchCalled && !searchWasCalled) {
        issues.push('Expected flight_search to be called but it wasn\'t');
      } else if (!expected.searchCalled && searchWasCalled) {
        issues.push('Did not expect flight_search but it was called');
      }
    }

    // Check context values
    if (expected.tripType && afterContext.flight.tripType !== expected.tripType) {
      issues.push(`tripType: expected ${expected.tripType}, got ${afterContext.flight.tripType}`);
    }
    if (expected.cabinClass && afterContext.flight.cabinClass !== expected.cabinClass) {
      issues.push(`cabinClass: expected ${expected.cabinClass}, got ${afterContext.flight.cabinClass}`);
    }
    if (expected.pax && afterContext.summary.pax !== expected.pax) {
      issues.push(`pax: expected ${expected.pax}, got ${afterContext.summary.pax}`);
    }
    if (expected.outboundDate && afterContext.summary.outbound_date !== expected.outboundDate) {
      issues.push(`outbound_date: expected ${expected.outboundDate}, got ${afterContext.summary.outbound_date}`);
    }
    if (expected.returnDate === null && afterContext.summary.return_date) {
      issues.push(`return_date should be null, got ${afterContext.summary.return_date}`);
    }
    if (expected.returnDate && afterContext.summary.return_date !== expected.returnDate) {
      issues.push(`return_date: expected ${expected.returnDate}, got ${afterContext.summary.return_date}`);
    }

    // Check for tool name mentions (should never happen)
    const mentionsTools = /web_search|flight_search|tool|IATA/i.test(result.finalOutput);
    if (mentionsTools) {
      issues.push('⚠️  Response mentions internal tool names');
      results.warnings++;
    }

    // Log results
    log(`\n📊 Context After:`, c.blue);
    log(`   Trip Type: ${afterContext.flight.tripType}`);
    log(`   Cabin: ${afterContext.flight.cabinClass}`);
    log(`   Pax: ${afterContext.summary.pax}`);
    log(`   Date: ${afterContext.summary.outbound_date}`);
    log(`   Results: ${afterContext.flight.searchResults?.length || 0} flights`);

    log(`\n💬 Response Preview:`, c.blue);
    log(`   ${result.finalOutput.substring(0, 200).replace(/\n/g, ' ')}...`);

    if (issues.length === 0) {
      log(`\n✅ PASS`, c.green);
      results.passed++;
      results.tests.push({ id: test.id, name: test.name, passed: true });
    } else {
      log(`\n❌ FAIL - Issues:`, c.red);
      issues.forEach(i => log(`   - ${i}`, c.red));
      results.failed++;
      results.tests.push({ id: test.id, name: test.name, passed: false, issues });
    }

    return true;

  } catch (error) {
    log(`\n❌ EXCEPTION: ${error.message}`, c.red);
    results.failed++;
    results.tests.push({
      id: test.id,
      name: test.name,
      passed: false,
      issues: [error.message]
    });
    return false;
  }
}

async function runStressTest() {
  header('FLIGHT AGENT STRESS TEST SUITE');
  log(`Test ID: ${testChatId}`);
  log(`Log File: ${logFile}`);

  const conversationHistory = [];

  // Run Basic Tests
  header('CATEGORY 1: BASIC FUNCTIONALITY');
  for (const test of testSuite.basic) {
    await runSingleTest(test, conversationHistory, 'BASIC');
    await new Promise(r => setTimeout(r, 2000));
  }

  // Run Modification Tests
  header('CATEGORY 2: MODIFICATION DETECTION');
  for (const test of testSuite.modifications) {
    await runSingleTest(test, conversationHistory, 'MODIFICATION');
    await new Promise(r => setTimeout(r, 2000));
  }

  // Run Information Request Tests
  header('CATEGORY 3: INFORMATION REQUESTS');
  for (const test of testSuite.informationRequests) {
    await runSingleTest(test, conversationHistory, 'INFO');
    await new Promise(r => setTimeout(r, 2000));
  }

  // Run Edge Case Tests
  header('CATEGORY 4: EDGE CASES');
  for (const test of testSuite.edgeCases) {
    await runSingleTest(test, conversationHistory, 'EDGE');
    await new Promise(r => setTimeout(r, 2000));
  }

  // Run Stress Scenarios
  header('CATEGORY 5: STRESS SCENARIOS');
  for (const test of testSuite.stressScenarios) {
    await runSingleTest(test, conversationHistory, 'STRESS');
    await new Promise(r => setTimeout(r, 2000));
  }

  // Final Summary
  header('STRESS TEST SUMMARY');

  const total = results.passed + results.failed;
  const passRate = ((results.passed / total) * 100).toFixed(1);

  log(`\n📊 Overall Results:`);
  log(`✅ Passed: ${results.passed}/${total} (${passRate}%)`, c.green);
  if (results.failed > 0) {
    log(`❌ Failed: ${results.failed}/${total}`, c.red);
  }
  if (results.warnings > 0) {
    log(`⚠️  Warnings: ${results.warnings}`, c.yellow);
  }

  log(`\n📝 Test Breakdown by Category:`);
  log(`   Basic: ${testSuite.basic.length} tests`);
  log(`   Modifications: ${testSuite.modifications.length} tests`);
  log(`   Info Requests: ${testSuite.informationRequests.length} tests`);
  log(`   Edge Cases: ${testSuite.edgeCases.length} tests`);
  log(`   Stress: ${testSuite.stressScenarios.length} tests`);

  log(`\n📋 Failed Tests:`);
  const failed = results.tests.filter(t => !t.passed);
  if (failed.length === 0) {
    log(`   None! All tests passed! 🎉`, c.green);
  } else {
    failed.forEach(t => {
      log(`   ${t.id}: ${t.name}`, c.red);
      t.issues?.forEach(i => log(`      - ${i}`, c.red));
    });
  }

  header('STRESS TEST COMPLETE');

  if (results.failed === 0) {
    log(`\n🎉 SUCCESS! All ${total} tests passed!`, c.green);
    log(`The OpenAI-optimized prompt is working correctly!`, c.green);
  } else {
    log(`\n⚠️  ${results.failed} test(s) failed. Review logs for details.`, c.yellow);
  }

  log(`\n📄 Full logs saved to: ${logFile}`);

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run the stress test
runStressTest().catch(error => {
  log(`\n💥 FATAL ERROR:`, c.red);
  log(error.message, c.red);
  log(error.stack, c.red);
  process.exit(1);
});
