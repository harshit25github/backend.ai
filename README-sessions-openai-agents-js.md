# Sessions (OpenAI Agents SDK — JavaScript/TypeScript)

This README is a **faithful, section-by-section rewrite** of the *Sessions* guide from the OpenAI Agents SDK docs. It keeps the same ideas and coverage, but is **paraphrased** (not copied verbatim).

---

## Table of contents

- [Overview](#overview)
- [Quick start](#quick-start)
- [How the runner uses sessions](#how-the-runner-uses-sessions)
- [Inspecting and editing history](#inspecting-and-editing-history)
- [Bring your own storage](#bring-your-own-storage)
- [Control how history and new items merge](#control-how-history-and-new-items-merge)
- [Handling approvals and resumable runs](#handling-approvals-and-resumable-runs)
- [Compact OpenAI Responses history automatically](#compact-openai-responses-history-automatically)

---

## Overview

**Sessions** add a persistent “memory layer” to the Agents SDK. If you pass any object that implements the `Session` interface to `Runner.run(...)` (or to the convenience `run(...)` helper), the SDK takes care of chat history for you.

When a session is provided, the runner will automatically:

1. Load previously stored conversation items and **prepend** them to the next turn.
2. Persist the **new user input** and **assistant/model output** when a run finishes.
3. Keep the session usable across future turns — including when you resume from an interrupted `RunState`.

This means you typically **don’t need** to manually:
- call `toInputList()`, or
- stitch history together between turns.

### Built-in session implementations

The TypeScript SDK ships with two session implementations:

- `OpenAIConversationsSession` — stores/loads history via the **Conversations API**
- `MemorySession` — an in-memory implementation, mainly for **local development**

Because both implement the same `Session` interface, you can swap them (or your own custom session) without changing your agent code.

There are also sample session backends under `examples/memory/` (e.g., Prisma, file-backed, and others) as references for building your own storage layer.

### Using Responses models: automatic transcript shrinking

If you’re using an OpenAI **Responses** model and you want stored history to stay small, you can wrap a session with:

- `OpenAIResponsesCompactionSession`

This uses `responses.compact` to shrink stored transcripts automatically (details later in this README).

> Tip: If you want to run the examples that use `OpenAIConversationsSession`, ensure `OPENAI_API_KEY` is set, or provide an `apiKey` when creating the session. The SDK needs to call the Conversations API.

---

## Quick start

Use `OpenAIConversationsSession` if you want session memory synced to the Conversations API. Otherwise, pass any other `Session` implementation.

Example: reuse the same session across turns so each new run sees all prior context and automatically persists the new turn.

```ts
import { Agent, OpenAIConversationsSession, run } from "@openai/agents";

const agent = new Agent({
  name: "TourGuide",
  instructions: "Answer with compact travel facts.",
});

const session = new OpenAIConversationsSession();

const first = await run(agent, "What city is the Golden Gate Bridge in?", { session });
console.log(first.finalOutput);

const second = await run(agent, "What state is it in?", { session });
console.log(second.finalOutput);
```

Key idea: **keeping the same `session` instance** ensures:
- history is loaded before each turn, and
- new items are saved after each turn.

Switching to a different `Session` implementation shouldn’t require other code changes.

---

## How the runner uses sessions

At a high level, the runner does the following:

- **Before each run**
  - Loads the session history
  - Merges that history with the new turn’s input
  - Sends the combined list to the agent/model as the full turn input

- **After non-streaming runs**
  - Calls `session.addItems(...)` once to persist:
    - the original user input, and
    - the model outputs produced by that turn

- **For streaming runs**
  - Persists the user input first
  - Appends streamed outputs once the turn is complete

- **For resumed runs**
  - If you resume from `RunResult.state` (e.g., approvals / interruptions), keep passing the same `session`.
  - The resumed turn is persisted into memory **without** re-preparing the input again.

---

## Inspecting and editing history

Sessions expose a small CRUD-like surface so you can build features like:

- “Undo last message”
- “Clear chat”
- “Audit/history views”

Typical helper methods you’ll see (depending on session implementation):

- `getItems()` — read stored `AgentInputItem[]`
- `addItems(items)` — append items to the stored history
- `popItem()` — remove and return the last stored item
- `clearSession()` — clear all items for the session

Example (shown conceptually):

```ts
import { OpenAIConversationsSession } from "@openai/agents";
import type { AgentInputItem } from "@openai/agents-core";

const session = new OpenAIConversationsSession({
  conversationId: "conv_123", // Use this if you want to resume an existing conversation.
});

const history = await session.getItems();
console.log(`Loaded ${history.length} prior items.`);

// Add a follow-up item to history
const followUp: AgentInputItem[] = [
  {
    type: "message",
    role: "user",
    content: [{ type: "input_text", text: "Let’s continue later." }],
  },
];

await session.addItems(followUp);

// Undo the most recent item
const undone = await session.popItem();
if (undone?.type === "message") console.log(undone.role);

// Clear history
await session.clearSession();
```

Notes:
- `getItems()` returns the stored `AgentInputItem[]`.
- `popItem()` is handy when a user edits/corrects the last message and you want to remove it before re-running.

---

## Bring your own storage

You can implement the `Session` interface to store memory in:
- Redis, DynamoDB, SQLite, Postgres, etc.

Only **five async methods** are required by the interface. A minimal custom session typically looks like:

- `getSessionId(): Promise<string>`
- `getItems(limit?: number): Promise<AgentInputItem[]>`
- `addItems(items: AgentInputItem[]): Promise<void>`
- `popItem(): Promise<AgentInputItem | undefined>`
- `clearSession(): Promise<void>`

A “minimal custom in-memory session” example in the docs demonstrates:

- generating a session ID (e.g., `randomUUID()`),
- cloning items when storing/returning (so callers don’t mutate your store accidentally),
- optional logging via the SDK logger,
- honoring `limit` in `getItems(limit)` (e.g., return only the last N items),
- and using `clearSession()` to reset stored items.

Once you have a session class, you use it exactly like the built-in sessions:

```ts
const session = new CustomMemorySession({ sessionId: "session-123-4567" });
await run(agent, "Add 3 to the total.", { session });
await run(agent, "Add 4 more.", { session });
```

Custom sessions are where you can:
- enforce retention/TTL rules,
- encrypt history at rest,
- attach metadata per turn,
- or perform filtering before storing.

---

## Control how history and new items merge

When you run an agent with input **as an array of** `AgentInputItem`s, you can control precisely how that new input combines with stored history via `sessionInputCallback`.

How it works:

1. The runner loads existing session history.
2. The runner calls your callback: `(history, newItems) => mergedItems`.
3. Whatever array you return becomes the turn’s **complete** model input.

This is useful for:
- trimming long histories,
- deduplicating repeated tool outputs,
- or explicitly selecting only the “important” context to show the model.

Example: keep only the last 8 history items, then append new items:

```ts
await run(agent, todoUpdateItems, {
  session,
  sessionInputCallback: (history, newItems) => {
    const recentHistory = history.slice(-8);
    return [...recentHistory, ...newItems];
  },
});
```

Note:
- If your input is a **string**, the runner merges history automatically, and the callback is optional.

---

## Handling approvals and resumable runs

In Human-in-the-loop (HITL) flows, a run can pause for approval and expose a resumable state.

A typical streaming + approval pattern looks like this:

```ts
const result = await runner.run(agent, "Search the itinerary", {
  session,
  stream: true,
});

if (result.requiresApproval) {
  // gather user feedback, then later resume the agent
  const continuation = await runner.run(agent, result.state, { session });
  console.log(continuation.finalOutput);
}
```

Important behavior:
- When you resume from a previous `RunState`, the new continuation turn is appended into the **same** memory record.
- Approval checkpoints still round-trip via `RunState`, while the session ensures the transcript stays complete and consistent.

---

## Compact OpenAI Responses history automatically

`OpenAIResponsesCompactionSession` is a decorator around any `Session` that uses the **OpenAI Responses API** to keep stored transcripts short.

How it works:

- After each persisted turn, the runner passes the latest `responseId` to `runCompaction`.
- `runCompaction` calls `responses.compact` when a decision hook says it should.
- The default policy compacts once you have **at least 10 non-user items** stored.
- You can override `shouldTriggerCompaction` to decide based on tokens, size, or your own heuristics.

Important caveat:
- The compaction decorator clears and rewrites the underlying session with the compacted result.
- Avoid pairing it with `OpenAIConversationsSession` because that session uses a server-managed history flow that doesn’t match the “rewrite everything” behavior.

Example: wrap a memory-backed session and customize the trigger threshold:

```ts
import {
  Agent,
  MemorySession,
  OpenAIResponsesCompactionSession,
  run,
} from "@openai/agents";

const agent = new Agent({
  name: "Support",
  instructions: "Answer briefly and keep track of prior context.",
  model: "gpt-5.2",
});

const session = new OpenAIResponsesCompactionSession({
  underlyingSession: new MemorySession(),
  model: "gpt-5.2", // optional: model used for responses.compact
  shouldTriggerCompaction: ({ compactionCandidateItems }) =>
    compactionCandidateItems.length >= 12,
});

await run(agent, "Summarize order #8472 in one sentence.", { session });
await run(agent, "Remind me of the shipping address.", { session });

// Compaction runs automatically after each persisted turn, but you can force it too:
await session.runCompaction({ force: true });
```

Operational tip:
- Enable debug logs to understand compaction decisions:
  - `DEBUG=openai-agents:openai:compaction`

---

## Reference

This README is derived from the official OpenAI Agents SDK (JS/TS) documentation page for “Sessions”.
