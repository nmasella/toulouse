import { Context } from 'hono';
import { Env } from '../config';
import { AgentDispatcher } from './dispatcher';
import { AgentContext } from '../agents/base';

export async function verifySlackRequest(c: Context<{ Bindings: Env }>): Promise<boolean> {
    const signature = c.req.header('x-slack-signature');
    const timestamp = c.req.header('x-slack-request-timestamp');
    const signingSecret = c.env.SLACK_SIGNING_SECRET;

    if (!signature || !timestamp || !signingSecret) {
        return false;
    }

    // Prevent replay attacks
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
    if (parseInt(timestamp) < fiveMinutesAgo) {
        return false;
    }

    const body = await c.req.raw.clone().text();
    const sigBasestring = 'v0:' + timestamp + ':' + body;

    const mySignature = 'v0=' + await cryptoSignature(sigBasestring, signingSecret);

    return mySignature === signature;
}

async function cryptoSignature(data: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(data)
    );

    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function postSlackMessage(
    token: string,
    channel: string,
    text: string,
    threadTs?: string,
    blocks?: any[]
) {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            channel,
            text,
            thread_ts: threadTs,
            blocks
        })
    });

    const data: any = await response.json();
    if (!data.ok) {
        console.error('postSlackMessage failed:', data.error);
        throw new Error(`Slack API error: ${data.error}`);
    }
    return data;
}

export async function updateSlackMessage(
    token: string,
    channel: string,
    ts: string,
    text: string,
    blocks?: any[]
) {
    const response = await fetch('https://slack.com/api/chat.update', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            channel,
            ts,
            text,
            blocks
        })
    });

    const data: any = await response.json();
    if (!data.ok) {
        console.error('updateSlackMessage failed:', data.error);
        throw new Error(`Slack API error: ${data.error}`);
    }
    return data;
}

export async function createSlackCanvas(
    token: string,
    channelId: string,
    title: string,
    markdown: string
) {
    console.log('createSlackCanvas payload:', JSON.stringify({
        title,
        channel_id: channelId,
        document_content: {
            type: 'markdown',
            markdown
        }
    }));

    const response = await fetch('https://slack.com/api/canvases.create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            title,
            channel_id: channelId,
            document_content: {
                type: 'markdown',
                markdown
            }
        })
    });

    let data: any = await response.json();

    // Fallback: If creating in channel fails (e.g. DMs), try creating a standalone canvas
    if (!data.ok && data.error === 'canvas_creation_failed' && channelId) {
        console.warn('Failed to create canvas in channel, trying standalone canvas...');
        const fallbackResponse = await fetch('https://slack.com/api/canvases.create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title,
                document_content: {
                    type: 'markdown',
                    markdown
                }
            })
        });
        data = await fallbackResponse.json();
    }

    if (!data.ok) {
        console.error('createSlackCanvas failed:', data.error);
        throw new Error(`Slack API error: ${data.error}`);
    }
    return data;
}

export async function updateSlackCanvas(
    token: string,
    canvasId: string,
    markdown: string
) {
    const response = await fetch('https://slack.com/api/canvases.edit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            canvas_id: canvasId,
            changes: [{
                operation: 'replace',
                document_content: {
                    type: 'markdown',
                    markdown
                }
            }]
        })
    });

    const data: any = await response.json();
    if (!data.ok) {
        console.error('updateSlackCanvas failed:', data.error);
        throw new Error(`Slack API error: ${data.error}`);
    }
    return data;
}

