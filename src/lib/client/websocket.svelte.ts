import type { C2SMessage, PeerPresence, S2CMessage, ShapeRecord } from '../types';

export type ConnectionStatus =
	'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

const PALETTE = ['#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

export interface CurrentUser {
	userId: string;
	name: string;
	color: string;
}

export class RoomSocket {
	private ws: WebSocket | null = null;
	private roomId: string;
	private reconnectAttempt = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private isExplicitlyClosed = false;

	// Throttling for cursor (PRD §4.2, §8.1: max 30Hz; optimized to ~15Hz for Cloudflare free-tier quota)
	private static readonly PRESENCE_INTERVAL_MS = 66; // ~15Hz adaptive presence
	private lastPresenceTime = 0;
	private pendingPresenceTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingCursor: { x: number; y: number } | null = null;
	private pendingSelectedIds: string[] = [];
	private pendingPassword: string | null = null;
	private lastSentCursor: { x: number; y: number } | null = null;
	private lastSentSelectedIds: string[] = [];

	// Svelte 5 reactive states
	status = $state<ConnectionStatus>('connecting');
	shapes = $state<Map<string, ShapeRecord>>(new Map());
	peers = $state<PeerPresence[]>([]);
	authRequired = $state(false);
	authed = $state(false);
	authError = $state('');
	currentUser = $state<CurrentUser>({
		userId: '',
		name: 'Collaborator',
		color: PALETTE[0]
	});

	constructor(roomId: string) {
		this.roomId = roomId;
		this.initUser();
		this.connect();
	}

	private passwordStorageKey(): string {
		return `mesh_room_pw_${this.roomId}`;
	}

	private getStoredPassword(): string | null {
		if (typeof window === 'undefined') return null;
		try {
			return sessionStorage.getItem(this.passwordStorageKey());
		} catch {
			return null;
		}
	}

	private storePassword(password: string): void {
		if (typeof window === 'undefined') return;
		try {
			sessionStorage.setItem(this.passwordStorageKey(), password);
		} catch {
			// Ignore storage errors (private mode, etc.)
		}
	}

	authenticate(password: string): void {
		this.authError = '';
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			this.authError = 'Not connected. Please wait and try again.';
			return;
		}
		this.pendingPassword = password;
		const msg: C2SMessage = { type: 'room:auth', password };
		this.ws.send(JSON.stringify(msg));
	}

	setRoomPassword(password: string): void {
		this.authError = '';
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			this.authError = 'Not connected. Please wait and try again.';
			return;
		}
		this.pendingPassword = password;
		const msg: C2SMessage = { type: 'room:set_password', password };
		this.ws.send(JSON.stringify(msg));
	}

	private initUser() {
		if (typeof window === 'undefined') return;

		let userId =
			localStorage.getItem('mesh_user_id') || localStorage.getItem('canvas_sync_user_id');
		if (!userId) {
			userId = 'user_' + Math.random().toString(36).substring(2, 9);
			localStorage.setItem('mesh_user_id', userId);
		}

		let name =
			localStorage.getItem('mesh_user_name') || localStorage.getItem('canvas_sync_user_name');
		if (!name) {
			const randomSuffix = Math.floor(100 + Math.random() * 900);
			name = `Artist ${randomSuffix}`;
			localStorage.setItem('mesh_user_name', name);
		}

		let color =
			localStorage.getItem('mesh_user_color') || localStorage.getItem('canvas_sync_user_color');
		if (!color) {
			color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
			localStorage.setItem('mesh_user_color', color);
		}

		this.currentUser = { userId, name, color };
	}

	setUserName(newName: string) {
		const trimmed = newName.trim();
		if (!trimmed) return;
		this.currentUser.name = trimmed;
		if (typeof window !== 'undefined') {
			localStorage.setItem('mesh_user_name', trimmed);
		}
		this.sendPresenceImmediate(this.pendingCursor, this.pendingSelectedIds);
	}

	setUserColor(newColor: string) {
		this.currentUser.color = newColor;
		if (typeof window !== 'undefined') {
			localStorage.setItem('mesh_user_color', newColor);
		}
		this.sendPresenceImmediate(this.pendingCursor, this.pendingSelectedIds);
	}

	private connect() {
		if (typeof window === 'undefined' || this.isExplicitlyClosed) return;

		if (this.reconnectAttempt > 0) {
			this.status = 'reconnecting';
		} else {
			this.status = 'connecting';
		}

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const host = window.location.host;
		const wsUrl = `${protocol}//${host}/api/room/${this.roomId}/ws`;

		try {
			this.ws = new WebSocket(wsUrl);
		} catch {
			this.scheduleReconnect();
			return;
		}

		this.ws.onopen = () => {
			this.status = 'connected';
			this.reconnectAttempt = 0;
			// Auto re-authenticate on (re)connect if we have a stored password
			const stored = this.getStoredPassword();
			if (stored) {
				const msg: C2SMessage = { type: 'room:auth', password: stored };
				this.ws?.send(JSON.stringify(msg));
			}
			// Immediately broadcast our initial presence
			this.sendPresenceImmediate(this.pendingCursor, this.pendingSelectedIds);
		};

		this.ws.onmessage = (event: MessageEvent) => {
			this.handleMessage(event.data);
		};

		this.ws.onclose = () => {
			if (!this.isExplicitlyClosed) {
				this.scheduleReconnect();
			} else {
				this.status = 'disconnected';
			}
		};

		this.ws.onerror = () => {
			this.status = 'error';
		};
	}

	private scheduleReconnect() {
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

		// Exponential backoff with jitter (PRD §8.2)
		const delay = Math.min(
			1000 * Math.pow(2, this.reconnectAttempt) + Math.floor(Math.random() * 500),
			10000
		);
		this.reconnectAttempt++;
		this.status = 'reconnecting';

		this.reconnectTimer = setTimeout(() => {
			this.connect();
		}, delay);
	}

	private handleMessage(raw: string) {
		let msg: S2CMessage;
		try {
			msg = JSON.parse(raw) as S2CMessage;
		} catch {
			return;
		}

		switch (msg.type) {
			case 'sync:init': {
				const locked = msg.requiresPassword === true;
				this.authRequired = locked;
				if (locked && !this.authed) {
					// Locked room: wait for auth before accepting content
					this.shapes = new Map();
					this.peers = [];
					break;
				}
				const map = new Map<string, ShapeRecord>();
				for (const s of msg.shapes) {
					map.set(s.id, s);
				}
				this.shapes = map;

				const hadNoPeers = this.peers.length === 0;
				// Update active peers, excluding ourselves
				this.peers = msg.peers.filter((p) => p.userId !== this.currentUser.userId);
				if (hadNoPeers && this.peers.length > 0) {
					this.sendPresenceImmediate(this.pendingCursor, this.pendingSelectedIds);
				}
				break;
			}

			case 'room:auth_ok': {
				this.authed = true;
				this.authError = '';
				if (this.pendingPassword) {
					this.storePassword(this.pendingPassword);
					this.pendingPassword = null;
				}
				break;
			}

			case 'room:auth_failed': {
				this.authed = false;
				this.pendingPassword = null;
				this.authError = 'Incorrect password. Please try again.';
				break;
			}

			case 'room:password_set': {
				this.authRequired = true;
				if (this.pendingPassword) {
					this.authed = true;
					this.authError = '';
					this.storePassword(this.pendingPassword);
					this.pendingPassword = null;
				} else {
					// Password was set by another collaborator; require authentication
					this.authed = false;
					this.authError = '';
				}
				break;
			}

			case 'presence:peer': {
				if (msg.userId === this.currentUser.userId) return;

				const hadNoPeers = this.peers.length === 0;
				const idx = this.peers.findIndex((p) => p.userId === msg.userId);
				const updatedPeer: PeerPresence = {
					userId: msg.userId,
					name: msg.name,
					color: msg.color,
					cursor: msg.cursor,
					selectedIds: msg.selectedIds
				};

				if (idx >= 0) {
					this.peers[idx] = updatedPeer;
				} else {
					this.peers.push(updatedPeer);
				}

				if (hadNoPeers) {
					this.sendPresenceImmediate(this.pendingCursor, this.pendingSelectedIds);
				}
				break;
			}

			case 'peer:left': {
				this.peers = this.peers.filter((p) => p.userId !== msg.userId);
				if (this.peers.length === 0 && this.pendingPresenceTimer) {
					clearTimeout(this.pendingPresenceTimer);
					this.pendingPresenceTimer = null;
				}
				break;
			}

			case 'shapes:upserted': {
				const next = new Map(this.shapes);
				for (const shape of msg.shapes) {
					const existing = next.get(shape.id);
					// Monotonic LWW check
					if (!existing || shape.updatedAt >= existing.updatedAt) {
						next.set(shape.id, shape);
					}
				}
				this.shapes = next;
				break;
			}

			case 'shapes:deleted': {
				const next = new Map(this.shapes);
				for (const id of msg.ids) {
					next.delete(id);
				}
				this.shapes = next;
				break;
			}

			case 'canvas:cleared': {
				this.shapes = new Map();
				break;
			}
		}
	}

	/**
	 * Broadcast cursor position and selected shape IDs.
	 * Optimizations for Cloudflare Workers Free Tier quota:
	 * 1. Solo room suppression: If no other peers are in the room, skip continuous cursor broadcasts.
	 * 2. Deadband: Skip sending if cursor movement is < 2px and selection has not changed.
	 * 3. Adaptive throttling: Caps frequency at 15Hz (66ms) instead of 30Hz, saving 50% invocations during active collaboration.
	 */
	sendPresence(cursor: { x: number; y: number } | null, selectedIds: string[]) {
		this.pendingCursor = cursor;
		this.pendingSelectedIds = selectedIds;

		// Solo room suppression: If no other collaborators are in the room, do not stream cursor movements
		if (this.peers.length === 0 && cursor !== null) {
			return;
		}

		// Deadband check: if cursor moved less than 2px and selection is identical, skip transmission
		if (cursor !== null && this.lastSentCursor !== null) {
			const dx = cursor.x - this.lastSentCursor.x;
			const dy = cursor.y - this.lastSentCursor.y;
			const distSq = dx * dx + dy * dy;
			const selectionUnchanged =
				selectedIds.length === this.lastSentSelectedIds.length &&
				selectedIds.every((id, idx) => id === this.lastSentSelectedIds[idx]);

			if (distSq < 4 && selectionUnchanged) {
				return;
			}
		}

		const now = Date.now();
		const timeSinceLast = now - this.lastPresenceTime;

		if (timeSinceLast >= RoomSocket.PRESENCE_INTERVAL_MS) {
			this.sendPresenceImmediate(cursor, selectedIds);
		} else if (!this.pendingPresenceTimer) {
			this.pendingPresenceTimer = setTimeout(() => {
				this.pendingPresenceTimer = null;
				this.sendPresenceImmediate(this.pendingCursor, this.pendingSelectedIds);
			}, RoomSocket.PRESENCE_INTERVAL_MS - timeSinceLast);
		}
	}

	private sendPresenceImmediate(cursor: { x: number; y: number } | null, selectedIds: string[]) {
		this.lastPresenceTime = Date.now();
		this.lastSentCursor = cursor ? { x: cursor.x, y: cursor.y } : null;
		this.lastSentSelectedIds = [...selectedIds];

		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		const msg: C2SMessage = {
			type: 'presence:update',
			userId: this.currentUser.userId,
			name: this.currentUser.name,
			color: this.currentUser.color,
			cursor,
			selectedIds
		};

		this.ws.send(JSON.stringify(msg));
	}

	/**
	 * Optimistically upserts shapes locally and sends them to the server.
	 */
	upsertShapes(shapes: ShapeRecord[]) {
		if (shapes.length === 0) return;
		if (this.authRequired && !this.authed) return;

		// Optimistic local update
		const next = new Map(this.shapes);
		for (const s of shapes) {
			next.set(s.id, s);
		}
		this.shapes = next;

		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		const msg: C2SMessage = {
			type: 'shape:upsert',
			shapes: shapes.map((s) => ({
				id: s.id,
				type: s.type,
				x: s.x,
				y: s.y,
				width: s.width,
				height: s.height,
				fill: s.fill,
				stroke: s.stroke,
				strokeWidth: s.strokeWidth,
				rotation: s.rotation,
				zIndex: s.zIndex,
				data: s.data,
				updatedAt: s.updatedAt
			}))
		};

		this.ws.send(JSON.stringify(msg));
	}

	/**
	 * Optimistically deletes shapes locally and sends removal to the server.
	 */
	deleteShapes(ids: string[]) {
		if (ids.length === 0) return;
		if (this.authRequired && !this.authed) return;

		// Optimistic local removal
		const next = new Map(this.shapes);
		for (const id of ids) {
			next.delete(id);
		}
		this.shapes = next;

		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		const msg: C2SMessage = {
			type: 'shape:delete',
			ids
		};

		this.ws.send(JSON.stringify(msg));
	}

	/**
	 * Clears entire canvas locally and broadcasts purge to the server.
	 */
	clearCanvas() {
		if (this.authRequired && !this.authed) return;
		this.shapes = new Map();

		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		const msg: C2SMessage = {
			type: 'canvas:clear'
		};

		this.ws.send(JSON.stringify(msg));
	}

	destroy() {
		this.isExplicitlyClosed = true;
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
		if (this.pendingPresenceTimer) clearTimeout(this.pendingPresenceTimer);
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}
}
