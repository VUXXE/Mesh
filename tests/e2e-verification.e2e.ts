// Ported from scripts/test-e2e.ts
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('Full End-to-End Verification (Landing, Room SSR, WebSocket, Persistence)', async ({
	app,
	browser
}) => {
	// 1. Verify Landing Page: GET /
	await app.open('/');
	await expect(browser.locator('body')).toBeVisible();
	await expect(browser.locator('body')).toContainText('Mesh');

	// 2. Verify Room Page SSR Shell: GET /room/board-alpha
	const roomId = `board-alpha-${Date.now()}`;
	await app.open(`/room/${roomId}`);
	await expect(browser.locator('body')).toBeVisible();
	await expect(browser.locator('body')).toContainText(roomId);
	await expect(browser.locator('canvas').first()).toBeVisible();
	await expect(browser.locator('body')).toContainText('Canvas is ready');

	// 3. Verify WebSocket Connection to that Room
	const rawBase = app.baseUrl ?? 'http://127.0.0.1:4173';
	const wsBase = rawBase
		.replace(/\/+$/, '')
		.replace(/^http/, 'ws')
		.replace('localhost', '127.0.0.1');
	const wsUrl = `${wsBase}/api/room/${roomId}/ws`;
	const ws = new WebSocket(wsUrl);
	const messages: any[] = [];
	ws.onmessage = (e) => messages.push(JSON.parse(e.data.toString()));

	await new Promise<void>((resolve, reject) => {
		ws.onopen = () => resolve();
		ws.onerror = (err: any) =>
			reject(
				new Error(`WebSocket error connecting to ${wsUrl}: ${err?.message || err?.type || 'error'}`)
			);
	});

	const init = await new Promise<any>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('Timed out waiting for sync:init')), 5000);
		const check = () => {
			const msg = messages.find((m) => m.type === 'sync:init');
			if (msg) {
				clearTimeout(timer);
				resolve(msg);
			} else {
				setTimeout(check, 50);
			}
		};
		check();
	});

	expect(init).toBeDefined();
	expect(init.roomId).toBe(roomId);

	// 4. Create and commit vector shapes
	const testShapes = [
		{
			id: `pen-stroke-${Date.now()}`,
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
			id: `rect-${Date.now()}`,
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
			id: `note-${Date.now()}`,
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

	const upserted = await new Promise<any>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error('Timed out waiting for shapes:upserted')),
			5000
		);
		const check = () => {
			const msg = messages.find((m) => m.type === 'shapes:upserted');
			if (msg) {
				clearTimeout(timer);
				resolve(msg);
			} else {
				setTimeout(check, 50);
			}
		};
		check();
	});

	expect(upserted).toBeDefined();
	expect(upserted.shapes.length).toBe(3);

	// 5. Reconnect to confirm persistence
	ws.close();

	const wsReconnect = new WebSocket(wsUrl);
	const reconnectMessages: any[] = [];
	wsReconnect.onmessage = (e) => reconnectMessages.push(JSON.parse(e.data.toString()));

	await new Promise<void>((resolve, reject) => {
		wsReconnect.onopen = () => resolve();
		wsReconnect.onerror = (err: any) =>
			reject(new Error(`Reconnect WebSocket error: ${err?.message || err?.type || 'error'}`));
	});

	const rehydrated = await new Promise<any>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error('Timed out waiting for rehydrated sync:init')),
			5000
		);
		const check = () => {
			const msg = reconnectMessages.find((m) => m.type === 'sync:init');
			if (msg) {
				clearTimeout(timer);
				resolve(msg);
			} else {
				setTimeout(check, 50);
			}
		};
		check();
	});

	expect(rehydrated).toBeDefined();
	expect(rehydrated.shapes.length).toBe(3);

	wsReconnect.close();
});
