import {
	getShapeBounds,
	hitTestShape,
	isShapeInsideMarquee,
	screenToWorld,
	simplifyRDP,
	worldToScreen,
	type BoundingBox
} from './math';
import type { PathPoint, PeerPresence, ShapeRecord, ShapeType } from '../types';
import type { HistoryAction } from './history.svelte';

export type ToolMode = 'select' | 'pen' | 'rectangle' | 'ellipse' | 'text' | 'sticky_note' | 'pan';

export interface ViewportState {
	panX: number;
	panY: number;
	zoom: number;
}

export class CanvasEngine {
	private staticCanvas: HTMLCanvasElement;
	private overlayCanvas: HTMLCanvasElement;
	private staticCtx: CanvasRenderingContext2D;
	private overlayCtx: CanvasRenderingContext2D;

	// Viewport transforms
	viewport: ViewportState = {
		panX: 0,
		panY: 0,
		zoom: 1
	};

	// Interaction state
	tool: ToolMode = 'select';
	strokeColor = '#f4f4f5';
	fillColor = 'transparent';
	strokeWidth = 2;
	fontSize = 18;

	isSpacePressed = false;

	// Active operation
	private isInteracting = false;
	private interactionType: 'draw' | 'create_shape' | 'drag_selection' | 'marquee' | 'pan' | null =
		null;
	private startPoint: { x: number; y: number } = { x: 0, y: 0 };
	private currentPoint: { x: number; y: number } = { x: 0, y: 0 };
	private activePathPoints: PathPoint[] = [];

	// Selection state
	selectedIds: string[] = [];
	private dragInitialPositions = new Map<string, { x: number; y: number }>();
	private dragInitialShapes = new Map<string, ShapeRecord>();

	// Shape repository reference
	private shapes: Map<string, ShapeRecord> = new Map();
	private peers: PeerPresence[] = [];

	// Callbacks to reactive Svelte layer
	onShapesMutated?: (shapes: ShapeRecord[]) => void;
	onShapesDeleted?: (ids: string[]) => void;
	onSelectionChanged?: (selectedIds: string[]) => void;
	onCursorMoved?: (pos: { x: number; y: number } | null) => void;
	onViewportChanged?: (vp: ViewportState) => void;
	onActionRecorded?: (action: HistoryAction) => void;

	constructor(staticCanvas: HTMLCanvasElement, overlayCanvas: HTMLCanvasElement) {
		this.staticCanvas = staticCanvas;
		this.overlayCanvas = overlayCanvas;

		const sCtx = staticCanvas.getContext('2d');
		const oCtx = overlayCanvas.getContext('2d');

		if (!sCtx || !oCtx) {
			throw new Error('Failed to get 2D canvas context');
		}

		this.staticCtx = sCtx;
		this.overlayCtx = oCtx;

		window.addEventListener('keydown', (e) => {
			if (e.code === 'Space') this.isSpacePressed = true;
		});
		window.addEventListener('keyup', (e) => {
			if (e.code === 'Space') this.isSpacePressed = false;
		});

		this.resize();
	}

	resize() {
		const width = window.innerWidth;
		const height = window.innerHeight;
		const dpr = window.devicePixelRatio || 1;

		this.staticCanvas.width = width * dpr;
		this.staticCanvas.height = height * dpr;
		this.staticCanvas.style.width = `${width}px`;
		this.staticCanvas.style.height = `${height}px`;

		this.overlayCanvas.width = width * dpr;
		this.overlayCanvas.height = height * dpr;
		this.overlayCanvas.style.width = `${width}px`;
		this.overlayCanvas.style.height = `${height}px`;

		this.staticCtx.scale(dpr, dpr);
		this.overlayCtx.scale(dpr, dpr);

		this.renderBuffer();
		this.renderOverlay();
	}

	setShapes(shapes: Map<string, ShapeRecord>) {
		this.shapes = shapes;
		this.renderBuffer();
		this.renderOverlay();
	}

	setPeers(peers: PeerPresence[]) {
		this.peers = peers;
		this.renderOverlay();
	}

	setTool(tool: ToolMode) {
		this.tool = tool;
		if (tool !== 'select') {
			this.selectedIds = [];
			this.onSelectionChanged?.(this.selectedIds);
		}
		this.renderOverlay();
	}

