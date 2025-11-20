# Flight Specialist Quick Reference

Internal notes for working on the multi-agent flight stack (`src/ai`). Keep this doc next to the code so we never need to reverse-engineer the workflow again.

## Topology Cheat-Sheet
- `gatewayAgent` (`multiAgentSystem.js`): Routes messages to either the trip planner or flight specialist based on intent.
- `tripPlannerAgent`: Handles general travel planning and generates itineraries.
- `flightSpecialistAgent`: Flight-only agent using the strengthened `AGENT_PROMPTS.FLIGHT_SPECIALIST` prompt.
- `bookingAgent`: Follows up once the user is ready to purchase.
- `flight_playground.js`: Local REPL to stress-test the specialist without the UI.

## Key Files
| File | Why it matters |
|------|----------------|
| `src/ai/multiAgentSystem.js` | Orchestrator + tool definitions (`flight_search`, context helpers, agent wiring). |
| `src/ai/prompts.js` | All system prompts. Flight prompt now includes the slot audit + passenger rules. |
| `PASSENGER_VALIDATION_RULES.md` | Exhaustive description of age/ratio validations enforced by `flight_search`. |
| `flight-playground.js` | CLI playground with `/context`, `/history`, `/clear`, `/save` commands. |

## Flight Specialist Slot Checklist
The prompt now enforces a GPT-4.1 style slot audit. The agent must collect the following before calling `flight_search`:
1. **Route** – origin & destination cities plus nearest commercial airports and IATA codes (resolved via `web_search`).
2. **Dates** – exact outbound date (future) and return date for round-trips. Past dates are rolled 1 year forward.
3. **Passenger Breakdown** – adults, seniors, children, **children ages**, seat infants, lap infants, total pax.
4. **Cabin + Trip Type** – confirm any change away from context defaults.
5. **Filters** – direct-flight flag, preferred airlines, loyalty hints.

> If any slot is blank or ambiguous, the agent must stay in Type-D “missing info” mode, ask for all items in one message, and only then call `flight_search`.

## Passenger Clarification Rules
- Every mention of kids/toddlers/teens → ask for the **exact count** and **individual ages (3-15)**.
- Any “infant/baby/newborn” → ask for age **and** whether they need a lap seat or their own seat.
- When the user changes even one passenger detail, restate the full breakdown and rerun the slot audit.
- These guardrails mirror the code in `flight_search` (lap infant 1:1, seat infant 2:1, children age array, etc.). Pre-validating in conversation prevents tool failures.

## Tool Flow (recap)
1. **web_search**: Resolve airport IATA codes. Required before every `flight_search` call.
2. **flight_search**: Updates context, runs passenger validations, and stashes CheapOair-style results (`ctx.flight.searchResults`, `ctx.flight.deeplink`).
3. Agent reads the refreshed context snapshot and formats user-facing output (never exposes tool names).

## Running the Playground
```bash
node flight-playground.js
```

Commands while running:
- `/context` – pretty-print current context (route, pax breakdown, flight filters).
- `/history` – dump the simulated conversation.
- `/clear` – delete `data/agent-context-flight-playground-session.json` to start fresh.
- `/save` – persist logs under `data/conversation-logs/`.

Recommended manual regression scenarios:
1. **Lap infant ratio** – “Book DEL → BLR on Jan 20 for 1 adult and 2 lap infants.” Agent should explain the 1:1 rule before calling the tool.
2. **Children ages** – “Need flights for 2 adults and 3 kids” – ensure the follow-up asks for individual ages and seat/lap decisions.
3. **Seat vs lap clarification** – “Family of four with a newborn” – agent must ask whether the baby gets their own seat.
4. **Route change** – After an initial search, say “Make it one-way and in business class” – verify the agent reuses prior slots, updates only the changed ones, and reruns `flight_search`.

## Troubleshooting Tips
- **Tool error about IATA codes** → ensure `web_search` ran for both cities; watch for `_awaitingWebSearch` flag in context.
- **Passenger validation failure** → replicate the error using `test-children-ages.js` (fixtures cover each edge case).
- **Context drift** → inspect `data/contexts/<chatId>_context.json` to confirm `summary.pax` structure matches expectations (object vs legacy number).

Keeping this README up to date saves time whenever the prompt or validation logic changes—update it whenever you touch the flight specialist or passenger data model.
