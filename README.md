# Antigravity Connectors Chat Test

This project is a multi-platform AI agent system built with Cloudflare Workers, Hono, and the Vercel AI SDK. It currently features a Slack bot integration using Socket Mode.

## Features

*   **Multi-Agent System**:
    *   **Market Analysis Agent**: Generates detailed market reports (SWOT, PESTLE, etc.).
    *   **Buyer Persona Agent**: Creates and simulates buyer personas.
    *   **Pricing Agent**: Suggests pricing strategies.
*   **Slack Integration**:
    *   Real-time messaging via Socket Mode.
    *   **Slack Canvas Support**: Automatically creates rich markdown documents (Canvases) for detailed reports and shares them in the channel.
    *   Robust error handling and user notifications.
*   **Tech Stack**:
    *   [Cloudflare Workers](https://workers.cloudflare.com/)
    *   [Hono](https://hono.dev/)
    *   [Vercel AI SDK](https://sdk.vercel.ai/docs)
    *   TypeScript

## Prerequisites

*   Node.js (v18 or later)
*   npm
*   A Slack App with Socket Mode enabled.

## Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...

# Optional: Other platforms
TELEGRAM_BOT_TOKEN=...
TEAMS_APP_ID=...
```

### Slack App Permissions
Your Slack app needs the following scopes:
*   `app_mentions:read`
*   `chat:write`
*   `im:history`
*   `im:write`
*   `canvases:read`
*   `canvases:write`

## Running the Bot

To run the Slack bot in local development mode (Socket Mode):

```bash
npm run dev:slack
```

The bot will connect to Slack and listen for events. You can DM the bot or mention it in a channel.

## Testing

To run the included test suite (verifies error handling):

```bash
npm test
```

## Project Structure

*   `src/agents/`: AI Agent definitions (Market, Persona, Pricing).
*   `src/lib/`: Platform-specific logic (Slack, Telegram, Teams) and the Agent Dispatcher.
*   `src/socket-mode.ts`: Entry point for the local Slack Socket Mode client.
*   `src/index.ts`: Cloudflare Worker entry point (for webhooks).
