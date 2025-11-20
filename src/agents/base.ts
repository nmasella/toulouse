import { Env } from '../config';

export interface AgentResponse {
    text: string;
    blocks?: any[]; // Slack blocks
    canvasEnabled?: boolean; // Whether to create a Canvas
    canvasTitle?: string; // Title for the Canvas
    canvasMarkdown?: string; // Markdown content for Canvas
}

export interface AgentContext {
    env: Env;
    channelId: string;
    userId: string;
    threadTs?: string;
    platform: 'slack' | 'telegram' | 'teams';
}

export abstract class BaseAgent {
    abstract name: string;
    abstract description: string;
    abstract systemPrompt: string;

    abstract handleMessage(message: string, context: AgentContext): Promise<AgentResponse>;

    protected async startSession(context: AgentContext) {
        const sessionKey = `session:${context.platform}:${context.channelId}:${context.userId}`;
        await context.env.PERSONAS.put(sessionKey, this.name);
    }

    protected async endSession(context: AgentContext) {
        const sessionKey = `session:${context.platform}:${context.channelId}:${context.userId}`;
        await context.env.PERSONAS.delete(sessionKey);
    }
}
