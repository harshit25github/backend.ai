import 'dotenv/config';
import { Agent, run, user, webSearchTool } from '@openai/agents';

/**
 * Minimal smoke test to prove the web_search tool is wired correctly.
 * Run with: `node test-web-search-tool.js`
 */
async function main() {
  const searchAgent = new Agent({
    name: 'Web Search Smoke Test',
    model: 'gpt-4.1',
    instructions:
      'You must call web_search to answer the user. Return a short summary with temperature, conditions, and a source link. Do not skip the tool.',
    tools: [webSearchTool()],
    modelSettings: {
      toolChoice: 'required'
    }
  });

  try {
    const result = await run(
      searchAgent,
      [
        user(
          'Planning a trip of 7 days consisting argentina vs spain world cup football match'
        )
      ],
      { context: {} }
    );

    console.log('\n=== web_search smoke test result ===');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('web_search smoke test failed:', error);
    process.exit(1);
  }
}

main();
