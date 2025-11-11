/**
 * COMPREHENSIVE STRESS TEST: Trip Planner Agent Personality & UX Evaluation
 *
 * Tests:
 * 1. Mandatory field collection (budget included)
 * 2. Smart question templates
 * 3. Agent personality & engagement
 * 4. Repetitive question handling
 * 5. Emoji usage appropriateness
 * 6. Response quality & helpfulness
 */

const API_BASE = 'http://localhost:3000/api/chat';

// Color codes for terminal output
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

// Test scenarios
const scenarios = [
  {
    name: "Scenario 1: Vague Initial Request (Missing All Mandatory Fields)",
    chatId: `stress-s1-${Date.now()}`,
    conversation: [
      {
        user: "I want to go on vacation",
        expect: {
          shouldAskFor: ["origin", "destination", "duration", "pax", "budget"],
          shouldProvideContext: true,
          shouldGroupQuestions: true
        }
      }
    ]
  },
  {
    name: "Scenario 2: Partial Info (Missing Budget)",
    chatId: `stress-s2-${Date.now()}`,
    conversation: [
      {
        user: "Plan a 5-day trip to Bali from Mumbai for 2 people",
        expect: {
          shouldAskFor: ["budget", "dates"],
          shouldProvideBudgetRanges: true,
          shouldMentionDestination: true
        }
      }
    ]
  },
  {
    name: "Scenario 3: User Ignores Budget Question",
    chatId: `stress-s3-${Date.now()}`,
    conversation: [
      {
        user: "Plan a trip to Paris",
        expect: { shouldAskFor: ["origin", "duration", "pax", "budget", "dates"] }
      },
      {
        user: "From Delhi, 5 days, 2 people",
        expect: { shouldAskFor: ["budget", "dates"], shouldProvideBudgetRanges: true }
      },
      {
        user: "Just plan it",
        expect: {
          shouldRemindAboutBudget: true,
          shouldProvideMoreContext: true,
          shouldNotCreateItinerary: true
        }
      }
    ]
  },
  {
    name: "Scenario 4: Budget First, Then Other Fields",
    chatId: `stress-s4-${Date.now()}`,
    conversation: [
      {
        user: "I have 80k budget for Goa",
        expect: {
          shouldAskFor: ["origin", "duration", "pax", "dates"],
          shouldAcknowledgeBudget: true
        }
      }
    ]
  },
  {
    name: "Scenario 5: Complete Information Upfront",
    chatId: `stress-s5-${Date.now()}`,
    conversation: [
      {
        user: "Plan a 4-day Maldives trip from Bangalore for 2 people in December, budget 2L per person",
        expect: {
          shouldConfirm: true,
          shouldListAllFields: true,
          shouldAskPermission: true
        }
      },
      {
        user: "Yes, create it",
        expect: {
          shouldCreateItinerary: true,
          shouldHaveDayByDay: true
        }
      }
    ]
  },
  {
    name: "Scenario 6: Unrealistic Budget",
    chatId: `stress-s6-${Date.now()}`,
    conversation: [
      {
        user: "Plan Europe trip",
        expect: { shouldAskMultipleFields: true }
      },
      {
        user: "From Mumbai, 10 days, 2 people, budget 50k total",
        expect: {
          shouldMentionBudgetConcern: true,
          shouldProvideRealisticExpectations: true
        }
      }
    ]
  },
  {
    name: "Scenario 7: Luxury Budget",
    chatId: `stress-s7-${Date.now()}`,
    conversation: [
      {
        user: "Honeymoon in Maldives",
        expect: { shouldAskFields: true }
      },
      {
        user: "From Delhi, 7 days, 2 people, budget 5L per person",
        expect: {
          shouldRecognizeLuxury: true,
          shouldSuggestPremiumOptions: true
        }
      }
    ]
  },
  {
    name: "Scenario 8: Budget Traveler",
    chatId: `stress-s8-${Date.now()}`,
    conversation: [
      {
        user: "Backpacking Southeast Asia",
        expect: { shouldAskFields: true }
      },
      {
        user: "From Bangalore, 15 days solo, super budget conscious - 60k total",
        expect: {
          shouldRecognizeBudgetTravel: true,
          shouldSuggestBudgetOptions: true
        }
      }
    ]
  }
];

