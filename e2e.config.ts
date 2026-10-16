import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';

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
	]
} satisfies E2EConfig;
