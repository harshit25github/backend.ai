# GPT-4.1 Prompting Checklist

> **Quick reference guide based on OpenAI's official GPT-4.1 prompting cookbook**

---

## 🎯 Core Principles

GPT-4.1 is **highly literal** and **instruction-following**. It follows your prompt exactly as written.

### ✅ **Key Strengths**
- Excellent long-context handling
- Strong tool-calling capabilities
- Literal instruction following
- Steerable with precise guidance

### ⚠️ **Watch Out For**
- Takes instructions too literally (be precise!)
- Doesn't infer as much as older models
- Needs explicit workflow steps
- Sensitive to prompt structure

---

## 📝 Prompt Structure Template

```markdown
# ROLE AND OBJECTIVE
[Who the agent is and what it does - 2-3 lines max]

# INSTRUCTIONS
[Clear, numbered or bulleted list]
- Instruction 1
- Instruction 2
- Instruction 3

# REASONING STEPS
[Explicit step-by-step workflow]
1. Step 1: [Action]
2. Step 2: [Action]
3. Step 3: [Action]

# OUTPUT FORMAT
[How to structure responses]
- Use markdown
- Include X, Y, Z
- Avoid A, B, C

# EXAMPLES
[ONE comprehensive example - not 5!]

# CONTEXT
[Dynamic context injected here]
```

---

## ✅ DO's

### 1. **Use Clear Hierarchical Structure**
```markdown
## Main Section
### Subsection
- Bullet point
  - Sub-bullet

**Bold for emphasis**
*Italic for secondary emphasis*
```

### 2. **Explicit Workflow Steps**
```javascript
// ✅ Good
"Follow this workflow:
STEP 1: Check if user provided trip details
STEP 2: If yes, call update_summary tool
STEP 3: If all required fields present, confirm with user
STEP 4: On confirmation, generate itinerary"

// ❌ Bad (vague)
"Gather information and create itinerary when ready"
```

### 3. **Tools in SDK, Not Prompt**
```javascript
// ✅ Good (use SDK)
const tripPlannerAgent = new Agent({
  tools: [update_summary, update_itinerary, webSearchTool()]
});

// ❌ Bad (manual injection)
const prompt = `
Tools available:
- update_summary(origin, destination, dates)
- update_itinerary(days)
Use these tools when needed.
`;
```

### 4. **Chain-of-Thought for Complex Tasks**
```javascript
"Before responding, think through:
1. What is the user asking?
2. What information do I already have?
3. What information is missing?
4. Which tools should I call?
5. What should I say to the user?"
```

### 5. **One Comprehensive Example**
```javascript
// ✅ Good (ONE detailed example)
"## EXAMPLE

User: 'Plan a trip to Paris'
Agent:
1. Calls update_summary(destination='Paris')
2. Asks: 'Great! To plan your Paris trip, I need:
   - Where you're traveling from?
   - Travel dates?
   - Number of people?'
...
[Complete workflow shown]"

// ❌ Bad (5 redundant examples)
"## EXAMPLES
Example 1: Paris trip
Example 2: Tokyo trip
Example 3: Dubai trip
Example 4: London trip
Example 5: New York trip"
```

### 6. **Specific, Not General**
```javascript
// ✅ Good (specific)
"Call update_summary when user mentions:
- Origin city (e.g., 'from Mumbai')
- Destination city (e.g., 'to Paris')
- Travel dates (e.g., 'March 15-20')
- Passenger count (e.g., '2 people')
- Budget (e.g., '₹50k')"

// ❌ Bad (vague)
"Call update_summary when appropriate"
```

### 7. **Use Delimiters**
```javascript
// For complex sections
"## TOOL USAGE

<UPDATE_SUMMARY_RULES>
- Call when: user provides trip info
- Don't call when: user asks questions only
</UPDATE_SUMMARY_RULES>

<UPDATE_ITINERARY_RULES>
- Call when: creating new itinerary
- Call when: modifying existing itinerary
</UPDATE_ITINERARY_RULES>"
```

---

## ❌ DON'Ts

### 1. **Avoid ALL-CAPS Emphasis**
```javascript
// ❌ Bad
"CRITICAL!!! YOU MUST CALL update_summary EVERY SINGLE TIME!!!"

// ✅ Good
"Important: Call update_summary whenever user provides trip details"
```

