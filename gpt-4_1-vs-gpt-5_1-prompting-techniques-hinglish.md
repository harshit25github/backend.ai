# Prompting Techniques Playbook: GPT‑4.1 vs GPT‑5.1 (Hinglish) — OpenAI Cookbook

Ye doc **sirf “how to prompt”** pe focus karta hai (advantages/disadvantages nahi). Target: **agents + tool calling + coding workflows** ke liye GPT‑4.1 aur GPT‑5.1 me prompt kaise likhe.

**Sources**
- GPT‑5.1 Prompting Guide (Cookbook): https://cookbook.openai.com/examples/gpt-5/gpt-5-1_prompting_guide
- GPT‑4.1 Prompting Guide (Cookbook): https://cookbook.openai.com/examples/gpt4-1_prompting_guide

---

## 1) Sabse bada mindset difference

### GPT‑4.1 (non‑reasoning model)
Best results tab milte hain jab aap:
- **explicit agent reminders** add karo (persistence + tools + optional planning)
- prompt ko **structured** rakho (clear sections + delimiters)
- agar “step-by-step plan” chahiye, to **prompt me explicitly** bolo (warna model straight answer dega)

### GPT‑5.1 (supports `none` reasoning + zyada steerability means contrables )
Best results tab milte hain jab aap GPT‑4.1 wali base cheezein rakho **plus**:
- **verbosity / detail** ko control karo (prompt + optional `verbosity` parameter)
- long tasks me **user updates / preambles** add karo (progress updates)
- **parallel tool calls** encourage karo (jab safe ho)
- coding agents me naye tool types: **`apply_patch`, `shell`** use karo

---

## 2) Baseline prompt structure (dono models ke liye)

GPT‑4.1 guide ka recommended structure:

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

**Practical use**
- Hard rules (MUST / MUST NOT) => **Instructions**
- Format constraints => **Output Format**
- Tool usage demo => **Examples**
- Retrieved docs / code => **Context**
- End me => **persistence + tool discipline** reminder

---

## 3) “Agent reminders” (copy/paste ready)

### GPT‑4.1: 3 reminders (recommended)
1) **Persistence**( discpline to work done )
```text
You are an agent - please keep going until the user’s query is completely resolved, before ending your turn and yielding back to the user. Only terminate your turn when you are sure that the problem is solved.
```

2) **Tool-calling** 
```text
If you are not sure about file content or codebase structure pertaining to the user’s request, use your tools to read files and gather the relevant information: do NOT guess or make up an answer.
```

3) **Planning (optional, but useful for long tasks --- Chain of Thought)**
```text
You MUST plan extensively before each function call, and reflect extensively on the outcomes of the previous function calls. DO NOT do this entire process by making function calls only, as this can impair your ability to solve the problem and think insightfully.
```

### GPT‑5.1: same base reminders + “don’t stop early” line
GPT‑5.1 kabhi-kabhi **too concise** ho jata hai. Isliye completeness ko reinforce karo:

```text
Completeness Reminder : 
Persist until the task is fully handled end-to-end within the current turn whenever feasible: do not stop at analysis or partial fixes; carry changes through implementation, verification, and a clear explanation of outcomes.
```

---

## 4) Tool calling: kaise likhe prompt (GPT‑4.1 vs GPT‑5.1)

### ✅ Common best practice (dono models)
- Tools ko **API tools field** me define karo (prompt me schema paste karne se avoid karo).
- System prompt me ek **Tool Usage Rules** section add karo:
  - kab tool call karna hai
  - missing args ho to user se kya poochna hai
  - tool result aane ke baad next step kya hoga
- `# Examples` section me 1–2 **tool-call examples** dikhao.

### GPT‑4.1: tool calling prompt technique
Prompt me ye cheezein rakho:
- “Use tools when unsure, don’t guess”
- “Missing args ho to short question pooch”
- Tool result ke baad 1–2 line summary + next step

**Minimal Tool Usage Rules (GPT‑4.1)**
```text
# Tool Usage Rules
- Repo/docs/data se related facts ke liye tools use karo. Guess mat karo.
- Required tool arguments missing ho, to user se 1 short question poochkar clarity lo.
- Tool result aate hi: summarize + next step execute karo.
```

### GPT‑5.1: stronger tool rules + example style
GPT‑5.1 guide me pattern:
- tool definition => tool kya karta hai
- prompt rules => kab call karna hai + missing info me kya karna hai
- examples => correct flow

**Example (GPT‑5.1 style)**
```text
<reservation_tool_usage_rules>
- Jab user “book/reserve/schedule table” bole, you MUST call `create_reservation`.
- Reservation time ya name guess mat karo — jo missing hai uske liye user se poochho.
- Tool call ke baad natural confirmation do.
</reservation_tool_usage_rules>
```

### GPT‑5.1: parallel tool calls (prompt technique)
Agar multiple reads/searches hain, to batching/parallelism bol do:

```text
Parallelize tool calls whenever possible. Batch reads (read_file) and edits (apply_patch) to speed up the process.
```

> Note: parallel calls tabhi encourage karo jab aapki tool-stack safely support karti ho.

---

## 5) Reasoning / planning: kya prompt karein
# reasoning/planning  : is very explicit in GPT-4.1 but not in GPT-5.1 by default do it for us  
### GPT‑4.1
GPT‑4.1 “reasoning model” nahi hai, so:
- agar aapko plan chahiye, to prompt me bolo