// Evaluation criteria
function evaluateResponse(response, expectations, scenarioContext) {
  const evaluation = {
    score: 0,
    maxScore: 100,
    feedback: [],
    personalityScore: 0,
    helpfulnessScore: 0,
    emojiScore: 0
  };

  const text = response.toLowerCase();
  const originalText = response;

  // 1. Mandatory Field Collection (30 points)
  if (expectations.shouldAskFor) {
    const fieldsAsked = expectations.shouldAskFor.filter(field => {
      if (field === "origin") return /where.*from|which city.*from|traveling from/i.test(originalText);
      if (field === "destination") return /where.*going|which.*destination/i.test(originalText);
      if (field === "duration") return /how many days|duration|how long/i.test(originalText);
      if (field === "pax") return /how many (people|travelers|persons)|number of travelers/i.test(originalText);
      if (field === "budget") return /budget|per person|how much.*spend/i.test(originalText);
      if (field === "dates") return /when.*travel|which.*dates|travel dates/i.test(originalText);
      return false;
    });

    const askedRatio = fieldsAsked.length / expectations.shouldAskFor.length;
    const fieldScore = Math.round(askedRatio * 30);
    evaluation.score += fieldScore;
    evaluation.feedback.push(`✓ Asked for ${fieldsAsked.length}/${expectations.shouldAskFor.length} missing fields (+${fieldScore}/30)`);
  }

  // 2. Context & Ranges Provided (20 points)
  let contextScore = 0;

  if (expectations.shouldProvideBudgetRanges || expectations.shouldAskFor?.includes("budget")) {
    // Check if budget ranges are provided
    const hasBudgetRanges = /₹\d+[-k]|budget.*friendly|comfortable|premium|luxury/i.test(originalText);
    if (hasBudgetRanges) {
      contextScore += 10;
      evaluation.feedback.push("✓ Provided budget ranges/context (+10)");
    } else {
      evaluation.feedback.push("✗ Missing budget ranges (-10)");
    }
  }

  if (expectations.shouldProvideContext) {
    // Check if questions have helpful context (parentheses, examples, explanations)
    const hasContext = /\(.*\)|\d+-\d+ days|weekend|relaxed|highlights/i.test(originalText);
    if (hasContext) {
      contextScore += 10;
      evaluation.feedback.push("✓ Questions include helpful context (+10)");
    } else {
      evaluation.feedback.push("✗ Bare questions without context (-10)");
    }
  }

  evaluation.score += contextScore;

  // 3. Personality & Engagement (20 points)
  let personalityScore = 0;

  // Enthusiastic but not over-the-top
  const hasEnthusiasm = /exciting|great|perfect|love to help|wonderful/i.test(originalText);
  const tooManyExclamations = (originalText.match(/!/g) || []).length > 4;

  if (hasEnthusiasm && !tooManyExclamations) {
    personalityScore += 7;
    evaluation.feedback.push("✓ Appropriate enthusiasm (+7)");
  } else if (tooManyExclamations) {
    evaluation.feedback.push("✗ Too many exclamation marks - overly enthusiastic (-5)");
    personalityScore -= 5;
  }

  // Helpful, not robotic
  const isConversational = /let me|i'll|i can|how about|would you/i.test(originalText);
  if (isConversational) {
    personalityScore += 7;
    evaluation.feedback.push("✓ Conversational tone (+7)");
  }

  // Educational (provides insights)
  const isEducational = /best time|this helps|typically|affects|consider/i.test(originalText);
  if (isEducational) {
    personalityScore += 6;
    evaluation.feedback.push("✓ Educational/helpful insights (+6)");
  }

  evaluation.personalityScore = Math.max(0, personalityScore);
  evaluation.score += evaluation.personalityScore;

  // 4. Emoji Usage (10 points)
  const emojiCount = (originalText.match(/[\u{1F300}-\u{1F9FF}]|📍|📅|👥|💰|✈️|🏖️|🍽️/gu) || []).length;
  let emojiScore = 0;

  if (emojiCount === 0) {
    evaluation.feedback.push("○ No emojis used (neutral)");
    emojiScore = 5; // Neutral
  } else if (emojiCount >= 1 && emojiCount <= 5) {
    evaluation.feedback.push(`✓ Good emoji usage (${emojiCount}) - enhances readability (+10)`);
    emojiScore = 10;
  } else {
    evaluation.feedback.push(`! Too many emojis (${emojiCount}) - may feel unprofessional (-5)`);
    emojiScore = -5;
  }

  evaluation.emojiScore = emojiScore;
  evaluation.score += Math.max(0, emojiScore);

  // 5. Response Structure (10 points)
  const hasStructure = /\n-|\n•|\*\*|###?/i.test(originalText);
  if (hasStructure) {
    evaluation.score += 10;
    evaluation.feedback.push("✓ Well-structured with markdown/bullets (+10)");
  } else {
    evaluation.feedback.push("✗ Wall of text - needs structure (-10)");
  }

  // 6. Specific Expectations (10 points)
  if (expectations.shouldConfirm) {
    const hasConfirmation = /confirm|let me confirm|here.*details/i.test(originalText);
    if (hasConfirmation) {
      evaluation.score += 10;
      evaluation.feedback.push("✓ Properly confirmed details (+10)");
    }
  }

  if (expectations.shouldNotCreateItinerary) {
    const createdItinerary = /day 1|day 2|morning:|afternoon:/i.test(originalText);
    if (!createdItinerary) {
      evaluation.score += 10;
      evaluation.feedback.push("✓ Correctly didn't create itinerary without budget (+10)");
    } else {
      evaluation.feedback.push("✗ Created itinerary without mandatory field (-10)");
    }
  }

  // 7. Length Check (10 points)
  const wordCount = originalText.split(/\s+/).length;
  if (wordCount >= 30 && wordCount <= 200) {
    evaluation.score += 10;
    evaluation.feedback.push(`✓ Good length (${wordCount} words) (+10)`);
  } else if (wordCount < 30) {
    evaluation.feedback.push(`✗ Too brief (${wordCount} words) - needs more context (-5)`);
    evaluation.score += 5;
  } else {
    evaluation.feedback.push(`! Verbose (${wordCount} words) - could be more concise`);
    evaluation.score += 7;
  }

  // Calculate helpfulness score
  evaluation.helpfulnessScore = Math.min(100, evaluation.score);

  // Overall grade
  const finalScore = Math.min(100, evaluation.score);
  if (finalScore >= 90) evaluation.grade = 'A+';
  else if (finalScore >= 80) evaluation.grade = 'A';
  else if (finalScore >= 70) evaluation.grade = 'B';
  else if (finalScore >= 60) evaluation.grade = 'C';
  else evaluation.grade = 'F';

  return evaluation;
}

