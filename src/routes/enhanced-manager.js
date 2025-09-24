import express from 'express';
import { enhancedManagerAgent, createEnhancedContext } from '../ai/enhanced-manager.js';
import { run, user } from '@openai/agents';

const router = express.Router();

// In-memory storage for contexts (in production, use a database)
const contexts = new Map();

// Helper to get or create context
function getOrCreateContext(sessionId, userInfo = { name: 'User', uid: Date.now() }) {
  if (!contexts.has(sessionId)) {
    contexts.set(sessionId, {
      context: createEnhancedContext(userInfo),
      history: []
    });
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
    const session = getOrCreateContext(sessionId, userInfo);
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
      itinerary_days: context.itinerary.days.length
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
router.get('/context/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = contexts.get(sessionId);

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