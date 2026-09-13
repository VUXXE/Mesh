const PORT = 8788;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
	console.log('--- Starting Sync, Presence, LWW, and Guardrails Tests ---');

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

	const roomName = `room-${Date.now()}`;
	console.log(`Using room: ${roomName}`);

	// 1. Connect Client A
	const wsA = new WebSocket(`ws://127.0.0.1:${PORT}/api/room/${roomName}/ws`);
	const messagesA: any[] = [];
	wsA.onmessage = (e) => messagesA.push(JSON.parse(e.data.toString()));

	await new Promise<void>((resolve, reject) => {
		wsA.onopen = () => resolve();
		wsA.onerror = reject;
	});

	await sleep(200);
	const initA = messagesA.find((m) => m.type === 'sync:init');
	if (!initA || initA.shapes.length !== 0) {
		throw new Error('Client A did not receive empty sync:init');
	}
	console.log('PASSED: Client A connected and received sync:init');

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
	const wsB = new WebSocket(`ws://127.0.0.1:${PORT}/api/room/${roomName}/ws`);
	const messagesB: any[] = [];
	wsB.onmessage = (e) => messagesB.push(JSON.parse(e.data.toString()));

	await new Promise<void>((resolve, reject) => {
		wsB.onopen = () => resolve();
		wsB.onerror = reject;
	});

	await sleep(200);
	const initB = messagesB.find((m) => m.type === 'sync:init');
	if (!initB) throw new Error('Client B did not receive sync:init');
	const peerAlice = initB.peers.find((p: any) => p.userId === 'user-a');
	if (!peerAlice || peerAlice.cursor?.x !== 120) {
		throw new Error('Client B sync:init did not contain Alice presence');
	}
	console.log('PASSED: Client B received sync:init with existing Alice presence');

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
	if (!peerBob || peerBob.cursor?.x !== 300) {
		throw new Error('Client A did not receive Bob presence:peer');
	}
	console.log('PASSED: Client A received Bob presence broadcast');

	// 5. Client A creates shape with timestamp 1000
	wsA.send(
		JSON.stringify({
			type: 'shape:upsert',
			shapes: [
				{
					id: 'shape-1',
					type: 'rectangle',
					x: 10,
					y: 20,
					width: 100,
					height: 50,
					fill: '#ffffff',
					stroke: '#000000',
					strokeWidth: 2,
					updatedAt: 1000
				}
			]
		})
	);

	await sleep(200);
	const upsert1 = messagesB.find(
		(m) => m.type === 'shapes:upserted' && m.shapes[0]?.id === 'shape-1'
	);
	if (!upsert1 || upsert1.shapes[0].x !== 10) {
		throw new Error('Client B did not receive shape-1 upsert');
	}
	console.log('PASSED: Shape upsert broadcast to Client B');

	// 6. Monotonic LWW: Client B sends stale update with timestamp 900 (older than 1000)
	messagesA.length = 0;
	messagesB.length = 0;
	wsB.send(
		JSON.stringify({
			type: 'shape:upsert',
			shapes: [
				{
					id: 'shape-1',
					type: 'rectangle',
					x: 999,
					y: 999,
					updatedAt: 900
				}
			]
		})
	);

	await sleep(200);
	if (messagesA.some((m) => m.type === 'shapes:upserted')) {
		throw new Error('Stale write was not rejected by LWW');
	}
	console.log('PASSED: Stale write was silently dropped by LWW');

	// 7. Newer write: Client B sends update with timestamp 2000
	wsB.send(
		JSON.stringify({
			type: 'shape:upsert',
			shapes: [
				{
					id: 'shape-1',
					type: 'rectangle',
					x: 50,
					y: 60,
					width: 100,
					height: 50,
					updatedAt: 2000
				}
			]
		})
	);

	await sleep(200);
	const upsert2 = messagesA.find(
		(m) => m.type === 'shapes:upserted' && m.shapes[0]?.id === 'shape-1'
	);
	if (!upsert2 || upsert2.shapes[0].x !== 50) {
		throw new Error('Client A did not receive shape-1 updated write');
	}
	console.log('PASSED: Newer write won LWW and broadcasted');

	// 8. Client A disconnects -> Client B receives peer:left
	wsA.close();
	await sleep(200);
	const peerLeft = messagesB.find((m) => m.type === 'peer:left' && m.userId === 'user-a');
	if (!peerLeft) {
		throw new Error('Client B did not receive peer:left for Alice');
	}
	console.log('PASSED: Client B received peer:left for Alice');

	// 9. Reconnect Client C -> Verify persistence in SQLite
	const wsC = new WebSocket(`ws://127.0.0.1:${PORT}/api/room/${roomName}/ws`);
	const messagesC: any[] = [];
	wsC.onmessage = (e) => messagesC.push(JSON.parse(e.data.toString()));

	await new Promise<void>((resolve, reject) => {
		wsC.onopen = () => resolve();
		wsC.onerror = reject;
	});

	await sleep(200);
	const initC = messagesC.find((m) => m.type === 'sync:init');
	if (!initC || initC.shapes.length !== 1 || initC.shapes[0].x !== 50) {
		throw new Error('Client C did not receive persisted shape state from SQLite');
	}
	console.log('PASSED: Client C rehydrated persisted state from SQLite');

	// 10. Test Frame > 64KB Guard (PRD §2, §9.2 -> CloseCode 1009)
	console.log('\nTesting 64KB frame size guard:');
	const hugePayload = 'A'.repeat(70000);
	const closeCodePromise = new Promise<number>((resolve) => {
		wsC.onclose = (e) => resolve(e.code);
	});
	wsC.send(hugePayload);
	const closeCode = await closeCodePromise;
	if (closeCode !== 1009) {
		throw new Error(`Expected close code 1009 for >64KB frame, got ${closeCode}`);
	}
	console.log('PASSED: Server rejected >64KB frame with code 1009');

	wsB.close();
	console.log('\n--- ALL TESTS PASSED SUCCESSFULLY! ---');
	process.exit(0);
}

runTests().catch((err) => {
	console.error('Test FAILED:', err);
	process.exit(1);
});