// Run single scenario
async function runScenario(scenario) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${colors.bright}${colors.cyan}${scenario.name}${colors.reset}`);
  console.log(`${'='.repeat(80)}\n`);

  const results = [];

  for (let i = 0; i < scenario.conversation.length; i++) {
    const turn = scenario.conversation[i];
    console.log(`${colors.yellow}[Turn ${i + 1}] User:${colors.reset} ${turn.user}\n`);

    try {
      const response = await fetch(`${API_BASE}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: scenario.chatId,
          message: turn.user
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const agentResponse = data.response || data.content || '';

      console.log(`${colors.blue}[Turn ${i + 1}] Agent:${colors.reset}`);
      console.log(agentResponse);
      console.log();

      // Evaluate response
      const evaluation = evaluateResponse(agentResponse, turn.expect, scenario);

      console.log(`${colors.magenta}[Evaluation]${colors.reset}`);
      console.log(`Score: ${evaluation.score}/100 (Grade: ${evaluation.grade})`);
      console.log(`Personality: ${evaluation.personalityScore}/20`);
      console.log(`Emoji Usage: ${evaluation.emojiScore}/10`);
      console.log(`\nFeedback:`);
      evaluation.feedback.forEach(fb => console.log(`  ${fb}`));
      console.log();

      results.push({
        turn: i + 1,
        user: turn.user,
        agent: agentResponse,
        evaluation
      });

      // Small delay between turns
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`${colors.red}Error:${colors.reset}`, error.message);
      results.push({
        turn: i + 1,
        error: error.message
      });
    }
  }

  return results;
}

