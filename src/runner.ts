import { spawn } from 'child_process';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config();

const runCommand = (command: string, args: string[], name: string, color: string) => {
    console.log(`🚀 Starting ${name}...`);
    const child = spawn(command, args, {
        stdio: 'pipe',
        shell: true,
        env: { ...process.env, FORCE_COLOR: 'true' }
    });

    child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach((line: string) => {
            if (line.trim()) console.log(`${color}[${name}] ${line}\x1b[0m`);
        });
    });

    child.stderr.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach((line: string) => {
            if (line.trim()) console.error(`${color}[${name}] ${line}\x1b[0m`);
        });
    });

    child.on('close', (code) => {
        if (code !== 0 && code !== null) {
            console.error(`❌ ${name} exited with code ${code}`);
        }
    });

    return child;
};

import { ChildProcess } from 'child_process';

const start = async () => {
    const processes: ChildProcess[] = [];
    const colors = {
        slack: '\x1b[36m', // Cyan
        worker: '\x1b[33m', // Yellow
    };

    // 1. Slack Socket Mode (Default: true)
    // Can be disabled explicitly with SLACK_SOCKET_MODE=false
    const slackEnabled = process.env.SLACK_SOCKET_MODE !== 'false';

    if (slackEnabled) {
        if (!process.env.SLACK_APP_TOKEN) {
            console.warn('⚠️ SLACK_APP_TOKEN not found. Skipping Slack Socket Mode.');
        } else {
            processes.push(runCommand('npx', ['tsx', 'src/socket-mode.ts'], 'Slack', colors.slack));
        }
    }

    // 2. Webhooks / Worker (Telegram, Teams, etc.)
    // Enabled if explicit flag is set OR if Telegram/Teams tokens are present
    const webhooksEnabled = process.env.ENABLE_WEBHOOKS === 'true' ||
        !!process.env.TELEGRAM_BOT_TOKEN ||
        !!process.env.TEAMS_APP_ID;

    if (webhooksEnabled) {
        // We use wrangler dev to run the worker locally
        processes.push(runCommand('npx', ['wrangler', 'dev'], 'Worker', colors.worker));
    } else {
        console.log('ℹ️ Webhooks (Worker) not enabled. Set ENABLE_WEBHOOKS=true or add Telegram/Teams credentials to enable.');
    }

    // Handle exit
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        processes.forEach(p => p.kill());
        process.exit();
    });
};

start();
