import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { DatabaseSync } from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';

function getApiKey(): string {
	if (process.env.OMNIROUTE_API_KEY) return process.env.OMNIROUTE_API_KEY;
	if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
	try {
		const dbPath = path.join(os.homedir(), '.omniroute', 'storage.sqlite');
		const db = new DatabaseSync(dbPath);
		const row = db.prepare('SELECT key FROM api_keys WHERE is_active = 1 LIMIT 1;').get() as
			{ key?: string } | undefined;
		return row?.key || '';
	} catch {
		return '';
	}
}

const omniroute = createOpenAICompatible({
	name: 'omniroute',
	baseURL: process.env.OMNIROUTE_BASE_URL ?? 'http://localhost:20128/v1',
	headers: {
		Authorization: `Bearer ${getApiKey()}`
	}
});

export default {
	targets: [
		{
			engine: web(),
			app: {
				url: process.env.APP_URL ?? 'http://127.0.0.1:4173',
				command: {
					executable: 'bun',
					args: ['run', 'start'],
					reuseExisting: true,
					log: '.e2e/logs/app.log'
				}
			}
		}
	],
	agents: {
		default: {
			model: omniroute('antigravity/gemini-3.5-flash-lite'),
			context:
				'Mesh is a real-time collaborative whiteboard application with a canvas, toolbar for tools (select, rectangle, ellipse, sticky note, arrow, line, pen, text), and a properties panel.'
		}
	}
} satisfies E2EConfig;