**Technique**
```text
Before using tools: 2–6 bullets ka plan likho.
Between tool calls: 1–2 lines me reflect karo ki kya naya samjha aur next kya hai.
```

### GPT‑5.1: `none` reasoning mode + planning prompt
GPT‑5.1 me `none` reasoning mode (0 reasoning tokens) hota hai. Is mode me:
- aap still tools use kar sakte ho
- prompting ko GPT‑4.1 style rakho

**Technique**
- `none` use kar rahe ho => GPT‑4.1-style planning line zaroor rakho
- plus: “tool arguments verify karo” rule add karo

---

## 6) Output format & verbosity: response ko control kaise karein

### GPT‑4.1 (prompt-driven)
Ek clear Output Format section likho:
```text
# Output Format
- Markdown me answer do
- Structure: Summary → Steps → Final Answer
- Default: 150 words ke andar (unless user wants deep detail)
```

### GPT‑5.1 (prompt + optional `verbosity` parameter)
GPT‑5.1 me `verbosity` parameter hota hai, but prompt me bhi clarity do.

**Technique: verbosity spec**
```text
<output_verbosity_spec>
- Markdown use karo.
- Default concise: max 2 sentences unless asked.
- Pehle “what you did/found” bolo, phir needed context.
</output_verbosity_spec>
```

**Technique: conditional formatting (coding agents ke liye best)**
```text
<final_answer_formatting>
- Tiny change: 2–5 sentences ya ≤3 bullets.
- Medium: ≤6 bullets.
- Large: per-file summary, code inline mat karo.
</final_answer_formatting>
```

---

## 7) Progress updates (long tasks)

### GPT‑4.1
Agar aapko progress updates chahiye, explicitly bol do:
```text
Har 3–5 tool calls ke baad 1–2 sentence status update do: kya mila + next kya karoge.
```

### GPT‑5.1: user updates / preambles (recommended)
GPT‑5.1 guide ka paste-ready spec:

```text
<user_updates_spec>
Long tool runs me user ko updated rakhna important hai.

<frequency_and_length>
- Meaningful progress pe short updates (1–2 sentences) do.
- At least every 6 steps ya 8 tool calls me ek update (whichever comes first).
- Initial plan, plan change, aur final recap thoda longer ho sakta hai.
</frequency_and_length>

<content>
- First tool call se pehle: goal + constraints + next steps ka quick plan.
- Har update me at least 1 concrete outcome (“found X”, “confirmed Y”).
- End me recap checklist + next steps.
</content>
</user_updates_spec>
```

---

## 8) Long context & delimiters (GPT‑4.1 me extra important)
 - no fundamental differnece in prompt structure
GPT‑4.1 guide practical points:
- Markdown headings se start karo
- XML nesting achha karta hai
- Long-context me JSON verbose hota hai; tests me JSON kafi cases me weak perform karta hai

**Technique: “standout” delimiters use karo**
- Content me already XML hai to aur XML mat add karo
- Aisa delimiter choose karo jo content me naturally nahi aata

**Patterns**
```text
<doc id='1' title='Doc A'>...</doc>
<doc id='2' title='Doc B'>...</doc>
```

or:

```text
ID: 1 | TITLE: Doc A | CONTENT: ...
ID: 2 | TITLE: Doc B | CONTENT: ...
```

---

## 9) Coding agents: diffs & file edits

### GPT‑4.1: custom `apply_patch` diff format
Technique:
- `apply_patch` tool define karo
- diff format prompt/tool description me teach karo
- 1 example zaroor do

### GPT‑5.1: built‑in `apply_patch` + `shell`
Technique:
- `tools=[{"type":"apply_patch"}]`
- optional: `tools=[{"type":"shell"}]` (tests/grep/ls)

**Safe shell prompting**
```text
When using shell:
- Pehle small read-only commands (ls/cat/grep).
- Change ke baad tests run karo.
- Sirf key outcomes report karo (pass/fail), full logs tabhi jab needed.
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
- Repo/docs/data facts ke liye tools use karo. Guess mat karo.
- Arguments missing ho to 1 short question poochho.
- Tool result => 1–2 line summary + next step.

# Output Format
- Markdown
- Summary → Steps → Final Answer

# Examples
(1–2 tool-call examples)

# Context
(retrieved docs/code)

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
- Tools jab bhi needed ho use karo; guess mat karo.
- Safe ho to parallelize tool calls.
- Tool outputs ko constraints ke against verify karke hi final karo.

# Output verbosity
<output_verbosity_spec>
- Markdown use karo.
- Default concise.
- User ke format constraints strictly follow karo.
</output_verbosity_spec>

# User updates (preambles)
<user_updates_spec>
- First tool call se pehle initial plan do.
- Meaningful progress pe short updates do.
- Har update me 1 concrete outcome include karo.
- End me recap checklist do.
</user_updates_spec>

# Examples
(1–2 tool-call examples)

# Context
(retrieved docs/code)

# Final instruction
Verify completion, then summarize outcomes clearly.
```

---

## 11) Quick migration checklist (GPT‑4.1 → GPT‑5.1)

1) Same prompt structure + core reminders keep karo.  
2) **Verbosity rules** add karo (optional `verbosity` parameter use).  
3) Long tasks me **user updates/preambles** add karo.  
4) Scans/searches me **parallel tool calls** encourage karo (if safe).  
5) Coding agents: GPT‑5.1 ke built‑in `apply_patch` + optional `shell` adopt karo.  
