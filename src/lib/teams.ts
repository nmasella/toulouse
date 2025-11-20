import { Env } from '../config';

// Basic Teams/Bot Framework types
interface TeamsActivity {
    type: string;
    id: string;
    timestamp: string;
    serviceUrl: string;
    channelId: string;
    from: { id: string; name: string };
    conversation: { id: string };
    recipient: { id: string; name: string };
    text: string;
}

export async function verifyTeamsRequest(request: Request, env: Env): Promise<boolean> {
    // In a production environment, you MUST verify the JWT token from the Authorization header.
    // For this MVP/Cloudflare Worker implementation, we will skip complex JWT verification 
    // as it requires many dependencies (jsonwebtoken, jwks-rsa) that might be heavy for Workers 
    // or require polyfills. 
    // TODO: Implement proper JWT verification using a lightweight library or native crypto.

    const authHeader = request.headers.get('Authorization');
    return !!authHeader; // Weak check for now
}

export async function sendTeamsMessage(
    serviceUrl: string,
    token: string, // This would be the Bot Framework Access Token
    conversationId: string,
    text: string,
    replyToId?: string
) {
    // Note: To send messages to Teams, you first need to get an Access Token from Microsoft login
    // using your App ID and Password. This is a simplified placeholder.

    const url = `${serviceUrl}v3/conversations/${conversationId}/activities/${replyToId || ''}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            type: 'message',
            text: text,
        }),
    });

    return response.json();
}

export async function sendTeamsTyping(
    serviceUrl: string,
    token: string,
    conversationId: string
) {
    const url = `${serviceUrl}v3/conversations/${conversationId}/activities`;

    await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            type: 'typing',
        }),
    });
}

export async function getMicrosoftToken(env: Env): Promise<string> {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', env.TEAMS_APP_ID || '');
    params.append('client_secret', env.TEAMS_APP_PASSWORD || '');
    params.append('scope', 'https://api.botframework.com/.default');

    const response = await fetch('https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
    });

    const data: any = await response.json();
    return data.access_token;
}
