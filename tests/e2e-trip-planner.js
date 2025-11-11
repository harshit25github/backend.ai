/**
 * End-to-End Trip Planner Agent Test Suite
 *
 * Tests complete user flows with the Trip Planner agent including:
 * 1. Multi-turn conversations
 * 2. Complex modifications
 * 3. Budget changes
 * 4. Destination changes
 * 5. Full itinerary generation
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api/chat';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Quality assessment for responses
function assessResponseQuality(response) {
  const text = response.response;
  const quality = {
    score: 0,
    maxScore: 100,
    checks: {},
    feedback: []
  };

  // 1. Length check (not too short, not too long)
  if (text.length > 50 && text.length < 2000) {
    quality.score += 10;
    quality.checks.appropriateLength = true;
  } else {
    quality.checks.appropriateLength = false;
    quality.feedback.push('Response length could be improved');
  }

  // 2. Markdown formatting (headers, bullets)
  const hasHeaders = /#{1,3}\s/.test(text);
  const hasBullets = /[-•*]\s/.test(text);
  const hasNumberedLists = /^\d+\.\s/m.test(text);

  if (hasHeaders || hasBullets || hasNumberedLists) {
    quality.score += 15;
    quality.checks.wellFormatted = true;
  } else {
    quality.checks.wellFormatted = false;
    quality.feedback.push('Consider using markdown formatting (headers, bullets)');
  }

  // 3. Has specific details (numbers, dates, amounts)
  const hasNumbers = /\d+/.test(text);
  const hasSpecifics = /₹|hours?|days?|km|miles|minutes?/i.test(text);

  if (hasNumbers && hasSpecifics) {
    quality.score += 20;
    quality.checks.specificDetails = true;
  } else {
    quality.checks.specificDetails = false;
    quality.feedback.push('Add more specific details (times, costs, durations)');
  }

  // 4. Conversational and helpful tone
  const hasQuestions = /\?/.test(text);
  const hasFriendlyWords = /great|perfect|wonderful|love|help|happy/i.test(text);

  if (hasQuestions || hasFriendlyWords) {
    quality.score += 15;
    quality.checks.conversationalTone = true;
  } else {
    quality.checks.conversationalTone = false;
    quality.feedback.push('Response could be more conversational');
  }

  // 5. Actionable information (not vague)
  const hasVagueWords = /maybe|perhaps|possibly|might|could be|approximately/gi;
  const vaguenessCount = (text.match(hasVagueWords) || []).length;

  if (vaguenessCount < 3) {
    quality.score += 15;
    quality.checks.actionable = true;
  } else {
    quality.checks.actionable = false;
    quality.feedback.push(`Too many vague words (${vaguenessCount}). Be more specific.`);
  }

  // 6. No placeholder text (X-Y, XXX, etc.)
  const hasPlaceholders = /X-Y|X{2,}|\[.*?\]|TODO|TBD/i.test(text);

  if (!hasPlaceholders) {
    quality.score += 10;
    quality.checks.noPlaceholders = true;
  } else {
    quality.checks.noPlaceholders = false;
    quality.feedback.push('Contains placeholder text - use actual values');
  }

  // 7. Structured information (if itinerary/suggestions provided)
  if (response.itinerary?.days?.length > 0) {
    const itinerary = response.itinerary;
    const allDaysHaveSegments = itinerary.days.every(day =>
      day.segments && (day.segments.morning?.length > 0 || day.segments.afternoon?.length > 0 || day.segments.evening?.length > 0)
    );

    if (allDaysHaveSegments) {
      quality.score += 10;
      quality.checks.wellStructuredItinerary = true;
    } else {
      quality.checks.wellStructuredItinerary = false;
      quality.feedback.push('Itinerary missing segments for some days');
    }
  }

  // 8. Suggested questions quality
  if (response.suggestedQuestions?.length > 0) {
    const questions = response.suggestedQuestions;
    const allQuestionsRelevant = questions.every(q =>
      q.length > 10 && q.includes('?')
    );

    if (allQuestionsRelevant && questions.length >= 3) {
      quality.score += 5;
      quality.checks.goodSuggestedQuestions = true;
    } else {
      quality.checks.goodSuggestedQuestions = false;
      quality.feedback.push('Suggested questions need improvement');
    }
  }

  // Calculate final grade
  if (quality.score >= 90) quality.grade = 'A+';
  else if (quality.score >= 80) quality.grade = 'A';
  else if (quality.score >= 70) quality.grade = 'B';
  else if (quality.score >= 60) quality.grade = 'C';
  else quality.grade = 'F';

  return quality;
}

// Helper to send message and get response
async function sendMessage(chatId, message) {
  log(`\n📤 User: ${message}`, 'cyan');

  const response = await fetch(`${API_BASE}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Assess quality
  const quality = assessResponseQuality(data);

  log(`\n🤖 Assistant: ${data.response}`, 'green');
  log(`\n📊 Response Quality: ${quality.grade} (${quality.score}/${quality.maxScore})`,
      quality.score >= 70 ? 'green' : quality.score >= 50 ? 'yellow' : 'red');

  if (quality.feedback.length > 0) {
    log(`💡 Feedback:`, 'yellow');
    quality.feedback.forEach(f => log(`   - ${f}`, 'yellow'));
  }

  // Store quality in response for later analysis
  data.quality = quality;

  return data;
}

// Helper to clear chat
async function clearChat(chatId) {
  await fetch(`${API_BASE}/clear/${chatId}`, { method: 'DELETE' });
  log(`\n🗑️  Cleared chat: ${chatId}`, 'yellow');
}

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: 'Complete Trip Planning Flow - Goa Beach Trip',
    chatId: 'e2e-goa-beach',
    description: 'User plans a complete Goa trip from scratch with modifications',
    steps: [
      {
        message: 'I want to plan a beach vacation',
        validate: (response) => {
          return response.response.toLowerCase().includes('beach') &&
                 (response.response.toLowerCase().includes('which') ||
                  response.response.toLowerCase().includes('where'));
        },
        expectExtraction: {
          summary: { tripTypes: [] } // No destination confirmed yet
        }
      },
      {
        message: 'From Mumbai, looking at Goa for 4-5 days',
        validate: (response) => {
          return response.summary?.origin?.city === 'Mumbai' &&
                 response.summary?.destination?.city === 'Goa' &&
                 (response.summary?.duration_days === 4 || response.summary?.duration_days === 5);
        },
        expectExtraction: {
          summary: {
            origin: { city: 'Mumbai' },
            destination: { city: 'Goa' }
          }
        }
      },
      {
        message: 'Make it 5 days, for 2 people, budget around ₹40,000 total',
        validate: (response) => {
          return response.summary?.duration_days === 5 &&
                 response.summary?.pax === 2 &&
                 response.summary?.budget?.amount === 40000;
        },
        expectExtraction: {
          summary: {
            duration_days: 5,
            pax: 2,
            budget: { amount: 40000, currency: 'INR', per_person: false }
          }
        }
      },
      {
        message: 'Dates would be November 20-25, 2026',
        validate: (response) => {
          return response.summary?.outbound_date === '2026-11-20' &&
                 response.summary?.return_date === '2026-11-25';
        },
        expectExtraction: {
          summary: {
            outbound_date: '2026-11-20',
            return_date: '2026-11-25'
          }
        }
      },
      {
        message: 'Yes, create the detailed itinerary',
        validate: (response) => {
          return response.itinerary?.days?.length === 5 &&
                 response.summary?.placesOfInterest?.length > 0;
        },
        expectExtraction: {
          itinerary: { days: 5 },
          summary: {
            placesOfInterest: 'should have items',
            suggestedQuestions: 'should have items'
          }
        }
      }
    ]
  },

  {
    name: 'Trip Modification - Change Duration and Budget',
    chatId: 'e2e-modify-trip',
    description: 'User changes trip parameters mid-planning',
    steps: [
      {
        message: 'Plan a 5-day trip to Paris from Delhi for 2 people',
        validate: (response) => {
          return response.summary?.destination?.city === 'Paris' &&
                 response.summary?.origin?.city === 'Delhi' &&
                 response.summary?.duration_days === 5 &&
                 response.summary?.pax === 2;
        }
      },
      {
        message: 'Actually, make it 7 days instead',
        validate: (response) => {
          return response.summary?.duration_days === 7 &&
                 response.summary?.origin?.city === 'Delhi' &&
                 response.summary?.destination?.city === 'Paris';
        },
        expectExtraction: {
          summary: {
            duration_days: 7,
            origin: { city: 'Delhi' },  // Should preserve
            destination: { city: 'Paris' }  // Should preserve
          }
        }
      },
      {
        message: 'Change to 4 people and budget ₹200,000 per person',
        validate: (response) => {
          return response.summary?.pax === 4 &&
                 response.summary?.budget?.amount === 200000 &&
                 response.summary?.budget?.per_person === true;
        },
        expectExtraction: {
          summary: {
            pax: 4,
            budget: { amount: 200000, currency: 'INR', per_person: true },
            duration_days: 7  // Should preserve
          }
        }
      }
    ]
  },

  {
    name: 'Destination Change - Switch from Tokyo to Bali',
    chatId: 'e2e-destination-change',
    description: 'User changes destination mid-planning',
    steps: [
      {
        message: 'Plan a 6-day trip to Tokyo from Bangalore for 3 people',
        validate: (response) => {
          return response.summary?.destination?.city === 'Tokyo' &&
                 response.summary?.origin?.city === 'Bangalore';
        }
      },
      {
        message: 'My travel dates are March 15-21, 2026, budget ₹150,000 total',
        validate: (response) => {
          return response.summary?.outbound_date === '2026-03-15' &&
                 response.summary?.budget?.amount === 150000;
        }
      },
      {
        message: 'Actually, let me change to Bali instead of Tokyo',
        validate: (response) => {
          return response.summary?.destination?.city === 'Bali' &&
                 response.summary?.origin?.city === 'Bangalore' &&
                 response.summary?.duration_days === 6 &&
                 response.summary?.pax === 3;
        },
        expectExtraction: {
          summary: {
            destination: { city: 'Bali' },
            origin: { city: 'Bangalore' },  // Preserved
            duration_days: 6,  // Preserved
            pax: 3  // Preserved
          }
        }
      }
    ]
  },

  {
    name: 'Multi-City Complex Trip - Europe',
    chatId: 'e2e-multi-city',
    description: 'Complex multi-city European trip',
    steps: [
      {
        message: 'I want to plan a Europe trip covering Paris, Amsterdam, and Rome',
        validate: (response) => {
          return response.response.toLowerCase().includes('europe') ||
                 response.response.toLowerCase().includes('paris');
        }
      },
      {
        message: 'From Mumbai, 12 days, 4 people, budget ₹400,000 total',
        validate: (response) => {
          return response.summary?.origin?.city === 'Mumbai' &&
                 response.summary?.duration_days === 12 &&
                 response.summary?.pax === 4 &&
                 response.summary?.budget?.amount === 400000;
        }
      },
      {
        message: 'Starting June 10, 2026. We love art, history, and trying local food',
        validate: (response) => {
          return response.summary?.outbound_date === '2026-06-10' &&
                 response.summary?.tripTypes?.some(t =>
                   t.toLowerCase().includes('art') ||
                   t.toLowerCase().includes('cultural') ||
                   t.toLowerCase().includes('food')
                 );
        }
      }
    ]
  },

  {
    name: 'Budget Traveler - Backpacking Thailand',
    chatId: 'e2e-budget-thailand',
    description: 'Budget-conscious backpacking trip',
    steps: [
      {
        message: 'I want to backpack Thailand on a tight budget',
        validate: (response) => {
          return response.response.toLowerCase().includes('thailand') ||
                 response.response.toLowerCase().includes('budget');
        }
      },
      {
        message: 'From Delhi, solo traveler, 10 days, budget ₹50,000 all inclusive',
        validate: (response) => {
          return response.summary?.origin?.city === 'Delhi' &&
                 response.summary?.destination?.city === 'Thailand' &&
                 response.summary?.pax === 1 &&
                 response.summary?.budget?.amount === 50000;
        }
      },
      {
        message: 'Interested in beaches, street food, and adventure activities',
        validate: (response) => {
          return response.summary?.tripTypes?.length > 0;
        },
        expectExtraction: {
          summary: {
            tripTypes: ['beach', 'food', 'adventure']  // Should extract interests
          }
        }
      }
    ]
  },

  {
    name: 'Luxury Trip - Maldives Honeymoon',
    chatId: 'e2e-luxury-maldives',
    description: 'High-budget luxury honeymoon',
    steps: [
      {
        message: 'Plan a luxury honeymoon to Maldives',
        validate: (response) => {
          return response.summary?.destination?.city?.toLowerCase().includes('maldiv') ||
                 response.response.toLowerCase().includes('maldiv');
        }
      },
      {
        message: 'From Hyderabad, 7 days for 2 people, budget ₹500,000 total',
        validate: (response) => {
          return response.summary?.origin?.city === 'Hyderabad' &&
                 response.summary?.duration_days === 7 &&
                 response.summary?.pax === 2 &&
                 response.summary?.budget?.amount === 500000;
        }
      },
      {
        message: 'We want overwater villas, spa, water sports, and fine dining',
        validate: (response) => {
          return response.summary?.tripTypes?.some(t =>
            t.toLowerCase().includes('luxury') ||
            t.toLowerCase().includes('wellness') ||
            t.toLowerCase().includes('beach')
          );
        }
      }
    ]
  },

  {
    name: 'Family Vacation - Dubai',
    chatId: 'e2e-family-dubai',
    description: 'Family trip with kids',
    steps: [
      {
        message: 'Planning a family vacation to Dubai with kids',
        validate: (response) => {
          return response.summary?.destination?.city === 'Dubai' ||
                 response.response.toLowerCase().includes('dubai');
        }
      },
      {
        message: 'Family of 5 (2 adults, 3 kids aged 5, 8, 12), from Bangalore, 6 days',
        validate: (response) => {
          return response.summary?.pax === 5 &&
                 response.summary?.duration_days === 6;
        }
      },
      {
        message: 'Budget ₹300,000 total, dates December 20-26, 2026',
        validate: (response) => {
          return response.summary?.budget?.amount === 300000 &&
                 response.summary?.outbound_date === '2026-12-20' &&
                 response.summary?.return_date === '2026-12-26';
        }
      }
    ]
  },

  {
    name: 'Weekend Getaway - Quick Jim Corbett Trip',
    chatId: 'e2e-weekend-corbett',
    description: 'Short weekend trip planning',
    steps: [
      {
        message: 'Quick weekend trip to Jim Corbett from Delhi',
        validate: (response) => {
          return (response.summary?.destination?.city?.toLowerCase().includes('corbett') ||
                 response.response.toLowerCase().includes('corbett')) &&
                 response.summary?.origin?.city === 'Delhi';
        }
      },
      {
        message: '2 nights (Friday to Sunday), 4 people, budget ₹40,000',
        validate: (response) => {
          return response.summary?.pax === 4 &&
                 response.summary?.budget?.amount === 40000;
        }
      },
      {
        message: 'This weekend - November 22-24, 2026. We want safari and nature walks',
        validate: (response) => {
          return response.summary?.outbound_date === '2026-11-22' &&
                 response.summary?.return_date === '2026-11-24';
        }
      }
    ]
  }
];

// Run a single test scenario
async function runScenario(scenario) {
  log(`\n${'='.repeat(80)}`, 'magenta');
  log(`TEST: ${scenario.name}`, 'bright');
  log(`Description: ${scenario.description}`, 'blue');
  log('='.repeat(80), 'magenta');

  // Clear chat before starting
  await clearChat(scenario.chatId);

  let allStepsPassed = true;
  const results = [];

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];

    log(`\n--- Step ${i + 1}/${scenario.steps.length} ---`, 'yellow');

    try {
      // Send message
      const response = await sendMessage(scenario.chatId, step.message);

      // Wait a bit for extraction to complete if needed
      await new Promise(resolve => setTimeout(resolve, 500));

      // Validate response
      const validationPassed = step.validate(response);

      if (validationPassed) {
        log(`✅ Step ${i + 1} validation PASSED`, 'green');
        results.push({ step: i + 1, passed: true });
      } else {
        log(`❌ Step ${i + 1} validation FAILED`, 'red');
        log(`Response data: ${JSON.stringify(response.summary, null, 2)}`, 'red');
        allStepsPassed = false;
        results.push({ step: i + 1, passed: false });
      }

      // Log extracted context
      if (response.summary) {
        log(`\n📊 Extracted Context:`, 'cyan');
        log(`  Origin: ${response.summary.origin?.city || 'Not set'}`, 'cyan');
        log(`  Destination: ${response.summary.destination?.city || 'Not set'}`, 'cyan');
        log(`  Dates: ${response.summary.outbound_date || 'Not set'} to ${response.summary.return_date || 'Not set'}`, 'cyan');
        log(`  Duration: ${response.summary.duration_days || 'Not set'} days`, 'cyan');
        log(`  Passengers: ${response.summary.pax || 'Not set'}`, 'cyan');
        log(`  Budget: ${response.summary.budget?.currency || ''} ${response.summary.budget?.amount || 'Not set'}${response.summary.budget?.per_person ? ' per person' : ' total'}`, 'cyan');
        log(`  Trip Types: ${response.summary.tripTypes?.join(', ') || 'None'}`, 'cyan');
        log(`  Places: ${response.summary.placesOfInterest?.length || 0} places`, 'cyan');
        log(`  Questions: ${response.summary.suggestedQuestions?.length || 0} questions`, 'cyan');
      }

      if (response.itinerary?.days) {
        log(`  Itinerary: ${response.itinerary.days.length} days planned`, 'cyan');
      }

    } catch (error) {
      log(`❌ Step ${i + 1} ERROR: ${error.message}`, 'red');
      console.error(error);
      allStepsPassed = false;
      results.push({ step: i + 1, passed: false, error: error.message });
    }

    // Wait between steps
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { passed: allStepsPassed, results };
}

// Run all scenarios
async function runAllScenarios() {
  log('\n' + '='.repeat(80), 'bright');
  log('END-TO-END TRIP PLANNER TEST SUITE', 'bright');
  log('='.repeat(80) + '\n', 'bright');

  const scenarioResults = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (let i = 0; i < TEST_SCENARIOS.length; i++) {
    const scenario = TEST_SCENARIOS[i];

    try {
      const result = await runScenario(scenario);
      scenarioResults.push({ name: scenario.name, ...result });

      if (result.passed) {
        totalPassed++;
      } else {
        totalFailed++;
      }
    } catch (error) {
      log(`\n❌ Scenario failed with error: ${error.message}`, 'red');
      console.error(error);
      totalFailed++;
      scenarioResults.push({ name: scenario.name, passed: false, error: error.message });
    }

    // Wait between scenarios
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Final summary
  log('\n\n' + '='.repeat(80), 'bright');
  log('TEST SUMMARY', 'bright');
  log('='.repeat(80), 'bright');

  scenarioResults.forEach((result, i) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const color = result.passed ? 'green' : 'red';
    log(`${status} - ${result.name}`, color);

    if (result.results) {
      result.results.forEach(stepResult => {
        const stepStatus = stepResult.passed ? '  ✓' : '  ✗';
        const stepColor = stepResult.passed ? 'green' : 'red';
        log(`${stepStatus} Step ${stepResult.step}${stepResult.error ? ': ' + stepResult.error : ''}`, stepColor);
      });
    }
  });

  log('\n' + '='.repeat(80), 'bright');
  log(`Total Scenarios: ${TEST_SCENARIOS.length} | Passed: ${totalPassed} | Failed: ${totalFailed}`, 'bright');
  log('='.repeat(80) + '\n', 'bright');

  if (totalFailed === 0) {
    log('🎉 ALL END-TO-END TESTS PASSED!', 'green');
  } else {
    log(`⚠️  ${totalFailed} SCENARIO(S) FAILED`, 'red');
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    // Try a simple POST request to verify server is responding
    const response = await fetch(`${API_BASE}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: 'health-check', message: 'test' })
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Main execution
(async () => {
  log('Checking if server is running...', 'yellow');

  const serverRunning = await checkServer();
  if (!serverRunning) {
    log('\n❌ Server is not running! Please start the server with: npm start', 'red');
    process.exit(1);
  }

  log('✅ Server is running\n', 'green');

  await runAllScenarios();
})();
