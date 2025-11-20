import { SocketModeClient, LogLevel } from '@slack/socket-mode';
import { config } from 'dotenv';
import { processSlackEvent } from './lib/slack';
import { Env } from './config';

config(); // Load .env

// Mock KVNamespace for local dev
class MockKVNamespace {
    private store = new Map<string, string>();

    async get(key: string): Promise<string | null> {
        return this.store.get(key) || null;
    }

    async put(key: string, value: string): Promise<void> {
        this.store.set(key, value);
    }

    async delete(key: string): Promise<void> {
        this.store.delete(key);
    }

    async list() { return { keys: [], list_complete: true, cursor: '' }; }
    async getWithMetadata(key: string) { return { value: this.store.get(key) || null, metadata: null }; }
}

const env: Env = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET || '',
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN || '',
    SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN || '',
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_SECRET_TOKEN: process.env.TELEGRAM_SECRET_TOKEN,
    TEAMS_APP_ID: process.env.TEAMS_APP_ID,
    TEAMS_APP_PASSWORD: process.env.TEAMS_APP_PASSWORD,
    PERSONAS: new MockKVNamespace() as any
};

const appToken = process.env.SLACK_APP_TOKEN;

if (!appToken) {
    console.error("SLACK_APP_TOKEN is missing in .env");
    process.exit(1);
}

const socketModeClient = new SocketModeClient({
    appToken: appToken,
    logLevel: LogLevel.DEBUG
});

// Attach listeners to events by type.
socketModeClient.on('app_mention', async ({ event, ack }) => {
    console.log('Event received: app_mention', JSON.stringify(event));
    await ack();
    await processSlackEvent(env, event);
});

socketModeClient.on('message', async ({ event, ack }) => {
    console.log('Event received: message', JSON.stringify(event));
    await ack();
    // Filter out bot messages and ensure it's a DM
    if (event.bot_id) return;

    if (event.channel_type === 'im') {
        await processSlackEvent(env, event);
    }
});

(async () => {
    await socketModeClient.start();
    console.log('⚡️ Slack Socket Mode is running!');
})();
