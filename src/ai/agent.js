import { Agent, run } from '@openai/agents';

export const chatAgent = new Agent({
  name: 'Chat Assistant',
  instructions: 'You are a helpful assistant that can engage in conversations and help users with various tasks. Be friendly, informative, and concise in your responses.',
  model: 'gpt-4o',
});

export const runChatAgent = async (message, context = {}) => {
  try {
    console.log('Running agent with message:', message);
    console.log('Context:', context);
    
    const result = await run(chatAgent, message, {
      ...context
    });
    
    console.log('Agent result:', result);
    console.log('Agent result.finalOutput:', result?.finalOutput);
    
    // Ensure we return a consistent structure
    return {
      finalOutput: result?.finalOutput || result?.content || result?.message || 'No response generated',
      rawResult: result
    };
  } catch (error) {
    console.error('Error running chat agent:', error);
    throw error;
  }
};

export const streamChatAgent = async function* (message, context = {}) {
  try {
    console.log('Streaming agent with message:', message);
    
    // Use proper OpenAI Agents SDK streaming
    const stream = await run(chatAgent, message, {
      ...context,
      stream: true
    });

    console.log('Stream object type:', stream.constructor.name);
    console.log('Stream has toTextStream:', typeof stream.toTextStream === 'function');
    
    // Method 1: Try iterating through stream events
    console.log('Using event iteration...');
    let hasYieldedContent = false;
    
    for await (const event of stream) {
      console.log('Stream event type:', event.type);
      console.log('Stream event data:', event.data);
      
      if (event.type === 'raw_model_stream_event' && event.data) {
        if (event.data.choices && event.data.choices[0] && event.data.choices[0].delta && event.data.choices[0].delta.content) {
          const content = event.data.choices[0].delta.content;
          console.log('Yielding content from raw_model_stream_event:', content);
          hasYieldedContent = true;
          yield content;
        }
      } else if (event.type === 'text_delta' && event.data) {
        console.log('Yielding content from text_delta:', event.data);
        hasYieldedContent = true;
        yield event.data;
      } else if (event.type === 'message_output_item' && event.data) {
        console.log('Yielding content from message_output_item:', event.data);
        hasYieldedContent = true;
        if (typeof event.data === 'string') {
          yield event.data;
        } else if (event.data.content) {
          yield event.data.content;
        }
      }
    }
    
    // Method 2: Wait for completion and get final output if no streaming worked
    if (!hasYieldedContent) {
      console.log('No streaming events yielded content, waiting for completion...');
      try {
        await stream.completed;
        console.log('Stream completed, checking for final output...');
        
        const finalOutput = stream.finalOutput || stream.result?.finalOutput;
        if (finalOutput) {
          console.log('Got final output after completion:', finalOutput);
          yield finalOutput;
        } else {
          console.log('No final output available');
          yield 'No response generated from stream';
        }
      } catch (completionError) {
        console.error('Error waiting for stream completion:', completionError);
        yield 'Error waiting for stream completion';
      }
    }
  } catch (error) {
    console.error('Error streaming chat agent:', error);
    throw error;
  }
};