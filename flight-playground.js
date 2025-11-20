import 'dotenv/config';
import { runMultiAgentSystem } from './src/ai/multiAgentSystem.js';
import readline from 'readline';
import fs from 'fs';

const chatId = 'flight-playground-session';
const conversationHistory = [];

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

function printHeader() {
  console.log('\n' + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.bright + colors.cyan + '✈️  FLIGHT AGENT PLAYGROUND' + colors.reset);
  console.log(colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.dim + 'Interactive testing environment for Flight Specialist Agent' + colors.reset);
  console.log(colors.dim + 'Chat ID: ' + colors.yellow + chatId + colors.reset);
  console.log(colors.cyan + '='.repeat(80) + colors.reset + '\n');
}

function printCommands() {
  console.log(colors.yellow + '📋 Available Commands:' + colors.reset);
  console.log(colors.dim + '  /context  - Show current context state' + colors.reset);
  console.log(colors.dim + '  /history  - Show conversation history' + colors.reset);
  console.log(colors.dim + '  /save     - Save conversation history to file' + colors.reset);
  console.log(colors.dim + '  /clear    - Clear context and start fresh' + colors.reset);
  console.log(colors.dim + '  /exit     - Exit playground' + colors.reset);
  console.log(colors.dim + '  /help     - Show this help message' + colors.reset);
  console.log();
}

function formatContext(context) {
  if (!context) return 'No context available';

  const pax = context.summary?.pax;
  let paxStr = 'Not set';

  if (typeof pax === 'object' && pax !== null) {
    const parts = [];
    if (pax.adults) parts.push(`${pax.adults} adults`);
    if (pax.seniors) parts.push(`${pax.seniors} seniors`);
    if (pax.children) parts.push(`${pax.children} children (ages: ${pax.childrenAges?.join(', ') || 'N/A'})`);
    if (pax.seatInfants) parts.push(`${pax.seatInfants} seat infants`);
    if (pax.lapInfants) parts.push(`${pax.lapInfants} lap infants`);
    paxStr = parts.length > 0 ? parts.join(', ') : 'None';
  } else if (typeof pax === 'number') {
    paxStr = `${pax} (legacy format)`;
  }

  return `
${colors.bright}📊 Context Summary:${colors.reset}
${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}

${colors.green}Route:${colors.reset}
  Origin:      ${context.summary?.origin?.city || 'Not set'} ${context.summary?.origin?.iata ? `(${context.summary.origin.iata})` : ''}
  Destination: ${context.summary?.destination?.city || 'Not set'} ${context.summary?.destination?.iata ? `(${context.summary.destination.iata})` : ''}

${colors.green}Dates:${colors.reset}
  Outbound: ${context.summary?.outbound_date || 'Not set'}
  Return:   ${context.summary?.return_date || 'Not set'}

${colors.green}Passengers:${colors.reset}
  ${paxStr}

${colors.green}Flight Details:${colors.reset}
  Trip Type:          ${context.flight?.tripType || 'Not set'}
  Cabin Class:        ${context.flight?.cabinClass || 'Not set'}
  Direct Flights Only: ${context.flight?.directFlightOnly ? 'Yes' : 'No'}
  Preferred Airlines: ${context.flight?.preferredAirlines?.join(', ') || 'Any'}

${colors.green}Search Results:${colors.reset}
  Results Found:   ${context.flight?.searchResults?.length || 0}
  Booking Status:  ${context.flight?.bookingStatus || 'Not started'}

${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
`;
}

function showContext() {
  const contextPath = `data/agent-context-${chatId}.json`;
  if (fs.existsSync(contextPath)) {
    const context = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));
    console.log(formatContext(context));
  } else {
    console.log(colors.yellow + '⚠️  No context file found. Start a conversation first.' + colors.reset);
  }
}

function showHistory() {
  if (conversationHistory.length === 0) {
    console.log(colors.yellow + '⚠️  No conversation history yet.' + colors.reset);
    return;
  }

  console.log('\n' + colors.bright + '💬 Conversation History:' + colors.reset);
  console.log(colors.blue + '━'.repeat(80) + colors.reset);

  conversationHistory.forEach((msg, idx) => {
    const role = msg.role === 'user' ? colors.cyan + '👤 User' : colors.green + '🤖 Agent';
    console.log(`\n${role}${colors.reset} (Turn ${Math.floor(idx / 2) + 1}):`);
    console.log(colors.dim + msg.content + colors.reset);
  });

  console.log('\n' + colors.blue + '━'.repeat(80) + colors.reset);
}

