import express from 'express';
import { enhancedManagerAgent, createEnhancedContext } from '../ai/enhanced-manager.js';
import { run, user } from '@openai/agents';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// In-memory storage for contexts (also saved to files)
const contexts = new Map();

// Data directory for persistent storage
const DATA_DIR = path.resolve('data');
const CONTEXTS_DIR = path.join(DATA_DIR, 'contexts');

// Ensure data directories exist
await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(CONTEXTS_DIR, { recursive: true });

// Generate contextual questions based on current trip state
function generateContextualQuestions(context, lastAgentName) {
  const summary = context.summary;
  const questions = [];

  // Base questions if no destination set
  if (!summary.destination?.city) {
    return [
      "What type of travel experience are you looking for?",
      "Do you prefer beach, mountain, city, or countryside destinations?",
      "Are you interested in cultural, adventure, or relaxation activities?",
      "What's your ideal trip duration?",
      "Any specific regions or countries you'd like to explore?"
    ];
  }

  // Destination-specific questions
  const destination = summary.destination.city;
  const hasItinerary = context.itinerary.days.length > 0;
  const hasCompleteTripDetails = summary.origin?.city && summary.pax && summary.budget?.amount;

  if (hasItinerary) {
    // Post-itinerary questions
    questions.push(
      `Best hotels or accommodations in ${destination}?`,
      `Transportation options within ${destination}?`,
      `What should I pack for this trip?`,
      `Local customs or etiquette tips for ${destination}?`,
      `Best times to visit attractions to avoid crowds?`
    );
  } else if (hasCompleteTripDetails) {
    // Pre-itinerary but complete trip details
    questions.push(
      `Must-see neighborhoods in ${destination}?`,
      `Best local food and restaurants in ${destination}?`,
      `Day trips or excursions from ${destination}?`,
      `Cultural events or festivals during my visit?`,
      `Budget tips for traveling in ${destination}?`
    );
  } else {
    // Destination known but missing details
    questions.push(
      `Best time to visit ${destination}?`,
      `How many days should I spend in ${destination}?`,
      `What's the typical budget needed for ${destination}?`,
      `Must-see attractions in ${destination}?`,
      `Getting around ${destination} - transport guide?`
    );
  }

  // Agent-specific questions
  if (lastAgentName?.includes('Itinerary')) {
    questions.push(`How to book activities mentioned in the itinerary?`);
  } else if (lastAgentName?.includes('Booking')) {
    questions.push(`What documents do I need for booking?`);
  }

  // Return 5 most relevant questions
  return questions.slice(0, 5);
}


// File operations for persistence
async function saveSessionToFile(sessionId, sessionData) {
  try {
    const sessionFile = path.join(DATA_DIR, `${sessionId}.json`);
    const contextFile = path.join(CONTEXTS_DIR, `${sessionId}_context.json`);

    // Save complete session data
    await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));

    // Save context separately for easy access
    await fs.writeFile(contextFile, JSON.stringify(sessionData.context, null, 2));

    console.log(`[STORAGE] Saved session: ${sessionId}`);
  } catch (error) {
    console.error(`[STORAGE] Error saving session ${sessionId}:`, error);
  }
}

