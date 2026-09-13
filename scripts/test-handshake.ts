const PORT = 8787;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runTests() {
	console.log('--- Starting Handshake Verification Tests ---');

	// Wait for server to be up
	let serverUp = false;
	for (let i = 0; i < 20; i++) {
		try {
			const res = await fetch(`${BASE_URL}/`);
			if (res.status >= 200 && res.status < 500) {
				serverUp = true;
				break;
			}
		} catch {
			await new Promise((r) => setTimeout(r, 500));
		}
	}

	if (!serverUp) {
		console.error('Server failed to start in time');
		process.exit(1);
	}

	console.log('Server is responsive.');

	// Test 1: Invalid room ID -> Expect 400
	console.log('\n[Test 1] Testing invalid room ID: /api/room/bad!id/ws');
	const resInvalid = await fetch(`${BASE_URL}/api/room/bad!id/ws`, {
		headers: { Upgrade: 'websocket', Connection: 'Upgrade' }
	});
	console.log(`Status: ${resInvalid.status}`);
	if (resInvalid.status !== 400) {
		console.error(`FAILED: Expected 400, got ${resInvalid.status}`);
		process.exit(1);
	}
	console.log('PASSED: Correctly returned HTTP 400 for invalid room ID.');

	// Test 2: Valid room ID without Upgrade header -> Expect 426
	console.log('\n[Test 2] Testing missing Upgrade header: /api/room/test-room/ws');
	const resNoUpgrade = await fetch(`${BASE_URL}/api/room/test-room/ws`);
	console.log(`Status: ${resNoUpgrade.status}`);
	if (resNoUpgrade.status !== 426) {
		console.error(`FAILED: Expected 426, got ${resNoUpgrade.status}`);
		process.exit(1);
	}
	console.log('PASSED: Correctly returned HTTP 426 for missing Upgrade header.');

	// Test 3: Valid room ID with WebSocket handshake -> Expect 101 and sync:init
	console.log('\n[Test 3] Testing WebSocket upgrade: /api/room/test-room/ws');
	const ws = new WebSocket(`ws://127.0.0.1:${PORT}/api/room/test-room/ws`);

	const initReceived = await new Promise<boolean>((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error('Timed out waiting for sync:init'));
		}, 5000);

		ws.onopen = () => {
			console.log('WebSocket opened (HTTP 101 Handshake successful)!');
		};

		ws.onmessage = (event) => {
			clearTimeout(timer);
			try {
				const data = JSON.parse(event.data.toString());
				console.log('Received message type:', data.type);
				if (data.type === 'sync:init') {
					console.log('Room ID:', data.roomId);
					console.log('Shapes count:', data.shapes.length);
					console.log('Peers count:', data.peers.length);
					resolve(true);
				} else {
					reject(new Error(`Unexpected message type: ${data.type}`));
				}
			} catch (err) {
				reject(err);
			}
		};

		ws.onerror = (err) => {
			clearTimeout(timer);
			reject(err);
		};
	});

	ws.close();

	if (initReceived) {
		console.log('\nPASSED: Full WebSocket handshake and sync:init verified!');
	} else {
		console.error('\nFAILED: sync:init not verified.');
		process.exit(1);
	}

	console.log('\n--- All Phase 1 Edge Plumbing tests passed! ---');
	process.exit(0);
}

runTests().catch((err) => {
	console.error('Test error:', err);
	process.exit(1);
});
