import { BaseAgent, AgentContext, AgentResponse } from './base';
import { generateText, generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

const PersonaSchema = z.object({
    name: z.string(),
    role: z.string(),
    companyType: z.string(),
    painPoints: z.array(z.string()),
    goals: z.array(z.string()),
    personality: z.string(),
});

type Persona = z.infer<typeof PersonaSchema>;

export class BuyerPersonaAgent extends BaseAgent {
    name = 'persona-twin';
    description = 'Generates buyer personas and simulates them as Digital Twins.';
    systemPrompt = `You are a Buyer Persona Generator and Simulator.`;

    async handleMessage(message: string, context: AgentContext): Promise<AgentResponse> {
        const openai = createOpenAI({
            apiKey: context.env.OPENAI_API_KEY,
        });

        const sessionKey = `session:${context.platform}:${context.channelId}:${context.userId}`;
        const activePersonaKey = `active_persona:${context.platform}:${context.channelId}:${context.userId}`;
        const personasKey = `personas:${context.platform}:${context.channelId}`;

        // 1. Check if we are in "Simulation Mode" (Active Persona)
        const activePersonaName = await context.env.PERSONAS.get(activePersonaKey);

        if (activePersonaName) {
            // Retrieve full persona details
            const personasJson = await context.env.PERSONAS.get(personasKey);
            const personas: Persona[] = personasJson ? JSON.parse(personasJson) : [];
            const persona = personas.find(p => p.name === activePersonaName);

            if (persona) {
                const system = `You are ${persona.name}, a ${persona.role} at a ${persona.companyType}.
                 Personality: ${persona.personality}
                 Pain Points: ${persona.painPoints.join(', ')}
                 Goals: ${persona.goals.join(', ')}
                 
                 React to the user's messages as this person. Stay in character.`;

                const { text } = await generateText({
                    model: openai('gpt-4o'),
                    system,
                    prompt: message,
                });
                return { text };
            }
        }

        // 2. Command Handling (Generate, List, Select)
        const lowerMsg = message.toLowerCase();

        if (lowerMsg.includes('generate') && lowerMsg.includes('persona')) {
            const { object } = await generateObject({
                model: openai('gpt-4o'),
                schema: z.object({ personas: z.array(PersonaSchema) }),
                system: "You are an expert market analyst. Generate detailed buyer personas based on the user's input.",
                prompt: message,
            });

            await context.env.PERSONAS.put(personasKey, JSON.stringify(object.personas));

            const list = object.personas.map(p => `- *${p.name}* (${p.role}): ${p.personality}`).join('\n');
            return { text: `Generated ${object.personas.length} personas:\n${list}\n\nTo talk to one, say "Talk to [Name]".` };
        }

        if (lowerMsg.includes('list') && lowerMsg.includes('persona')) {
            const personasJson = await context.env.PERSONAS.get(personasKey);
            if (!personasJson) return { text: "No personas found. Ask me to generate some first." };

            const personas: Persona[] = JSON.parse(personasJson);
            const list = personas.map(p => `- *${p.name}* (${p.role})`).join('\n');
            return { text: `Available Personas:\n${list}` };
        }

        if (lowerMsg.startsWith('talk to') || lowerMsg.startsWith('chat with')) {
            const targetName = message.replace(/^(talk to|chat with)\s+/i, '').trim();

            const personasJson = await context.env.PERSONAS.get(personasKey);
            if (!personasJson) return { text: "No personas found." };

            const personas: Persona[] = JSON.parse(personasJson);
            const persona = personas.find(p => p.name.toLowerCase().includes(targetName.toLowerCase()));

            if (persona) {
                await this.startSession(context); // Sticky session
                await context.env.PERSONAS.put(activePersonaKey, persona.name); // Active persona
                return { text: `Entering Digital Twin mode. You are now talking to *${persona.name}*. Say "exit" to stop.` };
            } else {
                return { text: `Persona "${targetName}" not found.` };
            }
        }

        return { text: "I can generate buyer personas or simulate them. Try 'Generate personas for [market]' or 'List personas'." };
    }
}