	setStrokeColor(color: string) {
		this.strokeColor = color;
		this.applyPropertyToSelection({ stroke: color });
	}

	setFillColor(color: string) {
		this.fillColor = color;
		this.applyPropertyToSelection({ fill: color });
	}

	setStrokeWidth(width: number) {
		this.strokeWidth = width;
		this.applyPropertyToSelection({ strokeWidth: width });
	}

	private applyPropertyToSelection(props: Partial<ShapeRecord>) {
		if (this.selectedIds.length === 0) return;
		const before: ShapeRecord[] = [];
		const modified: ShapeRecord[] = [];
		const now = Date.now();

		for (const id of this.selectedIds) {
			const shape = this.shapes.get(id);
			if (shape) {
				before.push({ ...shape });
				const updated: ShapeRecord = {
					...shape,
					...props,
					updatedAt: now
				};
				modified.push(updated);
			}
		}

		if (modified.length > 0) {
			this.onShapesMutated?.(modified);
			this.onActionRecorded?.({
				type: 'modify',
				before,
				after: modified
			});
		}
	}

	// -------------------------------------------------------------
	// POINTER EVENT HANDLERS
	// -------------------------------------------------------------

	handlePointerDown(e: PointerEvent) {
		const screenPos = { x: e.clientX, y: e.clientY };
		const worldPos = screenToWorld(
			screenPos.x,
			screenPos.y,
			this.viewport.panX,
			this.viewport.panY,
			this.viewport.zoom
		);

		this.isInteracting = true;
		this.startPoint = worldPos;
		this.currentPoint = worldPos;

		// Pan mode (or middle mouse button or Space bar held)
		if (this.tool === 'pan' || e.button === 1 || e.buttons === 4 || this.isSpacePressed) {
			this.interactionType = 'pan';
			return;
		}

		if (this.tool === 'pen') {
			this.interactionType = 'draw';
			this.activePathPoints = [{ x: worldPos.x, y: worldPos.y, pressure: e.pressure || 0.5 }];
			this.renderOverlay();
			return;
		}

		if (this.tool === 'rectangle' || this.tool === 'ellipse' || this.tool === 'sticky_note') {
			this.interactionType = 'create_shape';
			this.renderOverlay();
			return;
		}

		if (this.tool === 'text') {
			this.interactionType = null;
			this.isInteracting = false;
			this.createTextInput(worldPos);
			return;
		}

		if (this.tool === 'select') {
			// Hit-test shapes in reverse zIndex order (top-most first)
			const sortedShapes = Array.from(this.shapes.values()).sort((a, b) => b.zIndex - a.zIndex);
			const hit = sortedShapes.find((s) => hitTestShape(worldPos, s));

			if (hit) {
				if (e.shiftKey) {
					if (this.selectedIds.includes(hit.id)) {
						this.selectedIds = this.selectedIds.filter((id) => id !== hit.id);
					} else {
						this.selectedIds.push(hit.id);
					}
				} else {
					if (!this.selectedIds.includes(hit.id)) {
						this.selectedIds = [hit.id];
					}
				}

				this.interactionType = 'drag_selection';
				this.dragInitialPositions.clear();
				this.dragInitialShapes.clear();
				for (const id of this.selectedIds) {
					const shape = this.shapes.get(id);
					if (shape) {
						this.dragInitialPositions.set(id, { x: shape.x, y: shape.y });
						this.dragInitialShapes.set(id, { ...shape });
					}
				}
			} else {
				if (!e.shiftKey) {
					this.selectedIds = [];
				}
				this.interactionType = 'marquee';
			}

			this.onSelectionChanged?.(this.selectedIds);
			this.renderOverlay();
		}
	}

