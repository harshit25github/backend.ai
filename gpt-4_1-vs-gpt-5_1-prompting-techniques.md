# Prompting Techniques Playbook: GPT‑4.1 vs GPT‑5.1 (OpenAI Cookbook)

This is a **how-to** comparison (not “advantages/disadvantages”) for writing **good prompts** for **GPT‑4.1** and **GPT‑5.1**, especially for **agents + tool calling + coding workflows**.

**Sources**
- GPT‑5.1 Prompting Guide (Cookbook): https://cookbook.openai.com/examples/gpt-5/gpt-5-1_prompting_guide
- GPT‑4.1 Prompting Guide (Cookbook): https://cookbook.openai.com/examples/gpt4-1_prompting_guide

---

## 1) The single biggest mindset difference

### GPT‑4.1 (non‑reasoning model)
You typically get best results by:
- **explicit agent reminders** (persistence + tool use + optional planning)
- **structured prompts** (clear sections + delimiters)
- **explicit planning if you want it** (the model won’t “internally think” by default)

### GPT‑5.1 (supports `none` reasoning + stronger steerability)
You typically get best results by:
- **still using the same agent reminders**, but also adding:
  - **output verbosity control** (prompt + optional `verbosity` parameter)
  - **progress/user updates (preambles)** for long tasks
  - **parallel tool call encouragement** (where safe)
  - **new tool types** (`apply_patch`, `shell`) for coding agents

---

## 2) Baseline prompt structure (works for both)

GPT‑4.1 guide recommends a simple, reliable structure:

```text
# Role and Objective

# Instructions
## Sub-categories for more detailed instructions

# Reasoning Steps

# Output Format

# Examples
## Example 1

# Context

# Final instructions and prompt to think step by step
```

**How to use it practically**
- Put **hard rules** (MUST / MUST NOT) in **Instructions**
- Put **format constraints** in **Output Format**
- Put **tool usage examples** in **Examples**
- Put **retrieved docs / code snippets** in **Context**
- End with **final reminder** (persistence + tool discipline)

---

## 3) “Agent reminders” (copy/paste)

### GPT‑4.1: use these 3 reminders (recommended)
The GPT‑4.1 guide explicitly recommends **three reminders** at the top of agent prompts:

1) **Persistence**
```text
You are an agent - please keep going until the user’s query is completely resolved, before ending your turn and yielding back to the user. Only terminate your turn when you are sure that the problem is solved.
```

2) **Tool-calling**
```text
If you are not sure about file content or codebase structure pertaining to the user’s request, use your tools to read files and gather the relevant information: do NOT guess or make up an answer.
```

3) **Planning (optional)**
```text
You MUST plan extensively before each function call, and reflect extensively on the outcomes of the previous function calls. DO NOT do this entire process by making function calls only, as this can impair your ability to solve the problem and think insightfully.
```

### GPT‑5.1: same reminders + one extra “don’t stop early” style
GPT‑5.1 can sometimes be **too concise** for long agent runs, so explicitly reinforce completeness:

```text
Persist until the task is fully handled end-to-end within the current turn whenever feasible: do not stop at analysis or partial fixes; carry changes through implementation, verification, and a clear explanation of outcomes.
```

---

## 4) Tool calling: how to do it well in each model

### ✅ Common best practice (both GPT‑4.1 and GPT‑5.1)
**Define tools via the API tools field** (not by pasting schemas into the prompt).
Then, in your **system prompt**, include:
- a short **“Tool Usage Rules”** section (when to call tools, how to ask for missing args)
- a small **Examples** section showing tool calls

### GPT‑4.1: “Tool Calls” prompting technique
What you put in the prompt:
- Tool reminder (above)
- “Use tools when unsure — don’t guess”
- If a tool is complicated, put tool usage examples in an `# Examples` section (not inside tool descriptions)

**Minimal tool usage rules template (GPT‑4.1)**
```text
# Tool Usage Rules
- Use tools whenever you need facts from the repo/docs/data. Do not guess.
- If required tool arguments are missing, ask the user a short question to get them.
- After tool results, summarize what you learned and proceed.
```

