import { Hono } from 'hono';
import { Env } from './config';
import { verifySlackRequest, postSlackMessage, processSlackEvent } from './lib/slack';
import { verifyTelegramRequest, sendTelegramMessage, sendTelegramAction } from './lib/telegram';
import { verifyTeamsRequest, sendTeamsMessage, getMicrosoftToken, sendTeamsTyping } from './lib/teams';
import { AgentDispatcher } from './lib/dispatcher';
import { AgentContext } from './agents/base';

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => c.text('AI Agent System is running!'));

// --- SLACK HANDLER ---
app.post('/slack/events', async (c) => {
    const isValid = await verifySlackRequest(c);
    if (!isValid) return c.text('Invalid signature', 401);

    const body = await c.req.json();
    if (body.type === 'url_verification') return c.json({ challenge: body.challenge });

    if (body.type === 'event_callback') {
        const event = body.event;
        if (event.bot_id) return c.text('OK');

        if (event.type === 'app_mention' || (event.type === 'message' && event.channel_type === 'im')) {
            c.executionCtx.waitUntil(processSlackEvent(c.env, event));
            return c.text('OK');
        }
    }
    return c.text('OK');
});

// --- TELEGRAM HANDLER ---
app.post('/telegram/webhook', async (c) => {
    const isValid = await verifyTelegramRequest(c.req.raw, c.env);
    if (!isValid) return c.text('Unauthorized', 401);

    const body = await c.req.json();
    if (body.message && !body.message.from.is_bot) {
        c.executionCtx.waitUntil(processTelegramEvent(c.env, body.message));
    }
    return c.text('OK');
});

async function processTelegramEvent(env: Env, message: any) {
    const dispatcher = new AgentDispatcher();
    const context: AgentContext = {
        env,
        channelId: message.chat.id.toString(),
        userId: message.from.id.toString(),
        platform: 'telegram'
    };

    try {
        if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Missing TELEGRAM_BOT_TOKEN");

        // Send typing indicator
        await sendTelegramAction(env.TELEGRAM_BOT_TOKEN, message.chat.id);

        const response = await dispatcher.dispatch(message.text, context);
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, response.text, message.message_id);
    } catch (error) {
        console.error('Telegram Error:', error);
    }
}

// --- TEAMS HANDLER ---
app.post('/teams/messages', async (c) => {
    // Note: Real Teams auth is complex. 
    const isValid = await verifyTeamsRequest(c.req.raw, c.env);
    if (!isValid) return c.text('Unauthorized', 401);

    const body = await c.req.json();
    if (body.type === 'message' && !body.from.bot) {
        c.executionCtx.waitUntil(processTeamsEvent(c.env, body));
    }
    return c.text('OK');
});

async function processTeamsEvent(env: Env, activity: any) {
    const dispatcher = new AgentDispatcher();
    const context: AgentContext = {
        env,
        channelId: activity.conversation.id,
        userId: activity.from.id,
        platform: 'teams'
    };

    try {
        const token = await getMicrosoftToken(env);

        // Send typing indicator
        await sendTeamsTyping(activity.serviceUrl, token, activity.conversation.id);

        // Remove mentions from text if possible (Teams sends HTML usually, but plain text is in .text)
        const cleanText = activity.text.replace(/<at>.*<\/at>/g, '').trim();

        const response = await dispatcher.dispatch(cleanText, context);
        await sendTeamsMessage(activity.serviceUrl, token, activity.conversation.id, response.text, activity.id);
    } catch (error) {
        console.error('Teams Error:', error);
    }
}

export default app;
