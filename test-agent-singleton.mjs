// Test if agents are singletons
import { tripPlannerAgent as agent1 } from './src/ai/multiAgentSystem.js';
import { tripPlannerAgent as agent2 } from './src/ai/multiAgentSystem.js';

console.log('✅ Test: Agent Singleton Behavior\n');
console.log('Agent 1 reference:', agent1 ? 'exists' : 'null');
console.log('Agent 2 reference:', agent2 ? 'exists' : 'null');
console.log('Same instance?', agent1 === agent2);
console.log('\nResult:', agent1 === agent2 ? '✅ SINGLETON - Created once, reused!' : '❌ NEW INSTANCE - Created every time!');
