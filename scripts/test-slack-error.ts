
import { processSlackEvent } from '../src/lib/slack';
import { Env } from '../src/config';

// Mock global fetch
const originalFetch = global.fetch;
const mockFetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    const urlString = String(url);
    const body = init?.body ? JSON.parse(String(init.body)) : {};

    console.log(`[MockFetch] ${urlString} text="${body.text}"`);

    // 1. Mock FAILURE for the "Thinking..." message
    if (body.text === "Thinking...") {
        console.log("⚠️ Simulating Slack API Failure for 'Thinking...' message");
        return {
            json: async () => ({
                ok: false,
                error: 'invalid_blocks' // Simulate a common Slack error
            }),
            ok: true // HTTP 200
        } as Response;
    }

    // 2. Mock SUCCESS for the Error Notification
    if (body.text && body.text.includes("❌ I encountered an error")) {
        console.log("✅ Error notification sent successfully!");
        return {
            json: async () => ({ ok: true, ts: 'error-ts' }),
            ok: true
        } as Response;
    }

    // Default success
    return {
        json: async () => ({ ok: true }),
        ok: true
    } as Response;
};

global.fetch = mockFetch as any;

async function runTest() {
    console.log("🧪 Starting Slack Error Handling Test...");

    const mockEnv: Env = {
        OPENAI_API_KEY: 'mock',
        SLACK_SIGNING_SECRET: 'mock',
        SLACK_BOT_TOKEN: 'mock',
        SLACK_APP_TOKEN: 'mock',
        PERSONAS: {
            get: async () => null,
            put: async () => { },
            delete: async () => { },
        } as any
    };

    const mockEvent = {
        type: 'app_mention',
        text: 'Hello',
        channel: 'C123',
        user: 'U123',
        ts: '123.456'
    };

    try {
        await processSlackEvent(mockEnv, mockEvent);
        console.log("✅ Test finished execution.");
    } catch (error) {
        console.error("❌ Test failed with unhandled error:", error);
    } finally {
        global.fetch = originalFetch;
    }
}

runTest();