	handlePointerMove(e: PointerEvent) {
		const screenPos = { x: e.clientX, y: e.clientY };
		const worldPos = screenToWorld(
			screenPos.x,
			screenPos.y,
			this.viewport.panX,
			this.viewport.panY,
			this.viewport.zoom
		);

		this.currentPoint = worldPos;
		this.onCursorMoved?.(worldPos);

		if (!this.isInteracting) {
			this.renderOverlay();
			return;
		}

		if (this.interactionType === 'pan') {
			this.viewport.panX += e.movementX;
			this.viewport.panY += e.movementY;
			this.onViewportChanged?.(this.viewport);
			this.renderBuffer();
			this.renderOverlay();
			return;
		}

		if (this.interactionType === 'draw') {
			this.activePathPoints.push({
				x: worldPos.x,
				y: worldPos.y,
				pressure: e.pressure || 0.5
			});
			this.renderOverlay();
			return;
		}

		if (this.interactionType === 'create_shape') {
			this.renderOverlay();
			return;
		}

		if (this.interactionType === 'drag_selection') {
			const dx = worldPos.x - this.startPoint.x;
			const dy = worldPos.y - this.startPoint.y;

			// Optimistically move shapes in local map during drag
			for (const [id, initialPos] of this.dragInitialPositions) {
				const shape = this.shapes.get(id);
				if (shape) {
					shape.x = initialPos.x + dx;
					shape.y = initialPos.y + dy;
				}
			}

			this.renderBuffer();
			this.renderOverlay();
			return;
		}

		if (this.interactionType === 'marquee') {
			const minX = Math.min(this.startPoint.x, worldPos.x);
			const minY = Math.min(this.startPoint.y, worldPos.y);
			const maxX = Math.max(this.startPoint.x, worldPos.x);
			const maxY = Math.max(this.startPoint.y, worldPos.y);

			const marquee: BoundingBox = {
				minX,
				minY,
				maxX,
				maxY,
				width: maxX - minX,
				height: maxY - minY
			};

			const insideIds: string[] = [];
			for (const shape of this.shapes.values()) {
				if (isShapeInsideMarquee(shape, marquee)) {
					insideIds.push(shape.id);
				}
			}

			this.selectedIds = insideIds;
			this.onSelectionChanged?.(this.selectedIds);
			this.renderOverlay();
		}
	}

	handlePointerUp() {
		if (!this.isInteracting) return;

		const now = Date.now();

		if (this.interactionType === 'draw') {
			if (this.activePathPoints.length > 1) {
				const simplified = simplifyRDP(this.activePathPoints, 1.5);
				const bounds = this.calculatePointsBounds(simplified);

				const shape: ShapeRecord = {
					id: 'shape_' + Math.random().toString(36).substring(2, 9),
					type: 'path',
					x: bounds.minX,
					y: bounds.minY,
					width: bounds.width,
					height: bounds.height,
					fill: 'transparent',
					stroke: this.strokeColor,
					strokeWidth: this.strokeWidth,
					rotation: 0,
					zIndex: this.getNextZIndex(),
					data: { points: simplified },
					createdBy: '',
					updatedAt: now
				};

				this.onShapesMutated?.([shape]);
				this.onActionRecorded?.({ type: 'create', shape });
			}
			this.activePathPoints = [];
		} else if (this.interactionType === 'create_shape') {
			const x = Math.min(this.startPoint.x, this.currentPoint.x);
			const y = Math.min(this.startPoint.y, this.currentPoint.y);
			const width = Math.max(Math.abs(this.currentPoint.x - this.startPoint.x), 10);
			const height = Math.max(Math.abs(this.currentPoint.y - this.startPoint.y), 10);

			let shapeType: ShapeType = 'rectangle';
			let shapeData: any = undefined;

			if (this.tool === 'ellipse') {
				shapeType = 'ellipse';
			} else if (this.tool === 'sticky_note') {
				shapeType = 'sticky_note';
				shapeData = { text: 'Note' };
			}

			const shape: ShapeRecord = {
				id: 'shape_' + Math.random().toString(36).substring(2, 9),
				type: shapeType,
				x,
				y,
				width,
				height,
				fill: this.tool === 'sticky_note' ? '#fef08a' : this.fillColor,
				stroke: this.tool === 'sticky_note' ? '#eab308' : this.strokeColor,
				strokeWidth: this.strokeWidth,
				rotation: 0,
				zIndex: this.getNextZIndex(),
				data: shapeData,
				createdBy: '',
				updatedAt: now
			};

			this.onShapesMutated?.([shape]);
			this.onActionRecorded?.({ type: 'create', shape });
		} else if (this.interactionType === 'drag_selection') {
			const movedShapes: ShapeRecord[] = [];
			const beforeShapes: ShapeRecord[] = [];
			for (const id of this.selectedIds) {
				const shape = this.shapes.get(id);
				const initial = this.dragInitialShapes.get(id);
				if (shape && initial && (shape.x !== initial.x || shape.y !== initial.y)) {
					shape.updatedAt = now;
					movedShapes.push({ ...shape });
					beforeShapes.push(initial);
				}
			}
			if (movedShapes.length > 0) {
				this.onShapesMutated?.(movedShapes);
				this.onActionRecorded?.({
					type: 'modify',
					before: beforeShapes,
					after: movedShapes
				});
			}
			this.dragInitialPositions.clear();
			this.dragInitialShapes.clear();
		}

		this.isInteracting = false;
		this.interactionType = null;
		this.renderBuffer();
		this.renderOverlay();
	}

