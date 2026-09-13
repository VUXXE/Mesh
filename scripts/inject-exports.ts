import fs from 'node:fs';
import path from 'node:path';

const workerPath = path.resolve('.svelte-kit/cloudflare/_worker.js');

if (fs.existsSync(workerPath)) {
	const content = fs.readFileSync(workerPath, 'utf8');
	if (!content.includes('WhiteboardRoom')) {
		fs.appendFileSync(
			workerPath,
			`\nexport { WhiteboardRoom } from '../../src/lib/server/room-do.ts';\n`
		);
		console.log(
			'Successfully injected WhiteboardRoom export into .svelte-kit/cloudflare/_worker.js'
		);
	}
} else {
	console.warn('Worker file not found at', workerPath);
}