// Main stress test execution
async function runStressTest() {
  console.log(`${colors.bright}${colors.green}`);
  console.log(`╔${'═'.repeat(78)}╗`);
  console.log(`║${' '.repeat(15)}TRIP PLANNER AGENT: STRESS TEST & UX EVALUATION${' '.repeat(15)}║`);
  console.log(`╚${'═'.repeat(78)}╝`);
  console.log(colors.reset);

  const allResults = [];

  for (const scenario of scenarios) {
    const results = await runScenario(scenario);
    allResults.push({
      scenario: scenario.name,
      results
    });
  }

  // Final Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${colors.bright}${colors.green}FINAL SUMMARY${colors.reset}`);
  console.log(`${'='.repeat(80)}\n`);

  let totalScore = 0;
  let totalTests = 0;
  let totalPersonality = 0;
  let totalEmoji = 0;

  allResults.forEach(scenarioResult => {
    console.log(`${colors.cyan}${scenarioResult.scenario}${colors.reset}`);
    scenarioResult.results.forEach(turn => {
      if (turn.evaluation) {
        console.log(`  Turn ${turn.turn}: ${turn.evaluation.grade} (${turn.evaluation.score}/100)`);
        totalScore += turn.evaluation.score;
        totalPersonality += turn.evaluation.personalityScore;
        totalEmoji += turn.evaluation.emojiScore;
        totalTests++;
      }
    });
    console.log();
  });

  const avgScore = Math.round(totalScore / totalTests);
  const avgPersonality = Math.round(totalPersonality / totalTests);
  const avgEmoji = Math.round(totalEmoji / totalTests);

  console.log(`${colors.bright}Overall Statistics:${colors.reset}`);
  console.log(`Average Score: ${avgScore}/100`);
  console.log(`Average Personality: ${avgPersonality}/20`);
  console.log(`Average Emoji Score: ${avgEmoji}/10`);
  console.log(`Total Scenarios: ${scenarios.length}`);
  console.log(`Total Turns: ${totalTests}`);

  console.log(`\n${colors.bright}SUBJECTIVE FEEDBACK:${colors.reset}`);
  console.log(`
1. ${colors.green}INTERACTION QUALITY:${colors.reset}
   - Is the agent interesting to interact with? (Engaging/Boring/Robotic)
   - Does it feel like talking to a consultant or filling a form?

2. ${colors.yellow}EMOJI USAGE:${colors.reset}
   - Are emojis enhancing readability or distracting?
   - Appropriate for professional travel agent or too casual?

3. ${colors.blue}HELPFULNESS:${colors.reset}
   - Do budget ranges actually help users decide?
   - Is context provided valuable or overwhelming?

4. ${colors.magenta}IMPROVEMENTS NEEDED:${colors.reset}
   - What makes responses feel repetitive?
   - How to balance information gathering vs. being annoying?
  `);
}

// Check server health
async function checkServer() {
  try {
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

// Run
(async () => {
  console.log('Checking server...');
  const serverReady = await checkServer();

  if (!serverReady) {
    console.error(`${colors.red}Server is not running on ${API_BASE}${colors.reset}`);
    console.log('Please start the server with: npm start');
    process.exit(1);
  }

  console.log(`${colors.green}✓ Server is ready${colors.reset}\n`);
  await runStressTest();
})();