	handleWheel(e: WheelEvent) {
		e.preventDefault();

		if (e.ctrlKey || e.metaKey) {
			// Zoom around cursor
			const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
			const newZoom = Math.min(Math.max(this.viewport.zoom * zoomFactor, 0.1), 5.0);

			const mouseX = e.clientX;
			const mouseY = e.clientY;

			this.viewport.panX = mouseX - (mouseX - this.viewport.panX) * (newZoom / this.viewport.zoom);
			this.viewport.panY = mouseY - (mouseY - this.viewport.panY) * (newZoom / this.viewport.zoom);
			this.viewport.zoom = newZoom;
		} else {
			// Pan
			this.viewport.panX -= e.deltaX;
			this.viewport.panY -= e.deltaY;
		}

		this.onViewportChanged?.(this.viewport);
		this.renderBuffer();
		this.renderOverlay();
	}

	resetZoom() {
		this.viewport.zoom = 1;
		this.viewport.panX = 0;
		this.viewport.panY = 0;
		this.onViewportChanged?.(this.viewport);
		this.renderBuffer();
		this.renderOverlay();
	}

	deleteSelected() {
		if (this.selectedIds.length === 0) return;
		const toDelete = [...this.selectedIds];
		const shapesToDelete: ShapeRecord[] = [];
		for (const id of toDelete) {
			const shape = this.shapes.get(id);
			if (shape) {
				shapesToDelete.push({ ...shape });
			}
		}

		this.selectedIds = [];
		this.onSelectionChanged?.(this.selectedIds);
		this.onShapesDeleted?.(toDelete);

		if (shapesToDelete.length > 0) {
			this.onActionRecorded?.({
				type: 'delete',
				shapes: shapesToDelete
			});
		}
	}

	private getNextZIndex(): number {
		let maxZ = 0;
		for (const s of this.shapes.values()) {
			if (s.zIndex > maxZ) maxZ = s.zIndex;
		}
		return maxZ + 1;
	}

	private calculatePointsBounds(points: PathPoint[]): BoundingBox {
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for (const p of points) {
			if (p.x < minX) minX = p.x;
			if (p.y < minY) minY = p.y;
			if (p.x > maxX) maxX = p.x;
			if (p.y > maxY) maxY = p.y;
		}

		return {
			minX,
			minY,
			maxX,
			maxY,
			width: Math.max(maxX - minX, 1),
			height: Math.max(maxY - minY, 1)
		};
	}

	private createTextInput(worldPos: { x: number; y: number }) {
		const text = prompt('Enter text:');
		if (!text) return;

		const shape: ShapeRecord = {
			id: 'shape_' + Math.random().toString(36).substring(2, 9),
			type: 'text',
			x: worldPos.x,
			y: worldPos.y,
			width: Math.max(text.length * 10, 60),
			height: 28,
			fill: 'transparent',
			stroke: this.strokeColor,
			strokeWidth: 1,
			rotation: 0,
			zIndex: this.getNextZIndex(),
			data: { text, fontSize: this.fontSize },
			createdBy: '',
			updatedAt: Date.now()
		};

		this.onShapesMutated?.([shape]);
		this.onActionRecorded?.({ type: 'create', shape });
	}

	// -------------------------------------------------------------
	// RENDERING PIPELINE
	// -------------------------------------------------------------

