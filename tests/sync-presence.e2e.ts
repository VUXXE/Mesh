// Ported from scripts/test-sync-and-presence.ts
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

test('Real-Time Sync, Presence Broadcast, and LWW Monotonic Clock', async ({ app }) => {
	const rawBase = app.baseUrl ?? 'http://127.0.0.1:4173';
	const wsBase = rawBase
		.replace(/\/+$/, '')
		.replace(/^http/, 'ws')
		.replace('localhost', '127.0.0.1');
	const roomName = `room-sync-${Date.now()}`;
	const wsUrl = `${wsBase}/api/room/${roomName}/ws`;

	// 1. Connect Client A
	const wsA = new WebSocket(wsUrl);
	const messagesA: any[] = [];
	wsA.onmessage = (e) => messagesA.push(JSON.parse(e.data.toString()));

	await new Promise<void>((resolve, reject) => {
		wsA.onopen = () => resolve();
		wsA.onerror = () => reject(new Error('wsA connect failed'));
	});

	await sleep(200);
	const initA = messagesA.find((m) => m.type === 'sync:init');
	expect(initA).toBeDefined();
	expect(initA.shapes.length).toBe(0);

	// 2. Client A sends presence
	wsA.send(
		JSON.stringify({
			type: 'presence:update',
			userId: 'user-a',
			name: 'Alice',
			color: '#ff0000',
			cursor: { x: 120, y: 240 },
			selectedIds: []
		})
	);
	await sleep(200);

	// 3. Connect Client B
	const wsB = new WebSocket(wsUrl);
	const messagesB: any[] = [];
	wsB.onmessage = (e) => messagesB.push(JSON.parse(e.data.toString()));

	await new Promise<void>((resolve, reject) => {
		wsB.onopen = () => resolve();
		wsB.onerror = () => reject(new Error('wsB connect failed'));
	});

	await sleep(200);
	const initB = messagesB.find((m) => m.type === 'sync:init');
	expect(initB).toBeDefined();
	const peerAlice = initB.peers.find((p: any) => p.userId === 'user-a');
	expect(peerAlice).toBeDefined();
	expect(peerAlice.cursor?.x).toBe(120);

	// 4. Client B updates presence -> Client A receives presence:peer
	wsB.send(
		JSON.stringify({
			type: 'presence:update',
			userId: 'user-b',
			name: 'Bob',
			color: '#0000ff',
			cursor: { x: 300, y: 400 },
			selectedIds: []
		})
	);
	await sleep(200);

	const peerBob = messagesA.find((m) => m.type === 'presence:peer' && m.userId === 'user-b');
	expect(peerBob).toBeDefined();
	expect(peerBob.cursor?.x).toBe(300);

	// 5. LWW conflict resolution: Shape upsert
	const shapeV1 = {
		id: 'shape-lww-1',
		type: 'rectangle',
		x: 50,
		y: 50,
		width: 100,
		height: 100,
		updatedAt: 1000
	};
	wsA.send(JSON.stringify({ type: 'shape:upsert', shapes: [shapeV1] }));
	await sleep(200);

	const upsert1 = messagesB.find((m) => m.type === 'shapes:upserted');
	expect(upsert1).toBeDefined();
	expect(upsert1.shapes[0].id).toBe('shape-lww-1');

	// Stale write (older timestamp) should be dropped by monotonic LWW
	const shapeStale = {
		id: 'shape-lww-1',
		type: 'rectangle',
		x: 999,
		y: 999,
		width: 100,
		height: 100,
		updatedAt: 500
	};
	wsB.send(JSON.stringify({ type: 'shape:upsert', shapes: [shapeStale] }));
	await sleep(200);

	// No new upsert broadcast for stale write
	const staleUpserts = messagesA.filter(
		(m) => m.type === 'shapes:upserted' && m.shapes[0].x === 999
	);
	expect(staleUpserts.length).toBe(0);

	wsA.close();
	wsB.close();
});
