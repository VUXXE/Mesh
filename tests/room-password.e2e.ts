// Ported from scripts/test-room-password.ts
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function connect(wsBase: string, room: string): Promise<{ ws: WebSocket; messages: any[] }> {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(`${wsBase}/api/room/${room}/ws`);
		const messages: any[] = [];
		ws.onmessage = (e) => {
			try {
				messages.push(JSON.parse(e.data.toString()));
			} catch {
				/* ignore */
			}
		};
		ws.onopen = () => resolve({ ws, messages });
		ws.onerror = () => reject(new Error('WebSocket connect failed'));
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

test('Room Password Protection, PBKDF2 Gate, Auth Failure & Content Unlock', async ({ app }) => {
	const rawBase = app.baseUrl ?? 'http://127.0.0.1:4173';
	const wsBase = rawBase
		.replace(/\/+$/, '')
		.replace(/^http/, 'ws')
		.replace('localhost', '127.0.0.1');
	const room = `room-pw-${Date.now()}`;

	// 1. Fresh room: open, no password required
	const a = await connect(wsBase, room);
	const initA = await waitFor(a.messages, 'sync:init');
	expect(initA.requiresPassword).not.toBe(true);

	// 2. Set password
	a.ws.send(JSON.stringify({ type: 'room:set_password', password: 'secret123' }));
	const pwSet = await waitFor(a.messages, 'room:password_set');
	expect(pwSet).toBeDefined();

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
	expect(echoed.shapes.some((s: any) => s.id === 's1')).toBe(true);

	// 4. New joiner gets locked init with no content
	const b = await connect(wsBase, room);
	const initB = await waitFor(b.messages, 'sync:init');
	expect(initB.requiresPassword).toBe(true);
	expect(initB.shapes.length).toBe(0);

	// 5. Unauthed mutation is dropped
	b.ws.send(
		JSON.stringify({
			type: 'shape:upsert',
			shapes: [
				{ id: 'evil', type: 'rectangle', x: 0, y: 0, width: 5, height: 5, updatedAt: Date.now() }
			]
		})
	);
	await sleep(500);
	expect(b.messages.some((m) => m.type === 'shapes:upserted')).toBe(false);

	// 6. Wrong password rejected
	b.ws.send(JSON.stringify({ type: 'room:auth', password: 'wrong' }));
	const authFailed = await waitFor(b.messages, 'room:auth_failed');
	expect(authFailed).toBeDefined();

	// 7. Correct password unlocks with full content
	b.ws.send(JSON.stringify({ type: 'room:auth', password: 'secret123' }));
	const authOk = await waitFor(b.messages, 'room:auth_ok');
	expect(authOk).toBeDefined();

	// Poll for unlocked full sync:init (requiresPassword absent)
	let unlocked: any = null;
	for (let i = 0; i < 50 && !unlocked; i++) {
		unlocked = b.messages.find((m) => m.type === 'sync:init' && !m.requiresPassword);
		if (!unlocked) await sleep(50);
	}
	expect(unlocked).toBeDefined();
	expect(unlocked.shapes.some((s: any) => s.id === 's1')).toBe(true);
	expect(unlocked.shapes.some((s: any) => s.id === 'evil')).toBe(false);

	a.ws.close();
	b.ws.close();
});
