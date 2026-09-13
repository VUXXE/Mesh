const PORT = 8788;
const BASE = `http://127.0.0.1:${PORT}`;
const WS_BASE = `ws://127.0.0.1:${PORT}`;

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function connect(room: string): Promise<{ ws: WebSocket; messages: any[] }> {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(`${WS_BASE}/api/room/${room}/ws`);
		const messages: any[] = [];
		ws.onmessage = (e) => {
			try {
				messages.push(JSON.parse(e.data.toString()));
			} catch {
				/* ignore */
			}
		};
		ws.onopen = () => resolve({ ws, messages });
		ws.onerror = () => reject(new Error('connect failed'));
	});
}

function waitFor(messages: any[], type: string, timeout = 5000): Promise<any> {
	return new Promise((resolve, reject) => {
		const start = Date.now();
		const timer = setInterval(() => {
			const found = messages.find((m) => m.type === type);
			if (found) {
				clearInterval(timer);
				resolve(found);
			} else if (Date.now() - start > timeout) {
				clearInterval(timer);
				reject(new Error(`timeout waiting for ${type}`));
			}
		}, 50);
	});
}

function assert(cond: boolean, label: string) {
	if (!cond) {
		console.error(`FAILED: ${label}`);
		process.exit(1);
	}
	console.log(`ok: ${label}`);
}

async function main() {
	const room = `room-pw-${Date.now()}`;

	// 1. Fresh room: open, no password required
	const a = await connect(room);
	const initA = await waitFor(a.messages, 'sync:init');
	assert(initA.requiresPassword !== true, 'fresh room has no password gate');

	// 2. Set password
	a.ws.send(JSON.stringify({ type: 'room:set_password', password: 'secret123' }));
	const pwSet = await waitFor(a.messages, 'room:password_set');
	assert(!!pwSet, 'setter receives room:password_set');

	// 3. Setter can still mutate (authed)
	a.ws.send(
		JSON.stringify({
			type: 'shape:upsert',
			shapes: [
				{
					id: 's1',
					type: 'rectangle',
					x: 1,
					y: 1,
					width: 10,
					height: 10,
					updatedAt: Date.now()
				}
			]
		})
	);
	const echoed = await waitFor(a.messages, 'shapes:upserted');
	assert(
		echoed.shapes.some((s: any) => s.id === 's1'),
		'authed setter mutation applied'
	);

	// 4. New joiner gets locked init with no content
	const b = await connect(room);
	const initB = await waitFor(b.messages, 'sync:init');
	assert(initB.requiresPassword === true, 'joiner sees requiresPassword');
	assert(initB.shapes.length === 0, 'joiner gets no shapes before auth');

	// 5. Unauthed mutation is dropped (no echo within window)
	b.ws.send(
		JSON.stringify({
			type: 'shape:upsert',
			shapes: [
				{ id: 'evil', type: 'rectangle', x: 0, y: 0, width: 5, height: 5, updatedAt: Date.now() }
			]
		})
	);
	await sleep(800);
	assert(!b.messages.some((m) => m.type === 'shapes:upserted'), 'unauthed mutation dropped');

	// 6. Wrong password rejected
	b.ws.send(JSON.stringify({ type: 'room:auth', password: 'wrong' }));
	await waitFor(b.messages, 'room:auth_failed');
	assert(true, 'wrong password rejected');

	// 7. Correct password unlocks with full content
	b.ws.send(JSON.stringify({ type: 'room:auth', password: 'secret123' }));
	await waitFor(b.messages, 'room:auth_ok');
	// Poll for the unlocked full sync:init (requiresPassword absent)
	let unlocked: any = null;
	for (let i = 0; i < 100 && !unlocked; i++) {
		unlocked = b.messages.find((m) => m.type === 'sync:init' && !m.requiresPassword);
		if (!unlocked) await sleep(50);
	}
	assert(!!unlocked, 'authed joiner receives full sync:init');
	assert(
		unlocked.shapes.some((s: any) => s.id === 's1'),
		'full sync contains existing shapes'
	);
	assert(!unlocked.shapes.some((s: any) => s.id === 'evil'), 'dropped shape never persisted');

	a.ws.close();
	b.ws.close();
	console.log('PASSED: Room password auth flow verified!');
}

main().catch((e) => {
	console.error('FAILED:', e.message);
	process.exit(1);
});