function saveHistory() {
  if (conversationHistory.length === 0) {
    console.log(colors.yellow + '⚠️  No conversation history to save.' + colors.reset);
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `data/conversation-logs/playground-${timestamp}.json`;

  // Ensure directory exists
  if (!fs.existsSync('data/conversation-logs')) {
    fs.mkdirSync('data/conversation-logs', { recursive: true });
  }

  const historyData = {
    chatId,
    timestamp: new Date().toISOString(),
    totalTurns: Math.floor(conversationHistory.length / 2),
    conversationHistory
  };

  fs.writeFileSync(filename, JSON.stringify(historyData, null, 2));
  console.log(colors.green + `✅ Conversation history saved to: ${filename}` + colors.reset);
}

function clearContext() {
  const contextPath = `data/agent-context-${chatId}.json`;
  if (fs.existsSync(contextPath)) {
    fs.unlinkSync(contextPath);
  }
  conversationHistory.length = 0;
  console.log(colors.green + '✅ Context cleared and conversation reset!' + colors.reset);
}

async function processUserInput(userInput) {
  // Handle commands
  if (userInput.startsWith('/')) {
    const command = userInput.toLowerCase().trim();

    switch (command) {
      case '/context':
        showContext();
        return;
      case '/history':
        showHistory();
        return;
      case '/save':
        saveHistory();
        return;
      case '/clear':
        clearContext();
        return;
      case '/help':
        printCommands();
        return;
      case '/exit':
        console.log(colors.green + '\n👋 Goodbye! Happy flying!' + colors.reset);
        process.exit(0);
      default:
        console.log(colors.red + `❌ Unknown command: ${command}` + colors.reset);
        printCommands();
        return;
    }
  }

  // Process as flight search query
  const turnNumber = Math.floor(conversationHistory.length / 2) + 1;
  console.log(`\n${colors.magenta}${'━'.repeat(80)}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}🔹 TURN ${turnNumber}${colors.reset}`);
  console.log(`${colors.magenta}${'━'.repeat(80)}${colors.reset}\n`);

  const startTime = Date.now();

  try {
    // Add user message to history
    conversationHistory.push({ role: 'user', content: userInput });

    // Run the agent
    const result = await runMultiAgentSystem(
      userInput,
      chatId,
      conversationHistory,
      false // streaming disabled for terminal
    );

    const duration = Date.now() - startTime;
    const output = Array.isArray(result.finalOutput)
      ? result.finalOutput.map(String).join('\n')
      : String(result.finalOutput ?? '');

    // Add assistant response to history
    conversationHistory.push({ role: 'assistant', content: output });

    // Display results
    console.log(`${colors.dim}⏱️  Response Time: ${(duration / 1000).toFixed(2)}s${colors.reset}`);
    console.log(`${colors.dim}👤 Agent: ${result.lastAgent}${colors.reset}\n`);

    console.log(`${colors.green}${'─'.repeat(80)}${colors.reset}`);
    console.log(`${colors.bright}🤖 Agent Response:${colors.reset}`);
    console.log(`${colors.green}${'─'.repeat(80)}${colors.reset}`);
    console.log(output);
    console.log(`${colors.green}${'─'.repeat(80)}${colors.reset}\n`);

  } catch (error) {
    console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    console.error(colors.dim + error.stack + colors.reset);
  }
}

// Main interactive loop
async function startPlayground() {
  printHeader();
  printCommands();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colors.cyan + '✈️  You: ' + colors.reset
  });

  console.log(colors.dim + 'Type your flight search query or use /help for commands\n' + colors.reset);
  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (input) {
      await processUserInput(input);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(colors.green + '\n👋 Goodbye! Happy flying!' + colors.reset);
    process.exit(0);
  });
}

// Start the playground
startPlayground().catch(error => {
  console.error(colors.red + '❌ Fatal error:' + colors.reset, error);
  process.exit(1);
});
