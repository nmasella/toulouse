import { z } from 'zod';

export const EnvSchema = z.object({
    OPENAI_API_KEY: z.string(),
    SLACK_SIGNING_SECRET: z.string(),
    SLACK_BOT_TOKEN: z.string(),
    SLACK_APP_TOKEN: z.string().optional(),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_SECRET_TOKEN: z.string().optional(),
    TEAMS_APP_ID: z.string().optional(),
    TEAMS_APP_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema> & {
    PERSONAS: KVNamespace;
};
