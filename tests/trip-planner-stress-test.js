import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://localhost:3000/api/chat';
const OUTPUT_DIR = path.join(__dirname, '../stress-test-results');

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

// Helper to format output
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper to save turn data
function saveTurn(scenarioName, turnNumber, data) {
  const filename = `${scenarioName}_turn${turnNumber}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  log(`   📄 Saved: ${filename}`, 'blue');
}

// Helper to send message and get response
async function sendMessage(chatId, message) {
  try {
    const response = await axios.post(`${API_BASE}/message`, {
      chatId,
      message
    }, {
      timeout: 60000
    });
    return response.data;
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
}

// Test scenarios
const scenarios = [
  {
    name: 'scenario1_vague_request',
    description: 'User provides very vague initial request',
    turns: [
      {
        user: "I want to go on vacation",
        expect: {
          shouldAskForAllFields: true,
          shouldGroupQuestions: true,
          shouldProvideBudgetRanges: false // No destination yet
        }
      },
      {
        user: "Paris, from Mumbai",
        expect: {
          shouldAskForMissingFields: true,
          shouldProvideBudgetRanges: true // Now has destination
        }
      },
      {
        user: "5 days, 2 people, budget around 1 lakh per person",
        expect: {
          shouldConfirm: true,
          shouldNotCreateItinerary: true // Wait for confirmation
        }
      },
      {
        user: "Yes, create it",
        expect: {
          shouldCreateItinerary: true,
          shouldNotAskAgain: true,
          itineraryDays: 5
        }
      }
    ]
  },
  {
    name: 'scenario2_complete_upfront',
    description: 'User provides all information upfront',
    turns: [
      {
        user: "Plan a 5-day trip to Bali from Delhi for 2 people in April, budget ₹1.5L per person",
        expect: {
          shouldConfirm: true,
          shouldNotAskForInfo: true,
          allFieldsPresent: true
        }
      },
      {
        user: "Yes please",
        expect: {
          shouldCreateItinerary: true,
          itineraryDays: 5,
          shouldIncludeVisaReminder: true
        }
      }
    ]
  },
  {
    name: 'scenario3_confirmation_loop_test',
    description: 'Test that agent does NOT ask for confirmation multiple times',
    turns: [
      {
        user: "Trip to Goa from Mumbai, 3 days, 2 people, budget 40k total",
        expect: {
          shouldConfirm: true
        }
      },
      {
        user: "Sure",
        expect: {
          shouldCreateItinerary: true,
          shouldNotAskAgain: true
        }
      }
    ]
  },
  {
    name: 'scenario4_modification_after_creation',
    description: 'User modifies trip after itinerary is created',
    turns: [
      {
        user: "Plan 5-day Paris trip from Delhi for 2 people, budget 1L per person",
        expect: {
          shouldConfirm: true
        }
      },
      {
        user: "Yes",
        expect: {
          shouldCreateItinerary: true,
          itineraryDays: 5
        }
      },
      {
        user: "Actually, make it 3 days instead of 5",
        expect: {
          shouldCreateNewItinerary: true,
          itineraryDays: 3,
          shouldNotAskConfirmation: true // Should modify directly
        }
      }
    ]
  },
  {
    name: 'scenario5_vague_destination',
    description: 'User asks for "nearby" destination without providing origin',
    turns: [
      {
        user: "I want to visit a wildlife sanctuary near me",
        expect: {
          shouldAskForOrigin: true,
          shouldNotSuggestDestinations: true
        }
      },
      {
        user: "I'm in Delhi",
        expect: {
          shouldProvideOptions: true,
          optionsCount: [2, 3, 4] // Between 2-4 options
        }
      },
      {
        user: "Jim Corbett sounds good, weekend trip for 2 people",
        expect: {
          shouldAskForBudget: true
        }
      },
      {
        user: "Around 30k total",
        expect: {
          shouldConfirm: true
        }
      },
      {
        user: "Create it",
        expect: {
          shouldCreateItinerary: true,
          itineraryDays: 2 // Weekend = 2 days
        }
      }
    ]
  },
  {
    name: 'scenario6_budget_variations',
    description: 'Test different budget formats and ranges',
    turns: [
      {
        user: "Trip to Dubai from Mumbai for 4 people, 7 days",
        expect: {
          shouldAskForBudget: true,
          shouldShowBudgetRanges: true
        }
      },
      {
        user: "Total budget 5 lakhs for everyone",
        expect: {
          shouldConfirm: true,
          budgetPerPerson: false // Total budget, not per person
        }
      },
      {
        user: "Yes go ahead",
        expect: {
          shouldCreateItinerary: true,
          itineraryDays: 7
        }
      }
    ]
  },
  {
    name: 'scenario7_question_not_confirmation',
    description: 'User asks questions without confirming trip',
    turns: [
      {
        user: "What's the weather like in Bali in June?",
        expect: {
          shouldAnswerQuestion: true,
          shouldNotExtractDestination: true
        }
      },
      {
        user: "Sounds good. Plan a trip to Bali from Bangalore for 2 people",
        expect: {
          shouldAskForMissingFields: true
        }
      },
      {
        user: "5 days, budget 80k per person",
        expect: {
          shouldConfirm: true
        }
      },
      {
        user: "Yes",
        expect: {
          shouldCreateItinerary: true
        }
      }
    ]
  },
  {
    name: 'scenario8_past_date_adjustment',
    description: 'Test that agent adjusts past dates to future',
    turns: [
      {
        user: "Plan trip to Thailand from Delhi for 2 people, January 15, 2025, 7 days, budget 1L per person",
        expect: {
          shouldAdjustDate: true,
          adjustedYear: 2026,
          shouldInformUser: true
        }
      },
      {
        user: "Okay, create it",
        expect: {
          shouldCreateItinerary: true,
          itineraryDays: 7
        }
      }
    ]
  },
  {
    name: 'scenario9_multiple_missing_fields',
    description: 'User provides destination only, missing 4 fields',
    turns: [
      {
        user: "I want to visit Japan",
        expect: {
          shouldAskForMultipleFields: true,
          shouldGroupQuestions: true,
          missingFields: ['origin', 'duration', 'pax', 'budget']
        }
      },
      {
        user: "From Mumbai, 10 days, family of 4",
        expect: {
          shouldAskForBudget: true,
          shouldShowBudgetRanges: true
        }
      },
      {
        user: "Around 2 lakhs per person",
        expect: {
          shouldConfirm: true,
          allFieldsPresent: true
        }
      },
      {
        user: "Yes please proceed",
        expect: {
          shouldCreateItinerary: true,
          itineraryDays: 10
        }
      }
    ]
  },
  {
    name: 'scenario10_budget_conscious_traveler',
    description: 'Budget-conscious traveler asking for cheap options',
    turns: [
      {
        user: "Cheap weekend getaway from Bangalore for 2 people",
        expect: {
          shouldAskForDestinationPreference: true
        }
      },
      {
        user: "Maybe Gokarna or Pondicherry",
        expect: {
          shouldProvideOptions: true,
          shouldAskForBudget: true
        }
      },
      {
        user: "Let's do Gokarna, super budget - max 15k total for both of us",
        expect: {
          shouldConfirm: true,
          budgetPerPerson: false
        }
      },
      {
        user: "Yes",
        expect: {
          shouldCreateItinerary: true,
          itineraryDays: 2
        }
      }
    ]
  }
];

// Evaluation function
function evaluateTurn(turnData, expectations) {
  const response = turnData.agentResponse.toLowerCase();
  const context = turnData.context;
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  // Check expectations
  if (expectations.shouldAskForAllFields) {
    const hasOriginQ = response.includes('where') && (response.includes('from') || response.includes('traveling'));
    const hasDurationQ = response.includes('how many days') || response.includes('days');
    const hasPaxQ = response.includes('how many people') || response.includes('travelers');
    const hasBudgetQ = response.includes('budget');

    if (hasOriginQ && hasDurationQ && hasPaxQ && hasBudgetQ) {
      results.passed.push('✓ Asked for all mandatory fields');
    } else {
      results.failed.push('✗ Did not ask for all mandatory fields');
    }
  }

  if (expectations.shouldConfirm) {
    const hasConfirmation = response.includes('confirm') || response.includes('should i create');
    const hasSummary = (response.includes('from:') || response.includes('**from**')) &&
                       (response.includes('travelers:') || response.includes('**travelers**'));

    if (hasConfirmation && hasSummary) {
      results.passed.push('✓ Asked for confirmation with summary');
    } else {
      results.failed.push('✗ Did not properly confirm with summary');
    }
  }

  if (expectations.shouldCreateItinerary) {
    const hasDay1 = response.includes('day 1') || response.includes('### day 1');
    const hasMultipleDays = response.match(/day \d/gi)?.length >= expectations.itineraryDays;

    if (hasDay1) {
      results.passed.push('✓ Created itinerary with Day 1');

      if (hasMultipleDays) {
        results.passed.push(`✓ Has ${expectations.itineraryDays} days`);
      } else {
        results.warnings.push(`⚠ May not have all ${expectations.itineraryDays} days`);
      }
    } else {
      results.failed.push('✗ Did not create itinerary');
    }
  }

  if (expectations.shouldNotAskAgain) {
    const hasConfirmationQuestion = response.includes('should i') || response.includes('confirm');
    if (!hasConfirmationQuestion) {
      results.passed.push('✓ Did NOT ask for confirmation again');
    } else {
      results.failed.push('✗ CRITICAL: Asked for confirmation again (loop detected)');
    }
  }

  if (expectations.shouldProvideBudgetRanges) {
    const hasBudgetRanges = response.includes('₹') && (response.includes('budget:') || response.includes('comfortable:'));
    if (hasBudgetRanges) {
      results.passed.push('✓ Provided budget ranges');
    } else {
      results.warnings.push('⚠ Did not provide budget ranges');
    }
  }

  if (expectations.shouldIncludeVisaReminder) {
    const hasVisaReminder = response.includes('visa') && response.includes('requirement');
    if (hasVisaReminder) {
      results.passed.push('✓ Included visa reminder');
    } else {
      results.failed.push('✗ Missing visa reminder');
    }
  }

  if (expectations.shouldAskForOrigin) {
    const asksOrigin = response.includes('which city') || (response.includes('where') && response.includes('from'));
    if (asksOrigin) {
      results.passed.push('✓ Asked for origin/location');
    } else {
      results.failed.push('✗ Did not ask for origin');
    }
  }

  if (expectations.shouldProvideOptions) {
    const hasNumberedList = response.match(/\d\./g)?.length >= 2;
    if (hasNumberedList) {
      results.passed.push('✓ Provided multiple options');
    } else {
      results.warnings.push('⚠ May not have provided enough options');
    }
  }

  // Check context data
  if (context && context.summary) {
    const summary = context.summary;
    const mandatoryFields = {
      origin: summary.origin?.city,
      destination: summary.destination?.city,
      duration_days: summary.duration_days,
      pax: summary.pax,
      budget: summary.budget?.amount
    };

    const filledFields = Object.entries(mandatoryFields).filter(([k, v]) => v !== null && v !== undefined);
    results.passed.push(`✓ Context has ${filledFields.length}/5 mandatory fields filled`);
  }

  return results;
}

// Main test runner
async function runStressTest() {
  log('\n╔══════════════════════════════════════════════════════════════════════════════╗', 'bright');
  log('║            TRIP PLANNER AGENT - COMPREHENSIVE STRESS TEST                   ║', 'bright');
  log('╚══════════════════════════════════════════════════════════════════════════════╝\n', 'bright');

  const timestamp = Date.now();
  const allResults = [];

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    const chatId = `${scenario.name}_${timestamp}`;

    log(`\n${'='.repeat(80)}`, 'cyan');
    log(`SCENARIO ${i + 1}/${scenarios.length}: ${scenario.name}`, 'bright');
    log(`${scenario.description}`, 'yellow');
    log('='.repeat(80), 'cyan');

    const scenarioResults = {
      name: scenario.name,
      description: scenario.description,
      turns: []
    };

    for (let turnNum = 0; turnNum < scenario.turns.length; turnNum++) {
      const turn = scenario.turns[turnNum];

      log(`\n[Turn ${turnNum + 1}/${scenario.turns.length}]`, 'magenta');
      log(`   👤 User: "${turn.user}"`, 'green');

      try {
        const response = await sendMessage(chatId, turn.user);

        log(`   🤖 Agent: "${response.response.substring(0, 150)}${response.response.length > 150 ? '...' : ''}"`, 'blue');

        // Save turn data
        const turnData = {
          turn: turnNum + 1,
          userPrompt: turn.user,
          agentResponse: response.response,
          context: response.context,
          summary: response.summary,
          lastAgent: response.lastAgent,
          timestamp: new Date().toISOString()
        };

        saveTurn(scenario.name, turnNum + 1, turnData);

        // Evaluate
        const evaluation = evaluateTurn(turnData, turn.expect);

        log('   📊 Evaluation:', 'cyan');
        evaluation.passed.forEach(p => log(`      ${p}`, 'green'));
        evaluation.warnings.forEach(w => log(`      ${w}`, 'yellow'));
        evaluation.failed.forEach(f => log(`      ${f}`, 'red'));

        scenarioResults.turns.push({
          turn: turnNum + 1,
          userPrompt: turn.user,
          agentResponseLength: response.response.length,
          evaluation: evaluation,
          passed: evaluation.failed.length === 0
        });

        // Wait a bit between requests
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        log(`   ❌ ERROR: ${error.message}`, 'red');
        scenarioResults.turns.push({
          turn: turnNum + 1,
          userPrompt: turn.user,
          error: error.message,
          passed: false
        });
      }
    }

    allResults.push(scenarioResults);
  }

  // Final summary
  log('\n\n╔══════════════════════════════════════════════════════════════════════════════╗', 'bright');
  log('║                           STRESS TEST SUMMARY                                ║', 'bright');
  log('╚══════════════════════════════════════════════════════════════════════════════╝\n', 'bright');

  allResults.forEach((scenario, idx) => {
    const passedTurns = scenario.turns.filter(t => t.passed).length;
    const totalTurns = scenario.turns.length;
    const color = passedTurns === totalTurns ? 'green' : passedTurns > 0 ? 'yellow' : 'red';

    log(`${idx + 1}. ${scenario.name}: ${passedTurns}/${totalTurns} turns passed`, color);
  });

  // Save summary
  const summaryFile = path.join(OUTPUT_DIR, `summary_${timestamp}.json`);
  fs.writeFileSync(summaryFile, JSON.stringify(allResults, null, 2));
  log(`\n📄 Full summary saved: ${summaryFile}`, 'blue');

  log(`\n✅ All turn data saved to: ${OUTPUT_DIR}`, 'green');
}

// Check server health
async function checkServer() {
  try {
    log('Checking server health...', 'yellow');
    // Try to make a simple request to see if server is running
    await axios.post(`${API_BASE}/message`, {
      chatId: 'health-check',
      message: 'test'
    }, { timeout: 5000 });
    log('✓ Server is ready\n', 'green');
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('✗ Server is not running. Please start the server first.', 'red');
      log('  Run: npm start', 'yellow');
      return false;
    }
    // If we get other errors but connection succeeded, server is running
    log('✓ Server is ready\n', 'green');
    return true;
  }
}

// Run
(async () => {
  const serverReady = await checkServer();
  if (!serverReady) {
    process.exit(1);
  }

  await runStressTest();
})();