### GPT‑5.1: “Tool-calling format” technique + stronger rules
GPT‑5.1 guide shows a crisp pattern:
1) tool definition describes **what the tool does**
2) prompt includes **when to call it** and **what to do if missing info**
3) include example tool calls

**Tool usage rules example (GPT‑5.1 style)**
```text
<reservation_tool_usage_rules>
- When the user asks to book, reserve, or schedule a table, you MUST call `create_reservation`.
- Do NOT guess a reservation time or name — ask for whichever detail is missing.
- After calling the tool, confirm the reservation naturally.
</reservation_tool_usage_rules>
```

### GPT‑5.1: parallel tool calling (prompting technique)
If you have many reads/searches, prompt for batching:

```text
Parallelize tool calls whenever possible. Batch reads (read_file) and edits (apply_patch) to speed up the process.
```

> Tip: only enable/encourage parallel calls if your tool stack supports it safely.

---

## 5) Reasoning / planning: what to prompt

### GPT‑4.1
GPT‑4.1 is **not a reasoning model**, so:
- if you want “step-by-step planning”, you must prompt it
- best place: a **Planning** rule in system prompt

**Template**
```text
Before using tools: write a brief plan (2–6 bullets).
Between tool calls: write a 1–2 line reflection on what changed in your understanding.
```

### GPT‑5.1: `none` reasoning mode + planning prompt
GPT‑5.1 introduces `none` reasoning mode (0 reasoning tokens). When you run with `none`:
- you can still use hosted tools
- the guide says prior prompting guidance for non‑reasoning models applies

**Practical technique**
- If you use `none`, keep the GPT‑4.1-style planning prompt (to avoid “tool-call-only” behavior)
- Add: “ensure function calls have correct arguments”

---

## 6) Output formatting & verbosity: how to control

### GPT‑4.1 (prompt-driven)
Use an explicit **Output Format** section, for example:
```text
# Output Format
- Use Markdown.
- Provide: (1) Summary, (2) Steps, (3) Final answer.
- Keep it under 150 words unless the user asks for depth.
```

### GPT‑5.1 (prompt + optional `verbosity` parameter)
GPT‑5.1 supports a dedicated `verbosity` parameter and also responds well to explicit length guidance.

**Technique: add a verbosity spec in the prompt**
```text
<output_verbosity_spec>
- Respond in Markdown using at most 2 concise sentences.
- Lead with what you did (or found) and add context only if needed.
</output_verbosity_spec>
```

**Technique: conditional brevity rules (great for coding agents)**
```text
<final_answer_formatting>
- Tiny change: 2–5 sentences or ≤3 bullets.
- Medium change: ≤6 bullets or 6–10 sentences.
- Large change: summarize per file, avoid inlining code.
</final_answer_formatting>
```

---

## 7) Progress updates (long tasks)

### GPT‑4.1
If you want progress updates, explicitly ask for them:
```text
Every 3–5 tool calls, provide a 1–2 sentence status update: what you learned + what you’ll do next.
```

### GPT‑5.1: “user updates / preambles” technique (recommended)
GPT‑5.1 guide provides a full spec you can paste in.

**Template**
```text
<user_updates_spec>
You'll work for stretches with tool calls — it's critical to keep the user updated as you work.
<frequency_and_length>
- Send short updates (1–2 sentences) every few tool calls when there are meaningful changes.
- Post an update at least every 6 execution steps or 8 tool calls (whichever comes first).
- Only the initial plan, plan updates, and final recap can be longer.
</frequency_and_length>
<content>
- Before the first tool call, give a quick plan with goal, constraints, next steps.
- Always state at least one concrete outcome since the prior update (“found X”, “confirmed Y”).
- End with a recap and follow-up steps.
</content>
</user_updates_spec>
```

---

## 8) Long context & delimiters (especially important in GPT‑4.1)