export async function getCanvasPermalink(token: string, canvasId: string): Promise<string | null> {
    try {
        const response = await fetch(`https://slack.com/api/files.info?file=${canvasId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data: any = await response.json();
        console.log('files.info response:', JSON.stringify(data));
        if (data.ok && data.file && data.file.permalink) {
            return data.file.permalink;
        }
    } catch (error) {
        console.error('Error fetching canvas permalink:', error);
    }
    return null;
}

export async function shareCanvasToChannel(
    token: string,
    canvasId: string,
    channelId: string,
    message: string,
    canvasUrl?: string
) {
    const finalUrl = canvasUrl || `https://slack.com/canvas/${canvasId}`;

    const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            channel: channelId,
            text: message,
            blocks: [{
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `${message}\n\n*Canvas ID:* \`${canvasId}\``
                },
                accessory: {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: 'Open Canvas'
                    },
                    url: finalUrl
                }
            }]
        })
    });

    const data: any = await response.json();
    if (!data.ok) {
        console.error('shareCanvasToChannel failed:', data.error);
        throw new Error(`Slack API error: ${data.error}`);
    }
    return data;
}

export async function processSlackEvent(env: Env, event: any) {
    console.log('Processing Slack event:', event.type, 'Text:', event.text);
    // Skip if no text (e.g., message_changed events or bot edits)
    if (!event.text) {
        return;
    }

    const dispatcher = new AgentDispatcher();
    const context: AgentContext = {
        env,
        channelId: event.channel,
        userId: event.user,
        threadTs: event.thread_ts || event.ts,
        platform: 'slack'
    };

    try {
        // Send "Thinking..." message
        let thinkingMsg: any;
        try {
            thinkingMsg = await postSlackMessage(
                env.SLACK_BOT_TOKEN,
                event.channel,
                "Thinking...",
                event.thread_ts || event.ts
            );
        } catch (thinkingError) {
            console.error('Failed to send thinking message:', thinkingError);
            thinkingMsg = { ok: false };
        }

        const cleanText = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
        const response = await dispatcher.dispatch(cleanText, context);

        if (thinkingMsg.ok && thinkingMsg.ts) {
            // Update the "Thinking..." message with the actual response
            await updateSlackMessage(
                env.SLACK_BOT_TOKEN,
                event.channel,
                thinkingMsg.ts,
                response.text,
                response.blocks
            );
        } else {
            // Fallback if initial message failed
            await postSlackMessage(env.SLACK_BOT_TOKEN, event.channel, response.text, event.thread_ts || event.ts, response.blocks);
        }

        // If Canvas is enabled and we have markdown content, create a Canvas
        console.log('Canvas Check - Enabled:', response.canvasEnabled, 'Has Markdown:', !!response.canvasMarkdown);

        if (response.canvasEnabled && response.canvasMarkdown) {
            const canvasTitle = response.canvasTitle || 'Analysis Report';
            console.log('Attempting to create Canvas:', canvasTitle);

            const canvasResult: any = await createSlackCanvas(
                env.SLACK_BOT_TOKEN,
                event.channel,
                canvasTitle,
                response.canvasMarkdown
            );

            console.log('Canvas Create Result:', JSON.stringify(canvasResult));

            if (canvasResult.ok && canvasResult.canvas_id) {
                // Try to get the permalink
                const permalink = await getCanvasPermalink(env.SLACK_BOT_TOKEN, canvasResult.canvas_id);
                console.log('Canvas Permalink:', permalink);

                // Share the canvas to the channel
                const shareResult = await shareCanvasToChannel(
                    env.SLACK_BOT_TOKEN,
                    canvasResult.canvas_id,
                    event.channel,
                    `📄 I've created a detailed ${canvasTitle} for you!`,
                    permalink || undefined
                );
                console.log('Canvas Share Result:', JSON.stringify(shareResult));
            } else {
                console.error('Canvas creation failed:', canvasResult);
            }
        }

    } catch (error: any) {
        console.error('Slack Error:', error);

        // Try to notify the user about the error
        try {
            await postSlackMessage(
                env.SLACK_BOT_TOKEN,
                event.channel,
                `❌ I encountered an error while processing your request: ${error.message || 'Unknown error'}`,
                event.thread_ts || event.ts
            );
        } catch (notifyError) {
            console.error('Failed to notify user of error:', notifyError);
        }
    }
}
