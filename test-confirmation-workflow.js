const API_URL = 'http://localhost:3000/api/enhanced-manager/enhanced-chat';
const TEST_SESSION = `test-confirmation-${Date.now()}`;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(color, label, message) {
  console.log(`${color}${colors.bright}[${label}]${colors.reset} ${message}\n`);
}

async function sendMessage(message, turnNumber) {
  log(colors.blue, `TURN ${turnNumber}`, `User: "${message}"`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        sessionId: TEST_SESSION,
        userInfo: { name: 'TestUser', uid: 'test-user-123' }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const agentResponse = data.content || data.response || data.message || 'No response';
    log(colors.green, `TURN ${turnNumber}`, `Agent response received (${agentResponse.length} chars)`);

    // Show first 500 chars of response
    const preview = agentResponse.substring(0, 500);
    console.log(colors.cyan + preview + colors.reset);
    if (agentResponse.length > 500) {
      console.log(colors.yellow + `... (${agentResponse.length - 500} more characters)` + colors.reset);
    }
    console.log('\n' + '='.repeat(80) + '\n');

    // Check for key indicators
    const hasDestinations = /##\s+[A-Z][a-z]+.*?(🌍|🏖️|🇲🇽|🇵🇹|🏛️|🏝️)/m.test(agentResponse);
    const hasConfirmationRequest = /Would you like|Want me to|Shall I|Ready to see|Can I show you|Should I suggest/i.test(agentResponse);
    const hasSummary = /Your Trip Requirements|Trip Details|Here'?s what (I have|we have)|Perfect! I have all/i.test(agentResponse);

    log(colors.yellow, 'ANALYSIS',
      `Has destinations: ${hasDestinations}\n` +
      `  Has confirmation request: ${hasConfirmationRequest}\n` +
      `  Has summary: ${hasSummary}`
    );

    return {
      response: agentResponse,
      hasDestinations,
      hasConfirmationRequest,
      hasSummary
    };
  } catch (error) {
    log(colors.red, 'ERROR', `${error.message}`);
    throw error;
  }
}

async function runTest() {
  console.log(colors.bright + colors.cyan);
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║       TESTING CONFIRMATION WORKFLOW                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(colors.reset + '\n');

  try {
    // Turn 1: Provide all slots at once
    log(colors.yellow, 'TEST', 'Turn 1: Providing all slots at once');
    const turn1 = await sendMessage(
      "I want to travel from Mumbai, budget is ₹60000 per person, 5 days, 2 people, we love beaches and adventure",
      1
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify Turn 1 expectations
    if (!turn1.hasSummary || !turn1.hasConfirmationRequest) {
      log(colors.red, 'FAIL', 'Turn 1 should ask for confirmation with summary');
    } else if (turn1.hasDestinations) {
      log(colors.red, 'FAIL', 'Turn 1 should NOT show destinations yet');
    } else {
      log(colors.green, 'PASS', 'Turn 1 correctly asks for confirmation');
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // Turn 2: User confirms
    log(colors.yellow, 'TEST', 'Turn 2: User confirms with "Yes, show me the destinations"');
    const turn2 = await sendMessage(
      "Yes, show me the destinations",
      2
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify Turn 2 expectations
    if (turn2.hasDestinations) {
      log(colors.green, 'PASS', 'Turn 2 correctly shows destinations!');
    } else if (turn2.hasConfirmationRequest) {
      log(colors.red, 'FAIL', 'Turn 2 is asking for confirmation AGAIN (loop detected)');
    } else {
      log(colors.red, 'FAIL', 'Turn 2 does not show destinations');
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // Turn 3: Try different confirmation phrase
    log(colors.yellow, 'TEST', 'Turn 3: Try another confirmation phrase "Sure, go ahead"');
    const turn3 = await sendMessage(
      "Sure, go ahead",
      3
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    if (turn3.hasDestinations) {
      log(colors.green, 'PASS', 'Turn 3 shows destinations with different phrase!');
    } else {
      log(colors.red, 'FAIL', 'Turn 3 does not recognize "Sure, go ahead" as confirmation');
    }

    console.log(colors.bright + colors.cyan);
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║       TEST COMPLETED                                          ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(colors.reset);

  } catch (error) {
    log(colors.red, 'FATAL', `Test failed: ${error.message}`);
    process.exit(1);
  }
}

// Run test
runTest().catch(console.error);
