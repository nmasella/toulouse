import { BaseAgent, AgentContext, AgentResponse } from '../agents/base';
import { MarketAnalysisAgent } from '../agents/market';
import { BuyerPersonaAgent } from '../agents/persona';
import { PricingAgent } from '../agents/pricing';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export class AgentDispatcher {
    private agents: BaseAgent[] = [];

    constructor() {
        this.registerAgent(new MarketAnalysisAgent());
        this.registerAgent(new BuyerPersonaAgent());
        this.registerAgent(new PricingAgent());
    }

    registerAgent(agent: BaseAgent) {
        this.agents.push(agent);
    }

    async dispatch(message: string, context: AgentContext): Promise<AgentResponse> {
        const sessionKey = `session:${context.platform}:${context.channelId}:${context.userId}`;

        // 1. Check for explicit mentions (Highest Priority)
        // If user explicitly mentions an agent, we always switch.
        const explicitAgent = this.agents.find(a => message.includes(`@${a.name}`));
        if (explicitAgent) {
            // Clear previous session if any
            await context.env.PERSONAS.delete(sessionKey);
            return explicitAgent.handleMessage(message, context);
        }

        // 2. Check for active session
        const activeAgentName = await context.env.PERSONAS.get(sessionKey);
        if (activeAgentName) {
            const activeAgent = this.agents.find(a => a.name === activeAgentName);
            if (activeAgent) {
                // Intelligent Session Guard:
                // Decide if we should stay in the session or switch/exit based on user intent.
                const openai = createOpenAI({
                    apiKey: context.env.OPENAI_API_KEY,
                });

                const { text: intent } = await generateText({
                    model: openai('gpt-4o'),
                    system: `You are a Session Manager.
The user is currently in a specific session/conversation with the agent: "${activeAgentName}".
Determine if the user's message is a continuation of this conversation, or if they are trying to switch tasks, switch agents, or stop.

- "Tell me more", "Why?", "I disagree" -> CONTINUE
- "Switch to market analyst", "Talk to someone else", "Stop", "Exit" -> SWITCH
- "Generate new personas" (if current is persona-twin) -> SWITCH (New task)
- "List personas" -> SWITCH (Command)

Return ONLY 'CONTINUE' or 'SWITCH'.`,
                    prompt: `User Message: "${message}"`,
                });

                if (intent.trim().toUpperCase() === 'CONTINUE') {
                    return activeAgent.handleMessage(message, context);
                } else {
                    // End session and fall through to standard routing
                    await context.env.PERSONAS.delete(sessionKey);
                }
            }
        }

        // 3. Standard Routing (LLM Decides)
        const openai = createOpenAI({
            apiKey: context.env.OPENAI_API_KEY,
        });

        const agentDescriptions = this.agents.map(a => `${a.name}: ${a.description}`).join('\n');

        const { text: agentName } = await generateText({
            model: openai('gpt-4o'),
            system: `You are a router. Your job is to pick the best AI agent to handle the user's request.
Available agents:
${agentDescriptions}

Return ONLY the name of the agent (e.g., "market-analyst"). 
If none fit perfectly, return "market-analyst" as a default.`,
            prompt: `User request: "${message}"`,
        });

        const selectedAgent = this.agents.find(a => a.name === agentName.trim());

        if (selectedAgent) {
            return selectedAgent.handleMessage(message, context);
        }

        // Default fallback
        return this.agents[0].handleMessage(message, context);
    }

}