### 2. **Don't Over-Explain**
```javascript
// ❌ Bad (100 words for simple concept)
"You are a highly specialized travel planning assistant whose primary and sole objective is to help users by creating detailed, personalized trip itineraries through a carefully designed process of conversational information gathering where you will methodically ask questions to collect all the necessary details..."

// ✅ Good (15 words)
"You're a Trip Planner for cheapoair.com. Create personalized itineraries through conversation."
```

### 3. **Avoid Conflicting Instructions**
```javascript
// ❌ Bad (conflicts)
"Call update_summary for ALL trip information"
"Only call update_summary when necessary"
"Call update_summary sparingly"

// ✅ Good (clear)
"Call update_summary when user provides: origin, destination, dates, pax, or budget"
```

### 4. **Don't Repeat Sample Phrases**
```javascript
// ❌ Bad (repetitive)
"Good responses:
- 'Great! Let me help you with that...'
- 'Great! I'd be happy to assist...'
- 'Great! Sounds exciting...'"

// ✅ Good (varied)
"Response examples:
- 'Great! Let me help you with that...'
- 'I'd be happy to create...'
- 'Sounds exciting! To start...'"
```

### 5. **Don't Use Vague Checklist Items**
```javascript
// ❌ Bad (vague checklist)
"Before responding:
☐ Did I do the right thing?
☐ Did I call tools appropriately?
☐ Is my response good?"

// ✅ Good (specific checklist)
"Before responding:
☐ If user provided origin/dest/dates → Did I call update_summary?
☐ If creating itinerary → Did I call update_itinerary?
☐ Response uses real numbers (not X-Y placeholders)?"
```

### 6. **Don't Inject Tool Schemas Manually**
```javascript
// ❌ Bad
const prompt = `
Available tools:
{
  "name": "update_summary",
  "parameters": {
    "origin": "string",
    "destination": "string"
  }
}
`;

// ✅ Good
const update_summary = tool({
  name: 'update_summary',
  description: 'Update trip summary',
  parameters: z.object({
    origin: z.string().describe('Origin city'),
    destination: z.string().describe('Destination city')
  })
});
```

---

## 🔧 Tool Calling Best Practices

### 1. **Tool Descriptions**
```javascript
// ✅ Good description
const update_summary = tool({
  name: 'update_summary',
  description: 'Update trip summary with user-provided details. Call whenever user mentions origin, destination, dates, pax, or budget.',
  parameters: z.object({
    origin: z.string().describe('Origin city name (e.g., "Mumbai", "Delhi")'),
    destination: z.string().describe('Destination city name (e.g., "Paris", "Tokyo")')
  })
});

// ❌ Bad description
const update_summary = tool({
  name: 'update_summary',
  description: 'Updates summary',  // Too vague!
  parameters: z.object({
    origin: z.string(),  // No description
    destination: z.string()
  })
});
```

### 2. **Parameter Descriptions**
```javascript
// ✅ Good (detailed parameter descriptions)
outbound_date: z.string()
  .describe('Departure date in YYYY-MM-DD format (e.g., "2026-03-15"). Must be a future date.'),

pax: z.number()
  .min(1)
  .describe('Number of passengers/travelers (e.g., 2 for couple, 4 for family)'),

// ❌ Bad (no descriptions)
outbound_date: z.string(),
pax: z.number()
```

### 3. **Tool Usage Examples in Prompt**
```javascript
// ✅ Good (show tool usage)
"## TOOL USAGE EXAMPLE

User: 'I want to go to Paris from Mumbai in March for 2 people'

Agent calls:
update_summary({
  origin: 'Mumbai',
  destination: 'Paris',
  outbound_date: '2026-03-15',  // Inferred from 'March'
  pax: 2
})

Agent responds: 'Great! Let me confirm...'"

// ❌ Bad (no examples)
"Use update_summary tool appropriately"
```

---

## 🚀 Agent-Specific Recommendations

### For Multi-Agent Systems

**1. Persistence Reminder**
```javascript
"You are an agent - keep working until the user's query is completely resolved before ending your turn. Only terminate when you're sure the problem is solved."
```

**2. Tool-Calling Guidance**
```javascript
"When you need information or to take action:
1. Use available tools (don't make up data)
2. Call tools in parallel when possible
3. Wait for tool results before responding"
```

