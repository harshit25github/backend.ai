import { run, user } from '@openai/agents';
import { gatewayAgent, loadContext, saveContext, ensureItinerarySavedIfMissing, maybeExtractItineraryFromText } from './multiAgentSystem.js';

// Streaming multi-agent system
export const runMultiAgentStreaming = async (message, chatId, conversationHistory = []) => {
  try {
    // Load existing context
    const context = await loadContext(chatId);
    const originalContext = {...context};
    console.log(`Loaded context for chat ${chatId}:`, context);

    // Prepare conversation input
    const input = [
      ...conversationHistory.filter(m => m.role === 'user').map(m => user(String(m.content ?? ''))),
      user(message)
    ];

    console.log('Running streaming multi-agent system with input:', input);

    // Run the gateway agent with streaming enabled
    const stream = await run(gatewayAgent, input, {
      context: context,
      stream: true
    });

    console.log('Multi-agent stream created');

    // Return the stream object and context for further processing
    return {
      stream,
      context: originalContext,
      chatId
    };

  } catch (error) {
    console.error('Error in streaming multi-agent system:', error);
    throw error;
  }
};

// Extract context from completed stream
export const extractContextFromStream = async (chatId, originalContext, userMessage, finalOutput) => {
  try {
    const updatedContext = originalContext;
    if (!updatedContext.trip) updatedContext.trip = {};
    if (!updatedContext.conversationState) updatedContext.conversationState = {};
    updatedContext.conversationState.lastIntent = extractIntent(userMessage);

    if (typeof finalOutput === 'string' && finalOutput.trim().length > 0) {
      await maybeExtractItineraryFromText(String(finalOutput), updatedContext);
    }

    // Append debug log entry and persist
    updatedContext.debugLog = updatedContext.debugLog || [];
    updatedContext.debugLog.push({
      timestamp: new Date().toISOString(),
      input: String(userMessage ?? ''),
      role: 'user',
      lastAgent: undefined,
      before: null,
      after: JSON.parse(JSON.stringify(updatedContext)),
      note: 'stream completion context snapshot'
    });
    await saveContext(chatId, updatedContext);

    console.log('Context updated and saved:', updatedContext);
    return updatedContext;

  } catch (error) {
    console.error('Error extracting context from stream:', error);
    return originalContext;
  }
};

const extractIntent = (message) => {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('book') || lowerMessage.includes('reserve') || lowerMessage.includes('flight') || lowerMessage.includes('hotel')) return 'booking';
  if (lowerMessage.includes('plan') || lowerMessage.includes('itinerary') || lowerMessage.includes('schedule')) return 'planning';
  if (lowerMessage.includes('where') || lowerMessage.includes('destination') || lowerMessage.includes('suggest')) return 'destination_search';
  if (lowerMessage.includes('budget') || lowerMessage.includes('cost') || lowerMessage.includes('price')) return 'budget_planning';
  return 'general';
};

export default {
  runMultiAgentStreaming,
  extractContextFromStream
};