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
}

export class WhiteboardRoom extends DurableObject {
	private rateLimits = new Map<WebSocket, { count: number; resetAt: number }>();

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
		`);
	}

	async fetch(request: Request): Promise<Response> {
		const upgradeHeader = request.headers.get('Upgrade');
		if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
			return new Response('Expected WebSocket upgrade', { status: 426 });
		}

		const activeSockets = this.ctx.getWebSockets();
		if (activeSockets.length >= 50) {
			return new Response('Room full (max 50 users)', { status: 503 });
		}

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		this.ctx.acceptWebSocket(server);

		const url = new URL(request.url);
		const roomIdMatch = url.pathname.match(/\/api\/room\/([^/]+)\/ws/);
		const roomId = roomIdMatch ? roomIdMatch[1] : 'unknown';

		const shapes = this.getAllShapes();
		const peers = this.getActivePeers();

		const initMsg: S2CMessage = {
			type: 'sync:init',
			roomId,
			serverTime: Date.now(),
			shapes,
			peers
		};

		server.send(JSON.stringify(initMsg));

		return new Response(null, {
			status: 101,
			webSocket: client
		});
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		// Reject frames exceeding 64KB (PRD §2, §9.2)
		const byteLength =
			typeof message === 'string'
				? new TextEncoder().encode(message).byteLength
				: message.byteLength;
		if (byteLength > 65536) {
			ws.close(1009, 'Frame size exceeds 64KB');
			this.rateLimits.delete(ws);
			return;
		}

		// Sliding-window rate limiting: max 150 msg/sec (PRD §9.3)
		const now = Date.now();
		let rl = this.rateLimits.get(ws);
		if (!rl || now >= rl.resetAt) {
			rl = { count: 1, resetAt: now + 1000 };
			this.rateLimits.set(ws, rl);
		} else {
			rl.count++;
			if (rl.count > 150) {
				ws.close(1008, 'Rate limit exceeded (150 msg/s)');
				this.rateLimits.delete(ws);
				return;
			}
		}

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
			case 'presence:update': {
				// Ephemeral presence: MUST NEVER touch SQLite (PRD FR-2.4)
				const attachment: PeerAttachment = {
					userId: payload.userId,
					name: payload.name,
					color: payload.color,
					cursor: payload.cursor,
					selectedIds: payload.selectedIds
				};
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
				break;
			}

			case 'shape:upsert': {
				if (!payload.shapes || !Array.isArray(payload.shapes) || payload.shapes.length === 0) {
					return;
				}

				const existingCountRow = this.ctx.storage.sql
					.exec<{ count: number }>('SELECT COUNT(*) as count FROM shapes')
					.one();
				const currentCount = existingCountRow?.count ?? 0;

				// Limit of 10,000 shapes per room (PRD §2, §8.1)
				if (currentCount >= 10000) {
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
					WHERE excluded.updated_at >= shapes.updated_at;
				`;

				const appliedShapes: ShapeRecord[] = [];

				this.ctx.storage.transactionSync(() => {
					for (const s of payload.shapes) {
						const dataStr = s.data !== undefined ? JSON.stringify(s.data) : null;
						this.ctx.storage.sql.exec(
							upsertStmt,
							s.id,
							s.type,
							s.x ?? 0.0,
							s.y ?? 0.0,
							s.width ?? 0.0,
							s.height ?? 0.0,
							s.fill ?? 'transparent',
							s.stroke ?? '#000000',
							s.strokeWidth ?? 2.0,
							s.rotation ?? 0.0,
							s.zIndex ?? 0,
							dataStr,
							senderUserId,
							s.updatedAt
						);

						// Read back the committed shape to confirm LWW won
						const updatedRow = this.ctx.storage.sql
							.exec<RawShapeRow>(
								'SELECT id, type, x, y, width, height, fill, stroke, stroke_width, rotation, z_index, data, created_by, updated_at FROM shapes WHERE id = ?',
								s.id
							)
							.one();

						if (updatedRow && updatedRow.updated_at === s.updatedAt) {
							appliedShapes.push(this.rowToShape(updatedRow));
						}
					}
				});

				if (appliedShapes.length > 0) {
					const broadcastMsg: S2CMessage = {
						type: 'shapes:upserted',
						shapes: appliedShapes
					};
					this.broadcast(JSON.stringify(broadcastMsg));
				}
				break;
			}

			case 'shape:delete': {
				if (!payload.ids || !Array.isArray(payload.ids) || payload.ids.length === 0) {
					return;
				}

				this.ctx.storage.transactionSync(() => {
					for (const id of payload.ids) {
						this.ctx.storage.sql.exec('DELETE FROM shapes WHERE id = ?', id);
					}
				});

				const broadcastMsg: S2CMessage = {
					type: 'shapes:deleted',
					ids: payload.ids
				};
				this.broadcast(JSON.stringify(broadcastMsg));
				break;
			}

			case 'canvas:clear': {
				this.ctx.storage.sql.exec('DELETE FROM shapes');

				const broadcastMsg: S2CMessage = {
					type: 'canvas:cleared'
				};
				this.broadcast(JSON.stringify(broadcastMsg));
				break;
			}
		}
	}

	async webSocketClose(
		ws: WebSocket,
		code: number,
		reason: string,
		wasClean: boolean
	): Promise<void> {
		this.rateLimits.delete(ws);
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
		this.rateLimits.delete(ws);
		try {
			ws.close(1011, 'Internal server error');
		} catch {
			// Ignore socket close errors
		}
	}

	private broadcast(message: string, excludeWs?: WebSocket): void {
		const sockets = this.ctx.getWebSockets();
		for (const socket of sockets) {
			if (socket !== excludeWs) {
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