GPT‑4.1 guide says:
- start with **Markdown section headers**
- **XML** performs well and is good for nesting
- **JSON** can be verbose and in long-context tests JSON performed poorly compared to XML / structured text

**Technique: choose delimiters that “stand out”**
- If your retrieved docs already contain lots of XML, don’t wrap them in more XML.
- Use a delimiter format that your content doesn’t already use heavily.

**Two long-context formatting patterns**
```text
<doc id='1' title='The Fox'>...</doc>
<doc id='2' title='The Dog'>...</doc>
```

or:

```text
ID: 1 | TITLE: The Fox | CONTENT: ...
ID: 2 | TITLE: The Fox | CONTENT: ...
```

---

## 9) Coding agents: diffs & file edits

### GPT‑4.1: custom `apply_patch` prompt + diff format
The GPT‑4.1 guide includes a recommended diff format and a sample tool description for a custom patch utility.
**Technique**
- define a tool named `apply_patch`
- teach the diff format in the tool description / prompt
- include at least one example

### GPT‑5.1: built-in `apply_patch` + `shell` tool types
GPT‑5.1 guide recommends migrating coding agents to:
- `tools=[{"type":"apply_patch"}]`
- `tools=[{"type":"shell"}]` for running commands (tests, grep, etc.)

**Technique: prompt for safe shell usage**
```text
When using shell:
- Prefer small, safe, read-only commands first (ls, cat, grep).
- Run tests after changes.
- Report only key outcomes (pass/fail), not full logs unless needed.
```

---

## 10) Ready-to-use system prompt templates

### A) GPT‑4.1 Agent Template (tool-using)
```text
# Role and Objective
You are an autonomous agent that solves the user’s request end-to-end.

# Core Reminders
You are an agent - please keep going until the user’s query is completely resolved, before ending your turn and yielding back to the user. Only terminate your turn when you are sure that the problem is solved.
If you are not sure about file content or codebase structure pertaining to the user’s request, use your tools to read files and gather the relevant information: do NOT guess or make up an answer.
You MUST plan extensively before each function call, and reflect extensively on the outcomes of the previous function calls. DO NOT do this entire process by making function calls only.

# Tool Usage Rules
- Use tools for any repo/doc/data facts.
- If tool arguments are missing, ask a short question.
- After each tool call: summarize findings + next step.

# Output Format
- Markdown
- Provide: Summary → Steps → Answer

# Examples
(put 1–2 examples of correct tool calls here)

# Context
(put retrieved docs/code here)

# Final instruction
Think step by step and verify correctness before finishing.
```

### B) GPT‑5.1 Agent Template (tool-using + updates)
```text
# Role and Objective
You are an autonomous agent that completes the task end-to-end.

# Solution persistence
Persist until the task is fully handled end-to-end within the current turn whenever feasible.

# Tool usage
- Use tools whenever needed; do not guess.
- Parallelize tool calls when safe and helpful.
- Verify tool outputs against user constraints before finalizing.

# Output verbosity
<output_verbosity_spec>
- Use Markdown. Be concise by default.
- Follow any user format constraints exactly.
</output_verbosity_spec>

# User updates (preambles)
<user_updates_spec>
- Give an initial plan before the first tool call.
- Provide short progress updates every few tool calls when meaningful.
- Always include at least one concrete outcome since the last update.
- End with a recap checklist.
</user_updates_spec>

# Examples
(1–2 tool call examples)

# Context
(retrieved docs/code)

# Final instruction
Verify completion, then summarize outcomes clearly.
```

---

## 11) Quick “what to change” checklist (GPT‑4.1 → GPT‑5.1)

When migrating your prompts:
1) Keep the same prompt structure + reminders.
2) Add explicit **verbosity rules** (and optionally use GPT‑5.1 `verbosity` parameter).
3) Add **user updates/preambles** if tasks run long.
4) Encourage **parallel tool calls** when scanning/searching.
5) For coding agents: switch to GPT‑5.1 built‑in `apply_patch` + optionally add `shell`.
