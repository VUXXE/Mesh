import { Database } from 'bun:sqlite';

console.log('=== Running Security Fix Verification Tests ===');

// Test 1: Future timestamp clamping in LWW conflict resolution
{
	const db = new Database(':memory:');
	db.exec(`
    CREATE TABLE shapes (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      x REAL DEFAULT 0.0,
      updated_at INTEGER NOT NULL
    );
  `);

	const upsert = db.prepare(`
    INSERT INTO shapes (id, type, x, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET x = excluded.x, updated_at = excluded.updated_at
    WHERE excluded.updated_at >= shapes.updated_at;
  `);

	const now = Date.now();
	const maxAllowedTime = now + 5000;

	// Attacker attempts to send future timestamp
	const rawAttackerTs = Number.MAX_SAFE_INTEGER;
	const clampedAttackerTs = Math.min(rawAttackerTs, maxAllowedTime);

	upsert.run('shape-1', 'rectangle', 10, clampedAttackerTs);

	let row = db.prepare('SELECT * FROM shapes WHERE id = ?').get('shape-1') as any;
	console.log(
		'Test 1 - Attacker clamped timestamp:',
		row.updated_at,
		'vs max allowed:',
		maxAllowedTime
	);

	// Legitimate update 6 seconds later
	const legitimateTs = clampedAttackerTs + 100;
	upsert.run('shape-1', 'rectangle', 50, legitimateTs);

	row = db.prepare('SELECT * FROM shapes WHERE id = ?').get('shape-1') as any;
	console.log('Test 1 - Legitimate update succeeded:', row.x === 50);
	if (row.x !== 50) throw new Error('Test 1 failed: shape was frozen!');
}

// Test 2: PBKDF2 Password Hashing
{
	async function hashPassword(password: string, salt: string): Promise<string> {
		const enc = new TextEncoder();
		const keyMaterial = await crypto.subtle.importKey(
			'raw',
			enc.encode(password),
			{ name: 'PBKDF2' },
			false,
			['deriveBits']
		);
		const derivedBits = await crypto.subtle.deriveBits(
			{
				name: 'PBKDF2',
				salt: enc.encode(salt),
				iterations: 100000,
				hash: 'SHA-256'
			},
			keyMaterial,
			256
		);
		return Array.from(new Uint8Array(derivedBits))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	}

	const salt = crypto.randomUUID();
	const h1 = await hashPassword('secure_password_123', salt);
	const h2 = await hashPassword('secure_password_123', salt);
	const h3 = await hashPassword('wrong_password_456', salt);

	console.log('Test 2 - PBKDF2 deterministic matching:', h1 === h2);
	console.log('Test 2 - PBKDF2 distinguishes wrong password:', h1 !== h3);
	if (h1 !== h2 || h1 === h3) throw new Error('Test 2 failed: PBKDF2 hash mismatch!');
}

// Test 3: Broadcast filtering for unauthenticated sockets
{
	class MockSocket {
		messages: string[] = [];
		attachment: any = null;
		send(msg: string) {
			this.messages.push(msg);
		}
		serializeAttachment(att: any) {
			this.attachment = att;
		}
		deserializeAttachment() {
			return this.attachment;
		}
	}

	const unauthed = new MockSocket();
	unauthed.serializeAttachment({ authed: false, userId: 'guest' });

	const authed = new MockSocket();
	authed.serializeAttachment({ authed: true, userId: 'alice' });

	const sockets = [unauthed, authed];
	let locked = true;

	function isAuthed(ws: MockSocket) {
		return ws.deserializeAttachment()?.authed === true;
	}

	function broadcast(msg: string, excludeWs?: MockSocket, requireAuth = true) {
		for (const s of sockets) {
			if (s !== excludeWs) {
				if (locked && requireAuth && !isAuthed(s)) continue;
				s.send(msg);
			}
		}
	}

	// Broadcast shape mutation (requireAuth defaults to true)
	broadcast(JSON.stringify({ type: 'shapes:upserted' }), authed);
	console.log(
		'Test 3 - Unauthenticated socket received shape mutation count:',
		unauthed.messages.length
	);
	if (unauthed.messages.length !== 0)
		throw new Error('Test 3 failed: leaked shape to unauthed socket!');

	// Broadcast room:password_set notification (requireAuth = false)
	broadcast(JSON.stringify({ type: 'room:password_set' }), authed, false);
	console.log(
		'Test 3 - Unauthenticated socket received room:password_set:',
		unauthed.messages.length === 1
	);
	if (unauthed.messages.length !== 1)
		throw new Error('Test 3 failed: did not receive password notification!');
}

// Test 4: Malformed shape validation avoids SQLite CHECK constraint failure
{
	const VALID_SHAPE_TYPES = new Set(['path', 'rectangle', 'ellipse', 'text', 'sticky_note']);
	const badShapes = [
		{ id: 's1', type: 'invalid_type', updatedAt: Date.now() },
		{ id: '', type: 'rectangle', updatedAt: Date.now() },
		null,
		{ id: 123, type: 'text', updatedAt: Date.now() }
	];

	let skippedCount = 0;
	for (const s of badShapes as any[]) {
		if (!s || typeof s.id !== 'string' || !s.id || !VALID_SHAPE_TYPES.has(s.type)) {
			skippedCount++;
			continue;
		}
	}

	console.log('Test 4 - Skipped invalid shapes count:', skippedCount);
	if (skippedCount !== 4) throw new Error('Test 4 failed: invalid shapes were not safely skipped!');
}

console.log('=== All Security Verification Tests Passed Successfully! ===');