**3. Explicit Planning (Optional)**
```javascript
"For complex requests:
1. List the steps needed
2. Execute each step
3. Verify completion
4. Summarize results"
```

---

## 📊 Response Optimization

### 1. **Output Format Specification**
```javascript
// ✅ Good
"## OUTPUT FORMAT

Use this structure:
### Day X: [Theme]
#### Morning
• **[Activity]** - Duration: Xh, Cost: ₹X
  - Transport: [details]
  - Tip: [insider info]"

// ❌ Bad
"Format your response nicely"
```

### 2. **Stop Sequences**
```javascript
modelSettings: {
  max_tokens: 3000,
  stop: [
    "\n---END---",
    "\n\n\n\n",  // 4 newlines
    "User:",
    "Assistant:"
  ]
}
```

---

## 🎭 Common Patterns

### Pattern 1: Information Gathering
```javascript
"WORKFLOW:
1. Check what info you have
2. Identify what's missing
3. Ask for missing info
4. When complete, proceed to next step"
```

### Pattern 2: Confirmation Before Action
```javascript
"CRITICAL: Before generating itinerary:
1. Summarize all collected info
2. Ask: 'Should I create your detailed itinerary?'
3. Wait for confirmation
4. ONLY THEN generate full itinerary"
```

### Pattern 3: Modification Handling
```javascript
"When user modifies existing plan:
1. Detect modification keywords: 'change', 'instead', 'modify'
2. Update summary with new values
3. Regenerate affected sections
4. Persist changes with update_itinerary"
```

---

## 🧪 Testing Your Prompts

### Checklist Before Deployment

```
☐ Structure: Uses ## headers, bullets, clear sections?
☐ Instructions: Specific and actionable (not vague)?
☐ Tools: Described in SDK, not injected in prompt?
☐ Examples: ONE comprehensive example (not 5)?
☐ Workflows: Explicit steps (not implied)?
☐ No ALL-CAPS emphasis (use "Important:" instead)?
☐ No conflicting instructions?
☐ Tool parameters have descriptions?
☐ Output format explicitly defined?
☐ max_tokens and stop sequences set?
```

### A/B Test Your Changes
1. Run baseline with old prompt
2. Run test with new prompt
3. Compare:
   - Response time
   - Response quality
   - Tool calling accuracy
   - Success rate

---

## 📏 Prompt Size Guidelines

| Agent Type | Recommended Size | Max Size |
|------------|------------------|----------|
| **Simple Router** | 500-1000 tokens | 1500 tokens |
| **Specialist Agent** | 1500-2500 tokens | 3500 tokens |
| **Complex Planner** | 2000-3000 tokens | 4000 tokens |

**Rule of Thumb:**
- If prompt > 4000 tokens → Too verbose, needs reduction
- If prompt < 500 tokens → May lack critical instructions
- Sweet spot: 1500-2500 tokens for most agents

---

## 🎯 Quick Optimization Checklist

**Reduce Latency:**
```
☐ Prompt < 3000 tokens?
☐ Tools use parallel execution?
☐ Context snapshot < 500 tokens?
☐ Examples reduced to 1?
☐ max_tokens set appropriately?
☐ Streaming enabled?
```

**Maintain Quality:**
```
☐ Critical instructions preserved?
☐ Tool calling logic clear?
☐ Workflow steps explicit?
☐ Output format defined?
☐ Edge cases handled?
```

**GPT-4.1 Optimized:**
```
☐ Hierarchical structure (##, ###)?
☐ No ALL-CAPS emphasis?
☐ No conflicting instructions?
☐ Tools in SDK (not prompt)?
☐ Specific examples (not generic)?
☐ Chain-of-thought for complex tasks?
```

---

## 🔗 Resources

- **OpenAI GPT-4.1 Prompting Guide:** https://cookbook.openai.com/examples/gpt4-1_prompting_guide
- **OpenAI Agents SDK:** https://github.com/openai/openai-agents-python
- **Latency Optimization:** https://platform.openai.com/docs/guides/latency-optimization

---

**Summary:** GPT-4.1 follows instructions literally. Be clear, specific, and structured. Avoid verbosity and conflicting instructions. Use SDK for tools. Test everything!
