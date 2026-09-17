// Polyfill Svelte 5 $state rune for standalone test execution
if (typeof (globalThis as any).$state === 'undefined') {
	(globalThis as any).$state = (init: any) => init;
}

// Mock window and sessionStorage / localStorage
const mockStorage: Record<string, string> = {};
(globalThis as any).window = {
	location: { protocol: 'https:', host: 'localhost:8788' }
};
(globalThis as any).sessionStorage = {
	getItem: (k: string) => mockStorage[k] || null,
	setItem: (k: string, v: string) => {
		mockStorage[k] = v;
	}
};
(globalThis as any).localStorage = {
	getItem: (k: string) => mockStorage[k] || null,
	setItem: (k: string, v: string) => {
		mockStorage[k] = v;
	}
};

class MockWebSocket {
	static readonly OPEN = 1;
	static readonly CLOSED = 3;
	static instances: MockWebSocket[] = [];
	readyState = MockWebSocket.OPEN;
	sentMessages: string[] = [];
	onopen: (() => void) | null = null;
	onmessage: ((e: { data: string }) => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: (() => void) | null = null;

	constructor(public url: string) {
		MockWebSocket.instances.push(this);
	}

	send(data: string) {
		this.sentMessages.push(data);
	}

	close() {
		this.readyState = 3; // WebSocket.CLOSED
		this.onclose?.();
	}
}

(globalThis as any).WebSocket = MockWebSocket;

import { RoomSocket } from '../src/lib/client/websocket.svelte';

async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPresenceQuotaTests() {
	console.log('--- Testing Free-Tier Presence Quota Optimizations ---');

	// 1. Initialize RoomSocket
	const socket = new RoomSocket('test-room-quota');
	const mockWs = MockWebSocket.instances[0];

	// Simulate socket open
	mockWs.onopen?.();

	// Verify initial presence registration message was sent
	if (mockWs.sentMessages.length !== 1) {
		throw new Error(
			`Expected exactly 1 initial presence message on open, got ${mockWs.sentMessages.length}`
		);
	}
	const initialMsg = JSON.parse(mockWs.sentMessages[0]);
	if (initialMsg.type !== 'presence:update') {
		throw new Error(`Expected presence:update, got ${initialMsg.type}`);
	}
	console.log('PASSED: Initial registration presence sent on open');

	// Clear sent messages to track cursor movements
	mockWs.sentMessages = [];

	// 2. Solo Room Test: moving cursor should NOT send WebSocket messages
	for (let i = 0; i < 50; i++) {
		socket.sendPresence({ x: 100 + i * 5, y: 150 + i * 5 }, []);
		await sleep(10);
	}
	await sleep(100);

	if (mockWs.sentMessages.length !== 0) {
		throw new Error(
			`Solo room suppression failed: expected 0 sent messages while alone in room, got ${mockWs.sentMessages.length}`
		);
	}
	console.log('PASSED: Solo room successfully suppressed 50 continuous cursor frames (0 sent)');

	// 3. Peer joins: peer receives presence broadcast, socket sends pending presence once
	mockWs.onmessage?.({
		data: JSON.stringify({
			type: 'presence:peer',
			userId: 'peer-bob',
			name: 'Bob',
			color: '#10b981',
			cursor: { x: 200, y: 300 },
			selectedIds: []
		})
	});

	if (mockWs.sentMessages.length !== 1) {
		throw new Error(
			`Expected 1 immediate presence transmission when peer joined, got ${mockWs.sentMessages.length}`
		);
	}
	const peerJoinReply = JSON.parse(mockWs.sentMessages[0]);
	if (peerJoinReply.type !== 'presence:update' || !peerJoinReply.cursor) {
		throw new Error('Expected peer join to transmit pending cursor position');
	}
	console.log('PASSED: Transmitted pending presence upon peer arrival');

	// Clear sent messages
	mockWs.sentMessages = [];

	// 4. Deadband test: tiny movements (< 2px) should NOT transmit
	socket.sendPresence({ x: peerJoinReply.cursor.x + 0.5, y: peerJoinReply.cursor.y + 0.5 }, []);
	await sleep(100);

	if (mockWs.sentMessages.length !== 0) {
		throw new Error('Deadband filter failed: micro-movement under 2px was transmitted');
	}
	console.log('PASSED: Deadband filter suppressed sub-2px cursor movement');

	// 5. Active collaboration movement (> 2px) should transmit at 15Hz
	socket.sendPresence({ x: 500, y: 500 }, []);
	await sleep(100);

	if (mockWs.sentMessages.length !== 1) {
		throw new Error(
			`Expected 1 transmission for significant movement, got ${mockWs.sentMessages.length}`
		);
	}
	console.log('PASSED: Active collaborator movement transmitted successfully');

	// Clear sent messages
	mockWs.sentMessages = [];

	// 6. Peer leaves: socket should revert to solo room suppression
	mockWs.onmessage?.({
		data: JSON.stringify({
			type: 'peer:left',
			userId: 'peer-bob'
		})
	});

	for (let i = 0; i < 20; i++) {
		socket.sendPresence({ x: 600 + i * 10, y: 600 + i * 10 }, []);
		await sleep(10);
	}
	await sleep(100);

	if (mockWs.sentMessages.length !== 0) {
		throw new Error('Suppression failed after peer left: transmitted frames while alone again');
	}
	console.log('PASSED: Reverted to solo suppression after peer left (0 sent)');

	socket.destroy();
	console.log('PASSED: All Free-Tier Quota Optimizations verified successfully!\n');
}

runPresenceQuotaTests().catch((err) => {
	console.error(err);
	process.exit(1);
});
