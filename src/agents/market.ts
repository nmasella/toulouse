import { BaseAgent, AgentContext, AgentResponse } from './base';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export class MarketAnalysisAgent extends BaseAgent {
    name = 'market-analyst';
    description = 'Analyzes market trends, competitors, and opportunities.';
    systemPrompt = `You are an expert Market Research Analyst. 
  Your goal is to provide deep insights into market trends, competitor analysis, and strategic opportunities.
  When asked to analyze a market or product, use frameworks like SWOT, PESTEL, or Porter's Five Forces where appropriate.
  Be data-driven (simulated based on your training data) and professional.
  
  IMPORTANT: Do not ask clarifying questions unless the request is completely unintelligible. 
  Instead, make educated assumptions based on the context or common industry standards to provide a complete analysis immediately. 
  State your assumptions clearly in the analysis.`;

    async handleMessage(message: string, context: AgentContext): Promise<AgentResponse> {
        const openai = createOpenAI({
            apiKey: context.env.OPENAI_API_KEY,
        });

        const { object } = await generateObject({
            model: openai('gpt-4o'),
            schema: z.object({
                response: z.string(),
                needsMoreInfo: z.boolean().describe("True if you need to ask the user for more details to provide a good answer."),
                detailedAnalysis: z.string().optional().describe("A detailed markdown-formatted analysis report (only when a complete analysis is provided)"),
                reportTitle: z.string().optional().describe("A short, descriptive title for the analysis report (e.g., 'Market Analysis: Electric Vehicles')"),
            }),
            system: this.systemPrompt + `\n\nWhen you provide a COMPLETE market analysis, also generate:
1. A detailedAnalysis field with a comprehensive markdown report.
2. A reportTitle field with a specific, descriptive title.

Report Structure:
- Executive Summary
- Market Overview
- Competitive Analysis
- SWOT Analysis
- PESTLE Analysis
- Porter’s Five Forces Analysis
- Recommendations

Use proper markdown formatting with headers, lists, and tables where appropriate.
IMPORTANT: Do NOT nest bullet points inside numbered lists or vice versa. Keep list structures simple.`,
            prompt: message,
        });

        if (object.needsMoreInfo) {
            await this.startSession(context);
        } else {
            await this.endSession(context);
        }

        // Enable Canvas for Slack if we have a detailed analysis
        const canvasEnabled = context.platform === 'slack' && !!object.detailedAnalysis;

        return {
            text: object.response,
            canvasEnabled,
            canvasTitle: object.reportTitle || 'Market Analysis Report',
            canvasMarkdown: object.detailedAnalysis
        };
    }
}
