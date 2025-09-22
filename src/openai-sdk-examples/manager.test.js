import { managerAgent } from './manager.js';
import { run, user } from '@openai/agents';

async function main() {
  const ctx = { userInfo: { name: 'Harsh', uid: 1 }, trip: {}, logger: console };
  let thread = [];

  async function step(q) {
    const res = await run(managerAgent, thread.concat(user(q)), { context: ctx });
    thread = res.history;
    console.log('\nQ>', q);
    console.log('[last]', res.lastAgent?.name || '');
    const out = Array.isArray(res.finalOutput) ? res.finalOutput.map(String).join('\n') : String(res.finalOutput ?? '');
    console.log('[out]', out);
  }

  await step('Where should I go in November for beaches on a mid budget?');
  await step('Origin: Delhi, two adults');
  await step("Let's pick Phuket");
  await step('Plan 4 days starting Nov 10');
  await step('Book a 3-night hotel near Patong, mid-range');

  console.log('\nctx.trip', JSON.stringify(ctx.trip, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });


