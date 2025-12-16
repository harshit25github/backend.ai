import fs from 'node:fs';
import { Agent, run } from '@openai/agents';
import { z } from 'zod';

const guardrailInstructions = fs
  .readFileSync(new URL('./gaurdrail.txt', import.meta.url), 'utf8')
  .trim();

// Guardrail output schema (Structured Outputs)
const UnifiedGuardrailOutput = z.object({
  decision: z.enum(['allow', 'warn', 'block']),
  category: z.enum([
    'travel',
    'competitor',
    'off_topic',
    'personal_info',
    'injection',
    'harmful',
    'illicit',
    'explicit',
  ]),
  reason: z.string(),
  isTravel: z.boolean(),
  hasCompetitor: z.boolean(),
  competitorMentioned: z.array(z.string()).nullable(),
  missingSlots: z.array(z.string()).nullable(),
  recommendedResponse: z.string().nullable(),
  actionRequired: z.enum(['proceed', 'redirect', 'block', 'request_details']),
});

export const unifiedTravelGuardrailAgent = new Agent({
  name: 'CheapOair Guardrail (nano)',
  model: process.env.GUARDRAIL_MODEL || 'gpt-4.1-nano',
  outputType: UnifiedGuardrailOutput,
  instructions: guardrailInstructions,
});

export const unifiedTravelGuardrail = {
  name: 'CheapOair Guardrail',
  execute: async ({ input, context }) => {
    const text = typeof input === 'string' ? input : JSON.stringify(input);

    try {
      const res = await run(unifiedTravelGuardrailAgent, text, { context });
      const guardrailResult = res.finalOutput;

      const shouldBlock = guardrailResult?.decision === 'block';

      const enhancedContext = {
        ...context,
        guardrailAnalysis: guardrailResult,
        suggestedResponse: guardrailResult?.recommendedResponse,
        competitorHandling: guardrailResult?.hasCompetitor
          ? {
              mentioned: guardrailResult.competitorMentioned,
              redirectResponse: guardrailResult.recommendedResponse,
            }
          : null,
        missingTravelDetails: guardrailResult?.missingSlots || [],
        actionRequired: guardrailResult?.actionRequired,
      };

      if (context?.guardrailLog) {
        context.guardrailLog.push({
          timestamp: new Date().toISOString(),
          input: text,
          analysis: guardrailResult,
          blocked: shouldBlock,
          category: guardrailResult?.category,
          competitorDetected: guardrailResult?.hasCompetitor || false,
        });
      }

      return {
        outputInfo: guardrailResult,
        tripwireTriggered: shouldBlock,
        context: enhancedContext,
      };
    } catch (error) {
      console.error('Guardrail Error:', error);

      const fallbackResult = {
        decision: 'allow',
        category: 'travel',
        reason: 'Guardrail analysis failed, defaulting to travel assistance',
        isTravel: true,
        hasCompetitor: false,
        competitorMentioned: null,
        missingSlots: null,
        recommendedResponse:
          "I'm here to help with your travel needs! What can I assist you with today?",
        actionRequired: 'proceed',
      };

      return {
        outputInfo: fallbackResult,
        tripwireTriggered: false,
        context: { ...context, guardrailAnalysis: fallbackResult },
      };
    }
  },
};

export const unifiedUsageExample = `
// In your main travel agent:
const result = await run(travelAgent, userInput, {
  inputGuardrails: [unifiedTravelGuardrail]
});

const guardrailAnalysis = result.context?.guardrailAnalysis;

// If guardrail generated a redirect/refusal/details request, return it directly:
if (guardrailAnalysis?.actionRequired !== 'proceed' && guardrailAnalysis?.recommendedResponse) {
  return guardrailAnalysis.recommendedResponse;
}

// Otherwise continue with normal travel assistance:
return await handleTravelRequest(userInput, guardrailAnalysis);
`;

export default unifiedTravelGuardrail;
