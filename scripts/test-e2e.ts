const PORT = 8789;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runE2ETest() {
	console.log('--- Starting Full End-to-End Verification ---');

	// Wait for server
	let serverUp = false;
	for (let i = 0; i < 20; i++) {
		try {
			const res = await fetch(`${BASE_URL}/`);
			if (res.status >= 200 && res.status < 500) {
				serverUp = true;
				break;
			}
		} catch {
			await sleep(500);
		}
	}
	if (!serverUp) {
		console.error('Server failed to start');
		process.exit(1);
	}

	// 1. Verify Landing Page
	console.log('\n[1] Testing Landing Page: GET /');
	const homeRes = await fetch(`${BASE_URL}/`);
	const homeHtml = await homeRes.text();
	if (homeRes.status !== 200 || !homeHtml.includes('CanvasSync')) {
		throw new Error(`Landing page check failed. Status: ${homeRes.status}`);
	}
	console.log('PASSED: Landing page rendered with CanvasSync branding.');

	// 2. Verify Room Page SSR Shell
	console.log('\n[2] Testing Whiteboard Room Page: GET /room/board-alpha');
	const roomRes = await fetch(`${BASE_URL}/room/board-alpha`);
	const roomHtml = await roomRes.text();
	if (roomRes.status !== 200 || !roomHtml.includes('board-alpha')) {
		throw new Error(`Room page check failed. Status: ${roomRes.status}`);
	}
	console.log('PASSED: Room page shell rendered successfully.');

	// 3. Verify WebSocket Connection to that Room
	console.log('\n[3] Testing Real-Time Sync on Room: ws://.../api/room/board-alpha/ws');
	const ws = new WebSocket(`ws://127.0.0.1:${PORT}/api/room/board-alpha/ws`);
	const messages: any[] = [];
	ws.onmessage = (e) => messages.push(JSON.parse(e.data.toString()));

	await new Promise<void>((resolve, reject) => {
		ws.onopen = () => resolve();
		ws.onerror = reject;
	});

	await sleep(200);
	const init = messages.find((m) => m.type === 'sync:init');
	if (!init || init.roomId !== 'board-alpha') {
		throw new Error('sync:init not received for board-alpha');
	}
	console.log('PASSED: Received sync:init for board-alpha.');

	// 4. Create and commit vector shapes
	console.log('\n[4] Committing vector shapes (pen stroke, rectangle, sticky note)...');
	const testShapes = [
		{
			id: 'pen-stroke-1',
			type: 'path',
			x: 100,
			y: 100,
			width: 50,
			height: 50,
			stroke: '#6366f1',
			strokeWidth: 3,
			data: {
				points: [
					{ x: 100, y: 100 },
					{ x: 125, y: 125 },
					{ x: 150, y: 150 }
				]
			},
			updatedAt: Date.now()
		},
		{
			id: 'rect-1',
			type: 'rectangle',
			x: 200,
			y: 200,
			width: 120,
			height: 80,
			stroke: '#10b981',
			fill: 'transparent',
			strokeWidth: 2,
			updatedAt: Date.now()
		},
		{
			id: 'note-1',
			type: 'sticky_note',
			x: 400,
			y: 200,
			width: 140,
			height: 140,
			stroke: '#eab308',
			fill: '#fef08a',
			strokeWidth: 1,
			data: { text: 'Architecture Plan' },
			updatedAt: Date.now()
		}
	];

	ws.send(JSON.stringify({ type: 'shape:upsert', shapes: testShapes }));
	await sleep(300);

	const upserted = messages.find((m) => m.type === 'shapes:upserted');
	if (!upserted || upserted.shapes.length !== 3) {
		throw new Error('Shapes upsert not acknowledged');
	}
	console.log('PASSED: Shapes acknowledged and broadcasted.');

	// 5. Reconnect to confirm persistence
	ws.close();
	await sleep(200);

	const wsReconnect = new WebSocket(`ws://127.0.0.1:${PORT}/api/room/board-alpha/ws`);
	const reconnectMessages: any[] = [];
	wsReconnect.onmessage = (e) => reconnectMessages.push(JSON.parse(e.data.toString()));

	await new Promise<void>((resolve, reject) => {
		wsReconnect.onopen = () => resolve();
		wsReconnect.onerror = reject;
	});

	await sleep(200);
	const rehydrated = reconnectMessages.find((m) => m.type === 'sync:init');
	if (!rehydrated || rehydrated.shapes.length !== 3) {
		throw new Error('Rehydrated shapes count mismatch');
	}
	console.log('PASSED: Reconnection verified all 3 shapes persisted in SQLite!');

	wsReconnect.close();
	console.log('\n========================================');
	console.log('🎉 ALL END-TO-END VERIFICATIONS PASSED!');
	console.log('========================================\n');
	process.exit(0);
}

runE2ETest().catch((err) => {
	console.error('E2E Test FAILED:', err);
	process.exit(1);
});
