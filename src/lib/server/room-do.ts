import { DurableObject } from 'cloudflare:workers';
import type { C2SMessage, PeerPresence, S2CMessage, ShapeRecord } from '../types';

interface RawShapeRow {
	[key: string]: string | number | null;
	id: string;
	type: 'path' | 'rectangle' | 'ellipse' | 'text' | 'sticky_note';
	x: number;
	y: number;
	width: number;
	height: number;
	fill: string;
	stroke: string;
	stroke_width: number;
	rotation: number;
	z_index: number;
	data: string | null;
	created_by: string;
	updated_at: number;
}

interface PeerAttachment {
	userId: string;
	name: string;
	color: string;
	cursor: { x: number; y: number } | null;
	selectedIds: string[];
	authed: boolean;
	connectedAt: number;
	rateLimitCount?: number;
	rateLimitResetAt?: number;
	authFailures?: number;
	authLockedUntil?: number;
}

const MIN_PASSWORD_LENGTH = 4;
const MAX_PASSWORD_LENGTH = 128;
const VALID_SHAPE_TYPES = new Set(['path', 'rectangle', 'ellipse', 'text', 'sticky_note']);

export class WhiteboardRoom extends DurableObject {
	private metaCache = new Map<string, string | null>();
	private cachedShapeCount: number | null = null;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.initSchema();
	}

	private initSchema() {
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS shapes (
				id TEXT PRIMARY KEY NOT NULL,
				type TEXT NOT NULL CHECK(type IN ('path', 'rectangle', 'ellipse', 'text', 'sticky_note')),
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
			CREATE INDEX IF NOT EXISTS idx_shapes_z_index ON shapes(z_index ASC);
			CREATE INDEX IF NOT EXISTS idx_shapes_updated ON shapes(updated_at DESC);
			CREATE TABLE IF NOT EXISTS room_meta (
				key TEXT PRIMARY KEY NOT NULL,
				value TEXT NOT NULL
			);
		`);
	}

	async fetch(request: Request): Promise<Response> {
		const upgradeHeader = request.headers.get('Upgrade');
		if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
			return new Response('Expected WebSocket upgrade', { status: 426 });
		}

		let activeSockets = this.ctx.getWebSockets();
		const passwordSet = this.hasPassword();

		if (activeSockets.length >= 50) {
			// If room is full, prune an unauthenticated socket to let authenticating users connect
			const unauthedSocket = activeSockets.find((s) => !this.isAuthed(s));
			if (unauthedSocket) {
				try {
					unauthedSocket.close(4001, 'Evicted for incoming connection');
				} catch {
					// Socket may already be closed
				}
				activeSockets = this.ctx.getWebSockets();
			}
			if (activeSockets.length >= 50) {
				return new Response('Room full (max 50 users)', { status: 503 });
			}
		}

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		this.ctx.acceptWebSocket(server);

		const now = Date.now();
		const initialAttachment: PeerAttachment = {
			userId: '',
			name: '',
			color: '',
			cursor: null,
			selectedIds: [],
			authed: !passwordSet,
			connectedAt: now,
			rateLimitCount: 0,
			rateLimitResetAt: now + 1000,
			authFailures: 0,
			authLockedUntil: 0
		};
		server.serializeAttachment(initialAttachment);

		const url = new URL(request.url);
		const roomIdMatch = url.pathname.match(/\/api\/room\/([^/]+)\/ws/);
		const roomId = roomIdMatch ? roomIdMatch[1] : 'unknown';

		const shapes = passwordSet ? [] : this.getAllShapes();
		const peers = passwordSet ? [] : this.getActivePeers();

		const initMsg: S2CMessage = {
			type: 'sync:init',
			roomId,
			serverTime: now,
			shapes,
			peers,
			requiresPassword: passwordSet ? true : undefined
		};

		server.send(JSON.stringify(initMsg));

		return new Response(null, {
			status: 101,
			webSocket: client
		});
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		const att = this.getAttachment(ws);

		// If room requires password, reject/close unauthenticated sockets exceeding 15 seconds
		if (this.hasPassword() && !att.authed && Date.now() - att.connectedAt > 15000) {
			ws.close(4001, 'Authentication timeout');
			return;
		}

		// Reject frames exceeding 64KB (PRD §2, §9.2)
		const byteLength =
			typeof message === 'string'
				? new TextEncoder().encode(message).byteLength
				: message.byteLength;
		if (byteLength > 65536) {
			ws.close(1009, 'Frame size exceeds 64KB');
			return;
		}

		// Sliding-window rate limiting: max 150 msg/sec (PRD §9.3)
		const now = Date.now();
		if (!att.rateLimitResetAt || now >= att.rateLimitResetAt) {
			att.rateLimitCount = 1;
			att.rateLimitResetAt = now + 1000;
		} else {
			att.rateLimitCount = (att.rateLimitCount ?? 0) + 1;
			if (att.rateLimitCount > 150) {
				ws.close(1008, 'Rate limit exceeded (150 msg/s)');
				return;
			}
		}
		ws.serializeAttachment(att);

		let rawText: string;
		if (typeof message === 'string') {
			rawText = message;
		} else {
			rawText = new TextDecoder().decode(message);
		}

		let payload: C2SMessage;
		try {
			payload = JSON.parse(rawText) as C2SMessage;
		} catch {
			return;
		}

		switch (payload.type) {
			case 'room:auth':
				await this.handleAuth(ws, payload);
				break;
			case 'room:set_password':
				await this.handleSetPassword(ws, payload);
				break;
			case 'presence:update':
				this.handlePresence(ws, payload);
				break;
			case 'shape:upsert':
				this.handleShapeUpsert(ws, payload);
				break;
			case 'shape:delete':
				this.handleShapeDelete(ws, payload);
				break;
			case 'canvas:clear':
				this.handleCanvasClear(ws);
				break;
		}
	}

	private async handleAuth(
		ws: WebSocket,
		payload: Extract<C2SMessage, { type: 'room:auth' }>
	): Promise<void> {
		const att = this.getAttachment(ws);
		if (!this.hasPassword()) {
			this.markAuthed(ws);
			ws.send(JSON.stringify({ type: 'room:auth_ok' } satisfies S2CMessage));
			this.sendFullSync(ws);
			return;
		}

		if (att.authLockedUntil && Date.now() < att.authLockedUntil) {
			ws.send(JSON.stringify({ type: 'room:auth_failed' } satisfies S2CMessage));
			return;
		}

		const ok = await this.verifyPassword(payload.password ?? '');
		if (ok) {
			att.authFailures = 0;
			att.authLockedUntil = 0;
			att.authed = true;
			ws.serializeAttachment(att);
			ws.send(JSON.stringify({ type: 'room:auth_ok' } satisfies S2CMessage));
			this.sendFullSync(ws);
		} else {
			const count = (att.authFailures ?? 0) + 1;
			att.authFailures = count;
			if (count >= 10) {
				ws.close(1008, 'Too many failed authentication attempts');
				return;
			} else if (count >= 5) {
				att.authLockedUntil = Date.now() + 5000;
			} else {
				att.authLockedUntil = 0;
			}
			ws.serializeAttachment(att);
			ws.send(JSON.stringify({ type: 'room:auth_failed' } satisfies S2CMessage));
		}
	}

	private async handleSetPassword(
		ws: WebSocket,
		payload: Extract<C2SMessage, { type: 'room:set_password' }>
	): Promise<void> {
		const pw = payload.password ?? '';
		if (pw.length < MIN_PASSWORD_LENGTH || pw.length > MAX_PASSWORD_LENGTH) {
			return;
		}
		if (this.hasPassword() && !this.isAuthed(ws)) {
			return;
		}
		await this.setPassword(pw);
		this.markAuthed(ws);
		ws.send(JSON.stringify({ type: 'room:password_set' } satisfies S2CMessage));
		this.broadcast(JSON.stringify({ type: 'room:password_set' } satisfies S2CMessage), ws, false);
		this.sendFullSync(ws);
	}

	private handlePresence(
		ws: WebSocket,
		payload: Extract<C2SMessage, { type: 'presence:update' }>
	): void {
		if (this.hasPassword() && !this.isAuthed(ws)) {
			return;
		}
		const attachment = this.getAttachment(ws);
		attachment.userId = payload.userId;
		attachment.name = payload.name;
		attachment.color = payload.color;
		attachment.cursor = payload.cursor;
		attachment.selectedIds = payload.selectedIds;
		ws.serializeAttachment(attachment);

		const presenceMsg: S2CMessage = {
			type: 'presence:peer',
			userId: payload.userId,
			name: payload.name,
			color: payload.color,
			cursor: payload.cursor,
			selectedIds: payload.selectedIds
		};
		this.broadcast(JSON.stringify(presenceMsg), ws);
	}

	private getShapeCount(): number {
		if (this.cachedShapeCount === null) {
			const row = this.ctx.storage.sql
				.exec<{ count: number }>('SELECT COUNT(*) as count FROM shapes')
				.one();
			this.cachedShapeCount = row?.count ?? 0;
		}
		return this.cachedShapeCount;
	}

	private handleShapeUpsert(
		ws: WebSocket,
		payload: Extract<C2SMessage, { type: 'shape:upsert' }>
	): void {
		if (!payload.shapes || !Array.isArray(payload.shapes) || payload.shapes.length === 0) {
			return;
		}

		if (this.hasPassword() && !this.isAuthed(ws)) {
			return;
		}

		if (this.getShapeCount() >= 10000) {
			return;
		}

		const senderAttachment = ws.deserializeAttachment() as PeerAttachment | null;
		const senderUserId = senderAttachment?.userId ?? 'anonymous';

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

		const appliedShapes: ShapeRecord[] = [];
		const now = Date.now();
		const maxAllowedTime = now + 5000;

		try {
			this.ctx.storage.transactionSync(() => {
				for (const s of payload.shapes) {
					if (!s || typeof s.id !== 'string' || !s.id || !VALID_SHAPE_TYPES.has(s.type)) {
						continue;
					}
					const safeUpdatedAt =
						typeof s.updatedAt === 'number' && Number.isFinite(s.updatedAt) && s.updatedAt > 0
							? Math.min(s.updatedAt, maxAllowedTime)
							: now;

					let dataStr: string | null = null;
					if (s.data !== undefined) {
						try {
							dataStr = JSON.stringify(s.data);
						} catch {
							dataStr = null;
						}
					}

					const updatedRow = this.ctx.storage.sql
						.exec<RawShapeRow>(
							upsertStmt,
							s.id,
							s.type,
							Number.isFinite(s.x) ? s.x : 0.0,
							Number.isFinite(s.y) ? s.y : 0.0,
							Number.isFinite(s.width) ? s.width : 0.0,
							Number.isFinite(s.height) ? s.height : 0.0,
							typeof s.fill === 'string' ? s.fill : 'transparent',
							typeof s.stroke === 'string' ? s.stroke : '#000000',
							Number.isFinite(s.strokeWidth) ? s.strokeWidth : 2.0,
							Number.isFinite(s.rotation) ? s.rotation : 0.0,
							Number.isInteger(s.zIndex) ? s.zIndex : 0,
							dataStr,
							senderUserId,
							safeUpdatedAt
						)
						.one();

					if (updatedRow && updatedRow.updated_at === safeUpdatedAt) {
						appliedShapes.push(this.rowToShape(updatedRow));
					}
				}
			});
		} catch (err) {
			console.error('Failed to commit shape:upsert transaction:', err);
			return;
		}

		if (appliedShapes.length > 0) {
			this.cachedShapeCount = null;
			const broadcastMsg: S2CMessage = {
				type: 'shapes:upserted',
				shapes: appliedShapes
			};
			this.broadcast(JSON.stringify(broadcastMsg));
		}
	}

	private handleShapeDelete(
		ws: WebSocket,
		payload: Extract<C2SMessage, { type: 'shape:delete' }>
	): void {
		if (!payload.ids || !Array.isArray(payload.ids) || payload.ids.length === 0) {
			return;
		}

		if (this.hasPassword() && !this.isAuthed(ws)) {
			return;
		}

		const validIds = payload.ids.filter((id) => typeof id === 'string' && id.length > 0);
		if (validIds.length === 0) return;

		try {
			this.ctx.storage.transactionSync(() => {
				const placeholders = validIds.map(() => '?').join(',');
				this.ctx.storage.sql.exec(`DELETE FROM shapes WHERE id IN (${placeholders})`, ...validIds);
				if (this.cachedShapeCount !== null) {
					this.cachedShapeCount = Math.max(0, this.cachedShapeCount - validIds.length);
				}
			});
		} catch (err) {
			console.error('Failed to delete shapes:', err);
			return;
		}

		const broadcastMsg: S2CMessage = {
			type: 'shapes:deleted',
			ids: validIds
		};
		this.broadcast(JSON.stringify(broadcastMsg));
	}

	private handleCanvasClear(ws: WebSocket): void {
		if (this.hasPassword() && !this.isAuthed(ws)) {
			return;
		}

		try {
			this.ctx.storage.sql.exec('DELETE FROM shapes');
			this.cachedShapeCount = 0;
		} catch (err) {
			console.error('Failed to clear canvas:', err);
			return;
		}

		const broadcastMsg: S2CMessage = {
			type: 'canvas:cleared'
		};
		this.broadcast(JSON.stringify(broadcastMsg));
	}

	async webSocketClose(
		ws: WebSocket,
		code: number,
		reason: string,
		wasClean: boolean
	): Promise<void> {
		this.cleanupSocket(ws);
		const attachment = ws.deserializeAttachment() as PeerAttachment | null;
		if (attachment?.userId) {
			const leftMsg: S2CMessage = {
				type: 'peer:left',
				userId: attachment.userId
			};
			this.broadcast(JSON.stringify(leftMsg), ws);
		}
	}

	async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
		this.cleanupSocket(ws);
		try {
			ws.close(1011, 'Internal server error');
		} catch {
			// Ignore socket close errors
		}
	}

	private cleanupSocket(ws: WebSocket): void {
		// State lives on WebSocket attachment
	}

	private getMeta(key: string): string | null {
		if (this.metaCache.has(key)) {
			return this.metaCache.get(key) ?? null;
		}
		const rows = this.ctx.storage.sql
			.exec<{ value: string }>('SELECT value FROM room_meta WHERE key = ?', key)
			.toArray();
		const val = rows[0]?.value ?? null;
		this.metaCache.set(key, val);
		return val;
	}

	private setMeta(key: string, value: string): void {
		this.metaCache.set(key, value);
		this.ctx.storage.sql.exec(
			'INSERT INTO room_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
			key,
			value
		);
	}

	private hasPassword(): boolean {
		return this.getMeta('password_hash') !== null;
	}

	private isAuthed(ws: WebSocket): boolean {
		const att = ws.deserializeAttachment() as PeerAttachment | null;
		return att?.authed === true;
	}

	private markAuthed(ws: WebSocket): void {
		const att = this.getAttachment(ws);
		att.authed = true;
		att.authFailures = 0;
		att.authLockedUntil = 0;
		ws.serializeAttachment(att);
	}

	private getAttachment(ws: WebSocket): PeerAttachment {
		const att = ws.deserializeAttachment() as PeerAttachment | null;
		if (att) return att;
		const fallback: PeerAttachment = {
			userId: '',
			name: '',
			color: '',
			cursor: null,
			selectedIds: [],
			authed: !this.hasPassword(),
			connectedAt: Date.now(),
			rateLimitCount: 0,
			rateLimitResetAt: Date.now() + 1000,
			authFailures: 0,
			authLockedUntil: 0
		};
		ws.serializeAttachment(fallback);
		return fallback;
	}

	private async hashPassword(password: string, salt: string): Promise<string> {
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

	private hashesEqual(a: string, b: string): boolean {
		if (a.length !== b.length) return false;
		let diff = 0;
		for (let i = 0; i < a.length; i++) {
			diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
		}
		return diff === 0;
	}

	private async setPassword(password: string): Promise<void> {
		const salt = crypto.randomUUID();
		const hash = await this.hashPassword(password, salt);
		this.setMeta('password_salt', salt);
		this.setMeta('password_hash', hash);
	}

	private async verifyPassword(password: string): Promise<boolean> {
		const salt = this.getMeta('password_salt');
		const expected = this.getMeta('password_hash');
		if (!salt || !expected) return false;
		const actual = await this.hashPassword(password, salt);
		return this.hashesEqual(actual, expected);
	}

	private sendFullSync(ws: WebSocket): void {
		const fullInit: S2CMessage = {
			type: 'sync:init',
			roomId: '',
			serverTime: Date.now(),
			shapes: this.getAllShapes(),
			peers: this.getActivePeers()
		};
		ws.send(JSON.stringify(fullInit));
	}

	private broadcast(message: string, excludeWs?: WebSocket, requireAuth = true): void {
		const locked = this.hasPassword();
		const sockets = this.ctx.getWebSockets();
		for (const socket of sockets) {
			if (socket !== excludeWs) {
				if (locked && requireAuth && !this.isAuthed(socket)) {
					continue;
				}
				try {
					socket.send(message);
				} catch {
					// Socket might be closed
				}
			}
		}
	}

	private getAllShapes(): ShapeRecord[] {
		const rows = this.ctx.storage.sql
			.exec<RawShapeRow>(
				'SELECT id, type, x, y, width, height, fill, stroke, stroke_width, rotation, z_index, data, created_by, updated_at FROM shapes ORDER BY z_index ASC'
			)
			.toArray();

		return rows.map((r) => this.rowToShape(r));
	}

	private getActivePeers(): PeerPresence[] {
		const peers: PeerPresence[] = [];
		const sockets = this.ctx.getWebSockets();
		for (const ws of sockets) {
			const att = ws.deserializeAttachment() as PeerAttachment | null;
			if (att && att.userId) {
				peers.push({
					userId: att.userId,
					name: att.name,
					color: att.color,
					cursor: att.cursor,
					selectedIds: att.selectedIds
				});
			}
		}
		return peers;
	}

	private rowToShape(row: RawShapeRow): ShapeRecord {
		let parsedData: any = undefined;
		if (row.data) {
			try {
				parsedData = JSON.parse(row.data);
			} catch {
				parsedData = row.data;
			}
		}

		return {
			id: row.id,
			type: row.type,
			x: row.x,
			y: row.y,
			width: row.width,
			height: row.height,
			fill: row.fill,
			stroke: row.stroke,
			strokeWidth: row.stroke_width,
			rotation: row.rotation,
			zIndex: row.z_index,
			data: parsedData,
			createdBy: row.created_by,
			updatedAt: row.updated_at
		};
	}
}
