import { Env } from '../config';

export async function verifyTelegramRequest(request: Request, env: Env): Promise<boolean> {
    const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    return secretToken === env.TELEGRAM_SECRET_TOKEN;
}

export async function sendTelegramMessage(
    token: string,
    chatId: string,
    text: string,
    replyToMessageId?: string
) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            reply_to_message_id: replyToMessageId,
        }),
    });

    return response.json();
}

export async function sendTelegramAction(
    token: string,
    chatId: string,
    action: string = 'typing'
) {
    const url = `https://api.telegram.org/bot${token}/sendChatAction`;

    await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            action: action,
        }),
    });
}
