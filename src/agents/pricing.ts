import { BaseAgent, AgentContext, AgentResponse } from './base';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export class PricingAgent extends BaseAgent {
    name = 'pricing-expert';
    description = 'Suggests pricing strategies and models for digital products.';
    systemPrompt = `You are a Pricing Strategy Expert for digital products and SaaS.
  Your goal is to maximize revenue and user adoption.
  Analyze the product description provided and suggest:
  1. Pricing Models (Freemium, Tiered, Usage-based, etc.)
  2. Specific price points (with psychological pricing reasoning)
  3. Packaging strategies.
  
  If the user hasn't described their product enough (e.g. "How should I price it?"), ASK CLARIFYING QUESTIONS about costs, target audience, and value proposition.`;

    async handleMessage(message: string, context: AgentContext): Promise<AgentResponse> {
        const openai = createOpenAI({
            apiKey: context.env.OPENAI_API_KEY,
        });

        const { object } = await generateObject({
            model: openai('gpt-4o'),
            schema: z.object({
                response: z.string(),
                needsMoreInfo: z.boolean().describe("True if you need to ask the user for more details to provide a good answer."),
                detailedStrategy: z.string().optional().describe("A detailed markdown-formatted pricing strategy document (only when a complete strategy is provided)"),
                strategyTitle: z.string().optional().describe("A short, descriptive title for the pricing strategy (e.g., 'Pricing Strategy: SaaS CRM')"),
            }),
            system: this.systemPrompt + `\n\nWhen you provide a COMPLETE pricing strategy, also generate:
1. A detailedStrategy field with a comprehensive markdown document.
2. A strategyTitle field with a specific, descriptive title.

Document Structure:
- Executive Summary
- Pricing Models Comparison
- Recommended Pricing Tiers (with feature breakdown)
- Pricing Psychology & Strategy
- Competitive Positioning
- Revenue Projections (if applicable)

Use proper markdown formatting with headers, lists, and tables for pricing tiers.
IMPORTANT: Do NOT nest bullet points inside numbered lists or vice versa. Keep list structures simple.`,
            prompt: message,
        });

        if (object.needsMoreInfo) {
            await this.startSession(context);
        } else {
            await this.endSession(context);
        }

        // Enable Canvas for Slack if we have a detailed strategy
        const canvasEnabled = context.platform === 'slack' && !!object.detailedStrategy;

        return {
            text: object.response,
            canvasEnabled,
            canvasTitle: object.strategyTitle || 'Pricing Strategy Document',
            canvasMarkdown: object.detailedStrategy
        };
    }
}