	/**
	 * Buffer Canvas: Renders committed shapes in z-index order.
	 * Only called when shapes or viewport changes.
	 */
	renderBuffer() {
		const ctx = this.staticCtx;
		const width = window.innerWidth;
		const height = window.innerHeight;

		ctx.save();
		ctx.clearRect(0, 0, width, height);

		// Apply viewport pan and zoom
		ctx.translate(this.viewport.panX, this.viewport.panY);
		ctx.scale(this.viewport.zoom, this.viewport.zoom);

		// Render grid dots for spatial orientation
		this.renderGrid(ctx);

		// Render shapes in sorted zIndex order
		const sorted = Array.from(this.shapes.values()).sort((a, b) => a.zIndex - b.zIndex);
		for (const shape of sorted) {
			this.drawShape(ctx, shape);
		}

		ctx.restore();
	}

	/**
	 * Overlay Canvas: 60fps loop for active stroke, cursors, and selection box.
	 */
	renderOverlay() {
		const ctx = this.overlayCtx;
		const width = window.innerWidth;
		const height = window.innerHeight;

		ctx.save();
		ctx.clearRect(0, 0, width, height);

		ctx.translate(this.viewport.panX, this.viewport.panY);
		ctx.scale(this.viewport.zoom, this.viewport.zoom);

		// 1. Draw in-progress active pen stroke
		if (this.interactionType === 'draw' && this.activePathPoints.length > 1) {
			ctx.beginPath();
			ctx.strokeStyle = this.strokeColor;
			ctx.lineWidth = this.strokeWidth;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';

			ctx.moveTo(this.activePathPoints[0].x, this.activePathPoints[0].y);
			for (let i = 1; i < this.activePathPoints.length; i++) {
				ctx.lineTo(this.activePathPoints[i].x, this.activePathPoints[i].y);
			}
			ctx.stroke();
		}

		// 2. Draw in-progress shape preview (rect, ellipse, sticky note)
		if (this.interactionType === 'create_shape') {
			const x = Math.min(this.startPoint.x, this.currentPoint.x);
			const y = Math.min(this.startPoint.y, this.currentPoint.y);
			const w = Math.abs(this.currentPoint.x - this.startPoint.x);
			const h = Math.abs(this.currentPoint.y - this.startPoint.y);

			ctx.save();
			ctx.strokeStyle = this.tool === 'sticky_note' ? '#eab308' : this.strokeColor;
			ctx.fillStyle = this.tool === 'sticky_note' ? 'rgba(254, 240, 138, 0.4)' : this.fillColor;
			ctx.lineWidth = this.strokeWidth;

			if (this.tool === 'rectangle' || this.tool === 'sticky_note') {
				ctx.beginPath();
				ctx.rect(x, y, w, h);
				if (this.fillColor !== 'transparent' || this.tool === 'sticky_note') ctx.fill();
				ctx.stroke();
			} else if (this.tool === 'ellipse') {
				ctx.beginPath();
				ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
				if (this.fillColor !== 'transparent') ctx.fill();
				ctx.stroke();
			}
			ctx.restore();
		}

		// 3. Draw selection bounding box and handles
		if (this.selectedIds.length > 0) {
			for (const id of this.selectedIds) {
				const shape = this.shapes.get(id);
				if (shape) {
					const b = getShapeBounds(shape);
					ctx.save();
					ctx.strokeStyle = '#6366f1'; // Electric Indigo selection color
					ctx.lineWidth = 1.5 / this.viewport.zoom;
					ctx.setLineDash([4 / this.viewport.zoom, 4 / this.viewport.zoom]);
					ctx.strokeRect(b.minX - 4, b.minY - 4, b.width + 8, b.height + 8);
					ctx.restore();
				}
			}
		}

		// 4. Draw marquee selection rectangle
		if (this.interactionType === 'marquee') {
			const minX = Math.min(this.startPoint.x, this.currentPoint.x);
			const minY = Math.min(this.startPoint.y, this.currentPoint.y);
			const w = Math.abs(this.currentPoint.x - this.startPoint.x);
			const h = Math.abs(this.currentPoint.y - this.startPoint.y);

			ctx.save();
			ctx.strokeStyle = '#6366f1';
			ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
			ctx.lineWidth = 1 / this.viewport.zoom;
			ctx.fillRect(minX, minY, w, h);
			ctx.strokeRect(minX, minY, w, h);
			ctx.restore();
		}

		// 5. Draw remote peer cursors
		for (const peer of this.peers) {
			if (peer.cursor) {
				this.drawPeerCursor(ctx, peer);
			}
		}

		ctx.restore();
	}