async function loadSessionFromFile(sessionId) {
  try {
    const sessionFile = path.join(DATA_DIR, `${sessionId}.json`);
    const data = await fs.readFile(sessionFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null; // File doesn't exist or error reading
  }
}

// Helper to get or create context
async function getOrCreateContext(sessionId, userInfo = { name: 'User', uid: Date.now() }) {
  if (!contexts.has(sessionId)) {
    // Try to load from file first
    const savedSession = await loadSessionFromFile(sessionId);

    if (savedSession) {
      contexts.set(sessionId, savedSession);
      console.log(`[STORAGE] Loaded session from file: ${sessionId}`);
    } else {
      // Create new session
      const newSession = {
        context: createEnhancedContext(userInfo),
        history: []
      };
      contexts.set(sessionId, newSession);
      console.log(`[STORAGE] Created new session: ${sessionId}`);
    }
  }
  return contexts.get(sessionId);
}

// Enhanced Manager Chat Route
router.post('/enhanced-chat', async (req, res) => {
  try {
    const { message, sessionId = 'default', userInfo } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Message is required and must be a string'
      });
    }

    console.log('\n=== ENHANCED MANAGER CHAT ===');
    console.log('Session ID:', sessionId);
    console.log('Message:', message);
    console.log('User Info:', userInfo);

    // Get or create session context
    const session = await getOrCreateContext(sessionId, userInfo);
    const { context, history } = session;

    console.log('Context before:', JSON.stringify({
      summary: context.summary,
      itinerary_days: context.itinerary.days.length
    }, null, 2));

    // Run the enhanced manager agent
    const result = await run(
      enhancedManagerAgent,
      history.concat(user(message)),
      { context }
    );

    // Update session history
    session.history = result.history;

    console.log('Context after:', JSON.stringify({
      summary: context.summary,
      itinerary_days: context.itinerary.days.length,
      suggested_questions: context.summary.suggestedQuestions.length
    }, null, 2));

    // Prepare response
    const response = {
      message: Array.isArray(result.finalOutput)
        ? result.finalOutput.map(String).join('\n')
        : String(result.finalOutput ?? 'No response generated'),
      lastAgent: result.lastAgent?.name ?? 'Unknown Agent',
      sessionId: sessionId,
      context: {
        summary: context.summary,
        itinerary: context.itinerary,
        userInfo: context.userInfo
      }
    };

    console.log('Response:', JSON.stringify(response, null, 2));

    // Save session to file after each interaction
    await saveSessionToFile(sessionId, session);

    console.log('=== END ENHANCED MANAGER CHAT ===\n');

    res.json(response);

  } catch (error) {
    console.error('Enhanced manager chat error:', error);
    res.status(500).json({
      error: 'Failed to process enhanced manager chat',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get Context Route
router.get('/context/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Try to get from memory first, then load from file
    let session = contexts.get(sessionId);
    if (!session) {
      session = await loadSessionFromFile(sessionId);
      if (session) {
        contexts.set(sessionId, session);
      }
    }

    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    res.json({
      sessionId,
      context: {
        summary: session.context.summary,
        itinerary: session.context.itinerary,
        userInfo: session.context.userInfo
      },
      historyLength: session.history.length
    });

  } catch (error) {
    console.error('Get context error:', error);
    res.status(500).json({
      error: 'Failed to get context',
      details: error.message
    });
  }
});

// Reset Context Route
router.delete('/context/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userInfo } = req.body;

    if (contexts.has(sessionId)) {
      contexts.set(sessionId, {
        context: createEnhancedContext(userInfo || { name: 'User', uid: Date.now() }),
        history: []
      });
    }

    res.json({
      message: 'Context reset successfully',
      sessionId
    });

  } catch (error) {
    console.error('Reset context error:', error);
    res.status(500).json({
      error: 'Failed to reset context',
      details: error.message
    });
  }
});

// Update Summary Route
router.put('/context/:sessionId/summary', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { summary } = req.body;

    const session = contexts.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    // Deep merge the summary
    const currentSummary = session.context.summary;

    if (summary.origin) {
      Object.assign(currentSummary.origin, summary.origin);
    }
    if (summary.destination) {
      Object.assign(currentSummary.destination, summary.destination);
    }
    if (summary.budget) {
      Object.assign(currentSummary.budget, summary.budget);
    }

    // Update other fields
    Object.keys(summary).forEach(key => {
      if (key !== 'origin' && key !== 'destination' && key !== 'budget') {
        if (summary[key] !== undefined) {
          currentSummary[key] = summary[key];
        }
      }
    });

    res.json({
      message: 'Summary updated successfully',
      sessionId,
      summary: currentSummary
    });

  } catch (error) {
    console.error('Update summary error:', error);
    res.status(500).json({
      error: 'Failed to update summary',
      details: error.message
    });
  }
});

// Update Itinerary Route
router.put('/context/:sessionId/itinerary', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { itinerary } = req.body;

    const session = contexts.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    // Update itinerary
    if (itinerary.days) {
      session.context.itinerary.days = itinerary.days;
    }
    if (itinerary.computed) {
      Object.assign(session.context.itinerary.computed, itinerary.computed);
    }

    res.json({
      message: 'Itinerary updated successfully',
      sessionId,
      itinerary: session.context.itinerary
    });

  } catch (error) {
    console.error('Update itinerary error:', error);
    res.status(500).json({
      error: 'Failed to update itinerary',
      details: error.message
    });
  }
});

// List All Sessions Route
router.get('/sessions', (req, res) => {
  try {
    const sessions = Array.from(contexts.keys()).map(sessionId => {
      const session = contexts.get(sessionId);
      return {
        sessionId,
        userInfo: session.context.userInfo,
        historyLength: session.history.length,
        hasDestination: !!session.context.summary.destination.city,
        hasDates: !!(session.context.summary.outbound_date && session.context.summary.return_date),
        itineraryDays: session.context.itinerary.days.length,
        lastActivity: new Date().toISOString() // In production, track this properly
      };
    });

    res.json({ sessions });

  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({
      error: 'Failed to list sessions',
      details: error.message
    });
  }
});

// Health Check Route
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeSessions: contexts.size,
    version: '1.0.0'
  });
});

export default router;