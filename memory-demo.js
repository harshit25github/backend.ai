import { Agent, OpenAIConversationsSession, run } from '@openai/agents';
import 'dotenv/config';

// Step 1: Create the agent with instructions (you can adjust as needed)
const agent = new Agent({
  name: 'MyConversationAgent',
  instructions: 'Answer user questions based on the chat history.'
});

// Step 2: Start a new conversation session (or provide an existing conversationId)
const session = new OpenAIConversationsSession(); // This starts a new conversation

// Step 3: Send the first message and get a response
const firstResponse = await run(agent, 'Hey, what city is the Eiffel Tower in?', { session });
console.log(firstResponse.finalOutput); // Should say "Paris"

// Step 4: Send a second message in the same session
const secondResponse = await run(agent, 'What country is that in?', { session });
console.log(secondResponse.finalOutput); // Should say "France"

// Step 5: You can log the session ID if you want to store or resume it later
console.log(`Conversation ID: ${session.conversationId}`);

// Optional: If you want to see the stored messages, you can retrieve them
const history = await session.getItems();
console.log('Conversation History:', history);

// Now the conversation history is stored on the OpenAI platform under that conversation ID, and you can continue it anytime by using the same ID.