	private renderGrid(ctx: CanvasRenderingContext2D) {
		const dotSpacing = 32;
		const width = window.innerWidth;
		const height = window.innerHeight;

		const startWorld = screenToWorld(
			0,
			0,
			this.viewport.panX,
			this.viewport.panY,
			this.viewport.zoom
		);
		const endWorld = screenToWorld(
			width,
			height,
			this.viewport.panX,
			this.viewport.panY,
			this.viewport.zoom
		);

		const startX = Math.floor(startWorld.x / dotSpacing) * dotSpacing;
		const startY = Math.floor(startWorld.y / dotSpacing) * dotSpacing;

		ctx.save();
		ctx.fillStyle = '#27272a'; // zinc-800 subtle grid dots

		for (let x = startX; x <= endWorld.x; x += dotSpacing) {
			for (let y = startY; y <= endWorld.y; y += dotSpacing) {
				ctx.fillRect(x, y, 1.5, 1.5);
			}
		}
		ctx.restore();
	}

	private drawShape(ctx: CanvasRenderingContext2D, shape: ShapeRecord) {
		ctx.save();

		ctx.strokeStyle = shape.stroke || '#f4f4f5';
		ctx.fillStyle = shape.fill || 'transparent';
		ctx.lineWidth = shape.strokeWidth || 2;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		if (shape.type === 'path') {
			const points: PathPoint[] = shape.data?.points ?? [];
			if (points.length >= 2) {
				ctx.beginPath();
				ctx.moveTo(points[0].x, points[0].y);
				for (let i = 1; i < points.length; i++) {
					ctx.lineTo(points[i].x, points[i].y);
				}
				ctx.stroke();
			}
		} else if (shape.type === 'rectangle') {
			ctx.beginPath();
			ctx.roundRect(shape.x, shape.y, shape.width, shape.height, 4);
			if (shape.fill && shape.fill !== 'transparent') ctx.fill();
			ctx.stroke();
		} else if (shape.type === 'ellipse') {
			ctx.beginPath();
			const rx = Math.abs(shape.width / 2);
			const ry = Math.abs(shape.height / 2);
			ctx.ellipse(shape.x + rx, shape.y + ry, rx, ry, 0, 0, Math.PI * 2);
			if (shape.fill && shape.fill !== 'transparent') ctx.fill();
			ctx.stroke();
		} else if (shape.type === 'text') {
			const text = shape.data?.text || '';
			const fSize = shape.data?.fontSize || 18;
			ctx.font = `${fSize}px system-ui, -apple-system, sans-serif`;
			ctx.fillStyle = shape.stroke || '#f4f4f5';
			ctx.fillText(text, shape.x, shape.y + fSize);
		} else if (shape.type === 'sticky_note') {
			// Sticky note body
			ctx.save();
			ctx.fillStyle = shape.fill || '#fef08a'; // pale yellow
			ctx.strokeStyle = shape.stroke || '#eab308';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.roundRect(shape.x, shape.y, shape.width, shape.height, 6);
			ctx.fill();
			ctx.stroke();

			// Sticky note text
			const text = shape.data?.text || '';
			ctx.font = '14px system-ui, -apple-system, sans-serif';
			ctx.fillStyle = '#18181b'; // dark text on yellow
			ctx.fillText(text, shape.x + 10, shape.y + 24);
			ctx.restore();
		}

		ctx.restore();
	}

	private drawPeerCursor(ctx: CanvasRenderingContext2D, peer: PeerPresence) {
		if (!peer.cursor) return;

		ctx.save();
		const { x, y } = peer.cursor;
		const color = peer.color || '#06b6d4';

		// Draw SVG-style cursor arrow
		ctx.fillStyle = color;
		ctx.strokeStyle = '#000000';
		ctx.lineWidth = 1;

		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x, y + 15);
		ctx.lineTo(x + 4, y + 11);
		ctx.lineTo(x + 8, y + 18);
		ctx.lineTo(x + 11, y + 16);
		ctx.lineTo(x + 7, y + 10);
		ctx.lineTo(x + 12, y + 10);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();

		// Draw peer name pill
		const name = peer.name || 'Anonymous';
		ctx.font = '11px system-ui, sans-serif';
		const textWidth = ctx.measureText(name).width;

		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.roundRect(x + 14, y + 12, textWidth + 8, 18, 4);
		ctx.fill();

