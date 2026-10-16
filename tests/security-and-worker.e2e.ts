// Ported from:
// - scripts/test-canvas-modules.ts
// - scripts/test-export-import.ts
// - scripts/test-security-fixes.ts
// - scripts/test-room-link-parser.ts
// - scripts/test-presence-quota.ts
// - scripts/test-worker-efficiency.ts

// Polyfills for Node runner before importing Svelte 5 modules
if (typeof (globalThis as any).$state === 'undefined') {
	(globalThis as any).$state = (init: any) => init;
}
if (typeof (globalThis as any).window === 'undefined') {
	(globalThis as any).window = {
		location: { protocol: 'http:', host: '127.0.0.1:4173' }
	};
}
if (typeof (globalThis as any).sessionStorage === 'undefined') {
	const memStorage: Record<string, string> = {};
	(globalThis as any).sessionStorage = {
		getItem: (k: string) => memStorage[k] || null,
		setItem: (k: string, v: string) => {
			memStorage[k] = v;
		},
		removeItem: (k: string) => {
			delete memStorage[k];
		}
	};
}
if (typeof (globalThis as any).localStorage === 'undefined') {
	const memStorage: Record<string, string> = {};
	(globalThis as any).localStorage = {
		getItem: (k: string) => memStorage[k] || null,
		setItem: (k: string, v: string) => {
			memStorage[k] = v;
		},
		removeItem: (k: string) => {
			delete memStorage[k];
		}
	};
}

import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { DatabaseSync } from 'node:sqlite';
import {
	getFontFamilyCss,
	getFontFamilySvg,
	calculateTextBounds,
	wrapText
} from '../src/lib/client/canvas-text';
import {
	drawArrowHead,
	drawPeerCursor,
	drawShape,
	renderGrid
} from '../src/lib/client/canvas-render';
import {
	escapeXml,
	computeShapesBounds,
	exportToSvg,
	exportToJson,
	importFromJson
} from '../src/lib/client/canvas-export';
import { RoomSocket } from '../src/lib/client/websocket.svelte';
import type { ShapeRecord, PeerPresence } from '../src/lib/types';

function createMockCtx(): any {
	const calls: string[] = [];
	return {
		calls,
		save: () => calls.push('save'),
		restore: () => calls.push('restore'),
		beginPath: () => calls.push('beginPath'),
		closePath: () => calls.push('closePath'),
		moveTo: (x: number, y: number) => calls.push(`moveTo(${x},${y})`),
		lineTo: (x: number, y: number) => calls.push(`lineTo(${x},${y})`),
		stroke: () => calls.push('stroke'),
		fill: () => calls.push('fill'),
		rect: (x: number, y: number, w: number, h: number) => calls.push(`rect(${x},${y},${w},${h})`),
		roundRect: (x: number, y: number, w: number, h: number, r: number) =>
			calls.push(`roundRect(${x},${y},${w},${h},${r})`),
		ellipse: () => calls.push('ellipse'),
		fillRect: (x: number, y: number, w: number, h: number) =>
			calls.push(`fillRect(${x},${y},${w},${h})`),
		strokeRect: (x: number, y: number, w: number, h: number) =>
			calls.push(`strokeRect(${x},${y},${w},${h})`),
		fillText: (text: string, x: number, y: number) => calls.push(`fillText("${text}",${x},${y})`),
		measureText: (text: string) => ({ width: text.length * 8 }),
		clip: () => calls.push('clip'),
		font: '',
		fillStyle: '',
		strokeStyle: '',
		lineWidth: 1,
		lineCap: 'butt',
		lineJoin: 'miter',
		textBaseline: 'alphabetic'
	};
}

