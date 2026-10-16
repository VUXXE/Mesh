// Ported from scripts/test-handshake.ts
import http from 'node:http';
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

function rawGet(urlStr: string, headers: Record<string, string> = {}): Promise<{ status: number }> {
	return new Promise((resolve, reject) => {
		const u = new URL(urlStr);
		const req = http.request(
			{
				hostname: u.hostname,
				port: u.port,
				path: u.pathname + u.search,
				headers,
				method: 'GET'
			},
			(res) => {
				resolve({ status: res.statusCode ?? 0 });
			}
		);
		req.on('error', reject);
		req.end();
	});
}

test('WebSocket Handshake & Edge Validation (HTTP 400, 426, 101)', async ({ app }) => {
	const rawBase = app.baseUrl ?? 'http://127.0.0.1:4173';
	const httpBase = rawBase.replace(/\/+$/, '').replace('localhost', '127.0.0.1');
	const wsBase = httpBase.replace(/^http/, 'ws');

	// Test 1: Invalid room ID with Upgrade header -> Expect 400
	const resInvalid = await rawGet(`${httpBase}/api/room/bad!id/ws`, {
		Upgrade: 'websocket',
		Connection: 'Upgrade'
	});
	expect(resInvalid.status).toBe(400);

	// Test 2: Valid room ID without Upgrade header -> Expect 426
	const resNoUpgrade = await rawGet(`${httpBase}/api/room/test-room/ws`);
	expect(resNoUpgrade.status).toBe(426);

	// Test 3: Valid room ID with WebSocket handshake -> Expect 101 and sync:init
	const ws = new WebSocket(`${wsBase}/api/room/test-room/ws`);
	const messages: any[] = [];
	ws.onmessage = (e) => messages.push(JSON.parse(e.data.toString()));

	await new Promise<void>((resolve, reject) => {
		ws.onopen = () => resolve();
		ws.onerror = (err) => reject(new Error('WebSocket handshake failed'));
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
	expect(init.roomId).toBe('test-room');
	expect(Array.isArray(init.shapes)).toBe(true);

	ws.close();
});