		ctx.fillStyle = '#000000';
		ctx.fillText(name, x + 18, y + 25);

		ctx.restore();
	}

	// -------------------------------------------------------------
	// EXPORT UTILITIES (PRD §10 Phase 4)
	// -------------------------------------------------------------

	exportToPng(filename = 'whiteboard.png') {
		if (this.shapes.size === 0) {
			alert('Canvas is empty.');
			return;
		}

		// Calculate total bounding box of all shapes
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for (const shape of this.shapes.values()) {
			const b = getShapeBounds(shape);
			if (b.minX < minX) minX = b.minX;
			if (b.minY < minY) minY = b.minY;
			if (b.maxX > maxX) maxX = b.maxX;
			if (b.maxY > maxY) maxY = b.maxY;
		}

		const padding = 40;
		const w = maxX - minX + padding * 2;
		const h = maxY - minY + padding * 2;

		const offscreen = document.createElement('canvas');
		offscreen.width = w;
		offscreen.height = h;
		const offCtx = offscreen.getContext('2d');
		if (!offCtx) return;

		// Dark canvas background (#121214)
		offCtx.fillStyle = '#121214';
		offCtx.fillRect(0, 0, w, h);

		offCtx.translate(-minX + padding, -minY + padding);

		const sorted = Array.from(this.shapes.values()).sort((a, b) => a.zIndex - b.zIndex);
		for (const shape of sorted) {
			this.drawShape(offCtx, shape);
		}

		const dataUrl = offscreen.toDataURL('image/png');
		const a = document.createElement('a');
		a.href = dataUrl;
		a.download = filename;
		a.click();
	}

	exportToSvg(filename = 'whiteboard.svg') {
		if (this.shapes.size === 0) {
			alert('Canvas is empty.');
			return;
		}

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for (const shape of this.shapes.values()) {
			const b = getShapeBounds(shape);
			if (b.minX < minX) minX = b.minX;
			if (b.minY < minY) minY = b.minY;
			if (b.maxX > maxX) maxX = b.maxX;
			if (b.maxY > maxY) maxY = b.maxY;
		}

		const padding = 40;
		const w = maxX - minX + padding * 2;
		const h = maxY - minY + padding * 2;

		let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - padding} ${minY - padding} ${w} ${h}" width="${w}" height="${h}">\n`;
		svgContent += `<rect x="${minX - padding}" y="${minY - padding}" width="${w}" height="${h}" fill="#121214"/>\n`;

		const sorted = Array.from(this.shapes.values()).sort((a, b) => a.zIndex - b.zIndex);
		for (const shape of sorted) {
			if (shape.type === 'path') {
				const points: PathPoint[] = shape.data?.points ?? [];
				if (points.length >= 2) {
					const d = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
					svgContent += `<path d="${d}" fill="none" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>\n`;
				}
			} else if (shape.type === 'rectangle') {
				svgContent += `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="4" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}"/>\n`;
			} else if (shape.type === 'ellipse') {
				const rx = shape.width / 2;
				const ry = shape.height / 2;
				svgContent += `<ellipse cx="${shape.x + rx}" cy="${shape.y + ry}" rx="${rx}" ry="${ry}" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}"/>\n`;
			} else if (shape.type === 'text') {
				const text = shape.data?.text || '';
				const fSize = shape.data?.fontSize || 18;
				svgContent += `<text x="${shape.x}" y="${shape.y + fSize}" font-family="system-ui, sans-serif" font-size="${fSize}" fill="${shape.stroke}">${text}</text>\n`;
			} else if (shape.type === 'sticky_note') {
				const text = shape.data?.text || '';
				svgContent += `<g>\n`;
				svgContent += `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="6" fill="${shape.fill || '#fef08a'}" stroke="${shape.stroke || '#eab308'}" stroke-width="1"/>\n`;
				svgContent += `<text x="${shape.x + 10}" y="${shape.y + 24}" font-family="system-ui, sans-serif" font-size="14" fill="#18181b">${text}</text>\n`;
				svgContent += `</g>\n`;
			}
		}

		svgContent += `</svg>`;

		const blob = new Blob([svgContent], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}
}
