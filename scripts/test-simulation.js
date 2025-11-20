const crypto = require('crypto');

async function sendSlackEvent(text) {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
        type: 'event_callback',
        event: {
            type: 'app_mention',
            text: text,
            user: 'U12345',
            channel: 'C12345',
            ts: '1234567890.123456'
        }
    });

    const secret = 'test-secret';
    const sigBasestring = 'v0:' + timestamp + ':' + body;
    const signature = 'v0=' + crypto.createHmac('sha256', secret).update(sigBasestring).digest('hex');

    console.log(`[Slack] Sending event: "${text}"`);
    try {
        const response = await fetch('http://localhost:8787/slack/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-slack-request-timestamp': timestamp,
                'x-slack-signature': signature
            },
            body: body
        });
        console.log('[Slack] Response:', response.status, await response.text());
    } catch (error) { console.error('[Slack] Error:', error); }
}

async function sendTelegramEvent(text) {
    const body = JSON.stringify({
        update_id: 123456789,
        message: {
            message_id: 123,
            from: { id: 987654321, is_bot: false, first_name: 'TestUser' },
            chat: { id: 987654321, type: 'private' },
            date: 1678900000,
            text: text
        }
    });

    console.log(`[Telegram] Sending event: "${text}"`);
    try {
        const response = await fetch('http://localhost:8787/telegram/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Bot-Api-Secret-Token': 'test-telegram-secret'
            },
            body: body
        });
        console.log('[Telegram] Response:', response.status, await response.text());
    } catch (error) { console.error('[Telegram] Error:', error); }
}

async function sendTeamsEvent(text) {
    const body = JSON.stringify({
        type: 'message',
        id: '12345',
        timestamp: '2023-01-01T00:00:00.000Z',
        serviceUrl: 'http://localhost:9999', // Mock service URL
        channelId: 'teams-channel-id',
        from: { id: 'user-id', name: 'Test User' },
        conversation: { id: 'conv-id' },
        recipient: { id: 'bot-id', name: 'Bot' },
        text: text
    });

    console.log(`[Teams] Sending event: "${text}"`);
    try {
        const response = await fetch('http://localhost:8787/teams/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer mock-token'
            },
            body: body
        });
        console.log('[Teams] Response:', response.status, await response.text());
    } catch (error) { console.error('[Teams] Error:', error); }
}

// Simulate requests
(async () => {
    await sendSlackEvent('@market-analyst Analyze the CRM market.');
    await sendTelegramEvent('I need a buyer persona for a CTO.');
    await sendTeamsEvent('Suggest pricing for a SaaS product.');
})();