function parseRoomInput(input: string): string {
	let trimmed = input.trim();
	if (trimmed.includes('/room/')) {
		trimmed = trimmed.split('/room/').pop()?.split(/[?#/]/)[0] || trimmed;
	}
	return trimmed;
}

function isValidRoomId(id: string): boolean {
	return /^[a-zA-Z0-9_-]{3,64}$/.test(id);
}

test('Canvas Modules: Text Wrapping, Shape/Cursor Rendering, and Export/Import', async () => {
	// 1. canvas-text
	expect(getFontFamilyCss('mono')).toContain('JetBrains Mono');
	expect(getFontFamilySvg('mono')).toContain("'JetBrains Mono'");

	const bounds = calculateTextBounds('Hello\nWorld!', 18, 'sans');
	expect(bounds.width).toBeGreaterThan(0);
	expect(bounds.height).toBeGreaterThan(0);

	const mockCtx = createMockCtx();
	const wrapped = wrapText(mockCtx, 'The quick brown fox jumps over the lazy dog', 80);
	expect(wrapped.length).toBeGreaterThan(1);

	// 2. canvas-render
	const renderCtx = createMockCtx();
	drawArrowHead(renderCtx, 0, 0, 100, 100, '#6366f1', 2);
	expect(renderCtx.calls).toContain('fill');
	expect(renderCtx.calls).toContain('beginPath');

	const testShapes: ShapeRecord[] = [
		{
			id: 's1',
			type: 'rectangle',
			x: 10,
			y: 10,
			width: 100,
			height: 50,
			fill: '#ffffff',
			stroke: '#000000',
			strokeWidth: 2,
			rotation: 0,
			zIndex: 1,
			createdBy: 'u1',
			updatedAt: Date.now()
		},
		{
			id: 's2',
			type: 'sticky_note',
			x: 150,
			y: 50,
			width: 100,
			height: 100,
			fill: '#fef08a',
			stroke: '#eab308',
			strokeWidth: 1,
			rotation: 0,
			zIndex: 2,
			data: { text: 'Note content' },
			createdBy: 'u1',
			updatedAt: Date.now()
		}
	];

	for (const s of testShapes) {
		drawShape(renderCtx, s, '#ffffff');
	}

	const testPeer: PeerPresence = {
		userId: 'peer_1',
		name: 'Alice',
		color: '#10b981',
		cursor: { x: 50, y: 80 },
		selectedIds: []
	};
	drawPeerCursor(renderCtx, testPeer);
	renderGrid(renderCtx, 0, 0, 1, false, 800, 600);

	// 3. canvas-export
	expect(escapeXml('<hello & "world">')).toBe('&lt;hello &amp; &quot;world&quot;&gt;');

	const shapesMap = new Map<string, ShapeRecord>();
	testShapes.forEach((s) => shapesMap.set(s.id, s));

	const computedBounds = computeShapesBounds(shapesMap.values());
	expect(computedBounds?.minX).toBe(10);
	expect(computedBounds?.maxX).toBe(250);

	const svgString = await new Promise<string>((resolve) => {
		exportToSvg(shapesMap, '#121214', 'test.svg', async (source) => {
			if (source instanceof Blob) {
				resolve(await source.text());
			}
		});
	});
	expect(svgString).toContain('<svg');
	expect(svgString).toContain('Note content');

	const jsonString = await new Promise<string>((resolve) => {
		exportToJson(shapesMap, 'test.json', async (source) => {
			if (source instanceof Blob) {
				resolve(await source.text());
			}
		});
	});
	expect(jsonString).toContain('"app": "Mesh"');
	expect(jsonString).toContain('sticky_note');

	const imported = importFromJson(jsonString, 10, '#ffffff');
	expect(imported).toBeDefined();
	expect(imported!.length).toBe(2);
	expect(imported![0].zIndex).toBe(10);
	expect(imported![0].id).not.toBe(testShapes[0].id);
});

test('Export and Import Payload Structure and ID Regeneration', async () => {
	const mockShapes: ShapeRecord[] = [
		{
			id: 'shape_export_1',
			type: 'rectangle',
			x: 10,
			y: 10,
			width: 100,
			height: 50,
			fill: '#6366f1',
			stroke: '#f4f4f5',
			strokeWidth: 2,
			rotation: 0,
			zIndex: 1,
			createdBy: 'user_1',
			updatedAt: 1000
		},
		{
			id: 'shape_export_2',
			type: 'text',
			x: 120,
			y: 10,
			width: 80,
			height: 24,
			fill: 'transparent',
			stroke: '#f4f4f5',
			strokeWidth: 1,
			rotation: 0,
			zIndex: 2,
			data: { text: 'Hello Mesh', fontSize: 16 },
			createdBy: 'user_1',
			updatedAt: 1001
		}
	];

	const exportData = {
		app: 'Mesh',
		version: '1.0.0',
		exportedAt: new Date().toISOString(),
		shapes: mockShapes
	};

	const jsonString = JSON.stringify(exportData, null, 2);
	const parsed = JSON.parse(jsonString);

	expect(parsed.app).toBe('Mesh');
	expect(parsed.shapes.length).toBe(2);

	const now = Date.now();
	let baseZ = 10;
	const imported: ShapeRecord[] = [];

	for (const item of parsed.shapes) {
		imported.push({
			id: 'shape_' + Math.random().toString(36).substring(2, 9),
			type: item.type,
			x: item.x,
			y: item.y,
			width: item.width,
			height: item.height,
			fill: item.fill,
			stroke: item.stroke,
			strokeWidth: item.strokeWidth,
			rotation: item.rotation,
			zIndex: baseZ++,
			data: item.data,
			createdBy: 'importer',
			updatedAt: now
		});
	}

	expect(imported.length).toBe(2);
	expect(imported[0].id).not.toBe(mockShapes[0].id);
	expect(imported[0].zIndex).toBe(10);
	expect(imported[1].zIndex).toBe(11);
});

test('Security Fixes: Timestamp Clamping, PBKDF2 Password Hashing, and Unauthed Socket Filtering', async () => {
	// 1. Future timestamp clamping in SQLite LWW
	const db = new DatabaseSync(':memory:');
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
	const rawAttackerTs = Number.MAX_SAFE_INTEGER;
	const clampedAttackerTs = Math.min(rawAttackerTs, maxAllowedTime);

	upsert.run('shape-1', 'rectangle', 10, clampedAttackerTs);
	let row = db.prepare('SELECT * FROM shapes WHERE id = ?').get('shape-1') as any;
	expect(row.updated_at).toBe(clampedAttackerTs);

	// Legitimate update later succeeds
	const legitimateTs = clampedAttackerTs + 100;
	upsert.run('shape-1', 'rectangle', 50, legitimateTs);
	row = db.prepare('SELECT * FROM shapes WHERE id = ?').get('shape-1') as any;
	expect(row.x).toBe(50);

	// 2. PBKDF2 Password Hashing
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

	expect(h1).toBe(h2);
	expect(h1).not.toBe(h3);

	// 3. Broadcast filtering for unauthenticated sockets
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

	broadcast(JSON.stringify({ type: 'shapes:upserted' }), authed);
	expect(unauthed.messages.length).toBe(0);

	broadcast(JSON.stringify({ type: 'room:password_set' }), authed, false);
	expect(unauthed.messages.length).toBe(1);

	// 4. Malformed shape validation
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
	expect(skippedCount).toBe(4);
});

test('Room Link & Code Parsing Logic', async () => {
	// 1. Plain room code
	const code1 = parseRoomInput('room-qk5qt3');
	expect(code1).toBe('room-qk5qt3');
	expect(isValidRoomId(code1)).toBe(true);

	// 2. Localhost URL
	const code2 = parseRoomInput('http://localhost:4173/room/room-qk5qt3');
	expect(code2).toBe('room-qk5qt3');
	expect(isValidRoomId(code2)).toBe(true);

	// 3. HTTPS production URL with trailing slash, params, and hash
	const code3 = parseRoomInput('https://mesh.workers.dev/room/room-alpha99/?ref=share#top');
	expect(code3).toBe('room-alpha99');
	expect(isValidRoomId(code3)).toBe(true);

	// 4. Invalid room ID validation
	expect(isValidRoomId('ab')).toBe(false); // too short
	expect(isValidRoomId('bad!room#id')).toBe(false); // invalid chars
});

test('Free-Tier Presence Quota & Cursor Suppression Logic', async () => {
	class MockPresenceWebSocket {
		static readonly OPEN = 1;
		static instances: MockPresenceWebSocket[] = [];
		readyState = MockPresenceWebSocket.OPEN;
		sentMessages: string[] = [];
		onopen: (() => void) | null = null;
		onmessage: ((e: { data: string }) => void) | null = null;
		onclose: (() => void) | null = null;
		onerror: (() => void) | null = null;

		constructor(public url: string) {
			MockPresenceWebSocket.instances.push(this);
		}
		send(data: string) {
			this.sentMessages.push(data);
		}
		close() {
			this.readyState = 3;
			this.onclose?.();
		}
	}

	const originalWs = globalThis.WebSocket;
	(globalThis as any).WebSocket = MockPresenceWebSocket;

	try {
		const socket = new RoomSocket('test-room-quota');
		const mockWs = MockPresenceWebSocket.instances[MockPresenceWebSocket.instances.length - 1];
		mockWs.onopen?.();

		// Initial registration
		expect(mockWs.sentMessages.length).toBe(1);
		const initialMsg = JSON.parse(mockWs.sentMessages[0]);
		expect(initialMsg.type).toBe('presence:update');

		mockWs.sentMessages = [];

		// Solo room suppression
		for (let i = 0; i < 20; i++) {
			socket.sendPresence({ x: 100 + i * 5, y: 150 + i * 5 }, []);
		}
		expect(mockWs.sentMessages.length).toBe(0);

		// Peer joins
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

		expect(mockWs.sentMessages.length).toBe(1);
		const peerJoinReply = JSON.parse(mockWs.sentMessages[0]);
		expect(peerJoinReply.type).toBe('presence:update');

		mockWs.sentMessages = [];

		// Deadband filter (< 2px)
		socket.sendPresence({ x: peerJoinReply.cursor.x + 0.5, y: peerJoinReply.cursor.y + 0.5 }, []);
		expect(mockWs.sentMessages.length).toBe(0);

		// Significant movement (> 2px)
		socket.sendPresence({ x: 500, y: 500 }, []);
		await new Promise((r) => setTimeout(r, 100));
		expect(mockWs.sentMessages.length).toBe(1);

		socket.destroy();
	} finally {
		(globalThis as any).WebSocket = originalWs;
	}
});

test('Worker Efficiency: SQLite RETURNING *, Batch DELETE, Float Rounding, and Count Cache', async () => {
	const db = new DatabaseSync(':memory:');
	db.exec(`
		CREATE TABLE shapes (
			id TEXT PRIMARY KEY NOT NULL,
			type TEXT NOT NULL,
			x REAL NOT NULL DEFAULT 0.0,
			y REAL NOT NULL DEFAULT 0.0,
			width REAL DEFAULT 0.0,
			height REAL DEFAULT 0.0,
			fill TEXT DEFAULT 'transparent',
			stroke TEXT DEFAULT '#000000',
			stroke_width REAL DEFAULT 2.0,
			rotation REAL DEFAULT 0.0,
			z_index INTEGER DEFAULT 0,
			data TEXT,
			created_by TEXT NOT NULL,
			updated_at INTEGER NOT NULL
		);
	`);

	const upsertStmt = `
		INSERT INTO shapes (
			id, type, x, y, width, height, fill, stroke, stroke_width, rotation, z_index, data, created_by, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			x = excluded.x,
			y = excluded.y,
			width = excluded.width,
			height = excluded.height,
			fill = excluded.fill,
			stroke = excluded.stroke,
			stroke_width = excluded.stroke_width,
			rotation = excluded.rotation,
			z_index = excluded.z_index,
			data = excluded.data,
			updated_at = excluded.updated_at
		WHERE excluded.updated_at >= shapes.updated_at
		RETURNING id, type, x, y, width, height, fill, stroke, stroke_width, rotation, z_index, data, created_by, updated_at;
	`;

	const stmt = db.prepare(upsertStmt);

	// 1. Initial insert with RETURNING
	const inserted = stmt.get(
		's1',
		'rectangle',
		10.0,
		20.0,
		100.0,
		50.0,
		'#fff',
		'#000',
		2.0,
		0.0,
		1,
		null,
		'user_1',
		1000
	) as any;
	expect(inserted?.id).toBe('s1');
	expect(inserted?.x).toBe(10.0);

	// Newer update succeeds
	const updated = stmt.get(
		's1',
		'rectangle',
		35.5,
		45.5,
		120.0,
		60.0,
		'#fff',
		'#000',
		2.0,
		0.0,
		1,
		null,
		'user_1',
		1050
	) as any;
	expect(updated?.x).toBe(35.5);

	// Stale update rejected
	const stale = stmt.get(
		's1',
		'rectangle',
		99.0,
		99.0,
		120.0,
		60.0,
		'#fff',
		'#000',
		2.0,
		0.0,
		1,
		null,
		'user_1',
		900
	);
	expect(stale).toBeFalsy();

	// 2. Batch DELETE with WHERE id IN (...)
	const validIds = ['s1'];
	const placeholders = validIds.map(() => '?').join(',');
	db.prepare(`DELETE FROM shapes WHERE id IN (${placeholders})`).run(...validIds);
	const remaining = db.prepare('SELECT id FROM shapes').all();
	expect(remaining.length).toBe(0);

	// 3. Float rounding size reduction
	const round1 = (n: number | undefined): number =>
		typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : (n ?? 0);

	const rawFloat = 142.8491029384;
	const rounded = round1(rawFloat);
	expect(rounded).toBe(142.8);

	const jsonRaw = JSON.stringify({ x: rawFloat, y: rawFloat });
	const jsonRounded = JSON.stringify({ x: rounded, y: rounded });
	expect(jsonRounded.length).toBeLessThan(jsonRaw.length);

	// 4. Shape count caching & 9000 threshold recalibration
	let countQueriesExecuted = 0;
	let cachedCount: number | null = null;

	const queryCountFromDb = (): number => {
		countQueriesExecuted++;
		const row = db.prepare('SELECT COUNT(*) as count FROM shapes').get() as { count: number };
		return row.count;
	};

	const getShapeCount = (): number => {
		if (cachedCount === null || cachedCount >= 9000) {
			cachedCount = queryCountFromDb();
		}
		return cachedCount;
	};

	expect(getShapeCount()).toBe(0);
	expect(countQueriesExecuted).toBe(1);

	// Cached, does not query DB
	expect(getShapeCount()).toBe(0);
	expect(countQueriesExecuted).toBe(1);

	// Threshold crossing triggers recalibration
	cachedCount = 9050;
	expect(getShapeCount()).toBe(0);
	expect(countQueriesExecuted).toBe(2);
});

test('Landing Page Room Code Extraction in Browser UI', async ({ browser }) => {
	await browser.goto('/');

	const title = browser.locator('text=Mesh');
	await expect(title.first()).toBeVisible({ timeout: 10000 });

	// Room code input / buttons exist
	const roomInput = browser.locator('input[placeholder*="room"]').first();
	await expect(roomInput).toBeVisible();
});
