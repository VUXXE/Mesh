import {
	calculateResizedBounds,
	getResizeCursor,
	getResizeHandles,
	getShapeBounds,
	hitTestResizeHandles,
	hitTestShape,
	isResizableShape,
	isShapeInsideMarquee,
	screenToWorld,
	simplifyRDP,
	worldToScreen,
	type BoundingBox,
	type ResizeHandle
} from './math';
import type { PathPoint, PeerPresence, ShapeRecord, ShapeType } from '../types';
import type { HistoryAction } from './history.svelte';

export type ToolMode =
	'select' | 'pen' | 'line' | 'arrow' | 'rectangle' | 'ellipse' | 'text' | 'sticky_note' | 'pan';

export const FONT_FAMILIES = {
	sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
	serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
	mono: '"JetBrains Mono", Menlo, Monaco, Consolas, "Courier New", monospace'
} as const;

export type FontFamilyKey = keyof typeof FONT_FAMILIES;

export const FONT_SIZES = [
	{ label: 'S', value: 14, title: 'Small (14px)' },
	{ label: 'M', value: 18, title: 'Medium (18px)' },
	{ label: 'L', value: 28, title: 'Large (28px)' },
	{ label: 'XL', value: 40, title: 'Extra Large (40px)' }
] as const;

export function getFontFamilyCss(family?: string): string {
	if (!family) return FONT_FAMILIES.sans;
	if (family in FONT_FAMILIES) return FONT_FAMILIES[family as FontFamilyKey];
	return family;
}

export function getFontFamilySvg(family?: string): string {
	const css = getFontFamilyCss(family);
	return css.replace(/"/g, "'");
}

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
	fontFamily = 'sans';

	isSpacePressed = false;
	isShiftPressed = false;

	// Active operation
	private isInteracting = false;
	private interactionType:
		| 'draw'
		| 'create_shape'
		| 'create_line'
		| 'create_text'
		| 'drag_selection'
		| 'resize_shape'
		| 'marquee'
		| 'pan'
		| 'pinch_zoom'
		| null = null;
	private activeResizeHandle: ResizeHandle | null = null;
	private resizeInitialPointer: { x: number; y: number } = { x: 0, y: 0 };
	private resizeInitialShape: ShapeRecord | null = null;
	private startPoint: { x: number; y: number } = { x: 0, y: 0 };
	private currentPoint: { x: number; y: number } = { x: 0, y: 0 };
	private activePathPoints: PathPoint[] = [];

	// Multi-touch tracking
	private activePointers = new Map<number, { x: number; y: number }>();
	private initialPinchDist = 0;
	private initialPinchMidpoint = { x: 0, y: 0 };
	private initialPinchZoom = 1;
	private initialPinchPan = { x: 0, y: 0 };

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
	onToolChanged?: (tool: ToolMode) => void;
	onStrokeColorChanged?: (color: string) => void;
	onStrokeWidthChanged?: (width: number) => void;
	onFontFamilyChanged?: (family: string) => void;
	onFontSizeChanged?: (size: number) => void;
	onTextShapeStyleChanged?: (shape: ShapeRecord) => void;
	editingShapeId: string | null = null;
	onStartTextEdit?: (shape: ShapeRecord) => void;
	onEndTextEdit?: () => void;

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
			if (e.key === 'Shift') this.isShiftPressed = true;
		});
		window.addEventListener('keyup', (e) => {
			if (e.code === 'Space') this.isSpacePressed = false;
			if (e.key === 'Shift') this.isShiftPressed = false;
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
		this.updateFontSettingsFromSelection();
		this.renderBuffer();
		this.renderOverlay();
	}

	setPeers(peers: PeerPresence[]) {
		this.peers = peers;
		this.renderOverlay();
	}

	private toolChangedListeners: ((tool: ToolMode) => void)[] = [];
	private selectionListeners: ((selectedIds: string[]) => void)[] = [];

	addToolChangedListener(fn: (tool: ToolMode) => void) {
		this.toolChangedListeners.push(fn);
	}

	removeToolChangedListener(fn: (tool: ToolMode) => void) {
		this.toolChangedListeners = this.toolChangedListeners.filter((l) => l !== fn);
	}

	addSelectionListener(fn: (selectedIds: string[]) => void) {
		this.selectionListeners.push(fn);
		return () => {
			this.selectionListeners = this.selectionListeners.filter((l) => l !== fn);
		};
	}

	setSelectedIds(ids: string[]) {
		this.selectedIds = ids;
		this.updateFontSettingsFromSelection();
		this.onSelectionChanged?.(this.selectedIds);
		for (const fn of this.selectionListeners) {
			fn(this.selectedIds);
		}
	}

	private updateFontSettingsFromSelection() {
		const textShape = this.selectedIds
			.map((id) => this.shapes.get(id))
			.find((s) => s?.type === 'text');
		if (textShape) {
			if (textShape.data?.fontFamily) {
				this.fontFamily = textShape.data.fontFamily;
				this.onFontFamilyChanged?.(this.fontFamily);
			}
			if (textShape.data?.fontSize) {
				this.fontSize = textShape.data.fontSize;
				this.onFontSizeChanged?.(this.fontSize);
			}
		}
	}

	setTool(tool: ToolMode) {
		this.tool = tool;
		if (tool !== 'select') {
			this.setSelectedIds([]);
		}
		this.overlayCanvas.style.cursor = '';
		this.renderOverlay();
		this.onToolChanged?.(tool);
		for (const fn of this.toolChangedListeners) {
			fn(tool);
		}
	}

	handlePointerLeave() {
		if (!this.isInteracting) {
			this.overlayCanvas.style.cursor = '';
			this.onCursorMoved?.(null);
		}
	}

	private updateHoverCursor(screenPos: { x: number; y: number }) {
		if (this.tool !== 'select' || this.selectedIds.length !== 1 || this.editingShapeId !== null) {
			this.overlayCanvas.style.cursor = '';
			return;
		}

		const selectedShape = this.shapes.get(this.selectedIds[0]);
		if (!selectedShape || !isResizableShape(selectedShape.type)) {
			this.overlayCanvas.style.cursor = '';
			return;
		}

		const bounds = getShapeBounds(selectedShape);
		const hitHandle = hitTestResizeHandles(
			screenPos,
			bounds,
			this.viewport.panX,
			this.viewport.panY,
			this.viewport.zoom
		);

		if (hitHandle) {
			this.overlayCanvas.style.cursor = getResizeCursor(hitHandle);
		} else {
			this.overlayCanvas.style.cursor = '';
		}
	}

	setStrokeColor(color: string) {
		this.strokeColor = color;
		this.applyPropertyToSelection({ stroke: color });
		this.onStrokeColorChanged?.(color);
	}

	setFillColor(color: string) {
		this.fillColor = color;
		this.applyPropertyToSelection({ fill: color });
	}

	setStrokeWidth(width: number) {
		this.strokeWidth = width;
		this.applyPropertyToSelection({ strokeWidth: width });
		this.onStrokeWidthChanged?.(width);
	}

	calculateTextBounds(
		text: string,
		fontSize: number,
		fontFamily: string = 'sans'
	): { width: number; height: number } {
		if (!text) {
			return { width: 140, height: Math.max(Math.round(fontSize * 1.3), 32) };
		}
		const lines = text.split('\n');
		const fFamily = getFontFamilyCss(fontFamily);
		let maxWidth = 0;
		if (this.staticCtx) {
			this.staticCtx.save();
			this.staticCtx.font = `${fontSize}px ${fFamily}`;
			for (const line of lines) {
				const metrics = this.staticCtx.measureText(line);
				if (metrics.width > maxWidth) {
					maxWidth = metrics.width;
				}
			}
			this.staticCtx.restore();
		} else {
			const maxLineLength = Math.max(...lines.map((l) => l.length), 1);
			maxWidth = maxLineLength * (fontSize * 0.62);
		}
		const lineHeight = Math.round(fontSize * 1.3);
		return {
			width: Math.max(Math.ceil(maxWidth + 8), 40),
			height: Math.max(lines.length * lineHeight, 28)
		};
	}

	setFontFamily(family: string) {
		this.fontFamily = family;
		this.onFontFamilyChanged?.(family);

		const targetIds = new Set(this.selectedIds);
		if (this.editingShapeId) {
			targetIds.add(this.editingShapeId);
		}

		const textShapes: ShapeRecord[] = [];
		for (const id of targetIds) {
			const shape = this.shapes.get(id);
			if (shape && shape.type === 'text') {
				textShapes.push(shape);
			}
		}

		if (textShapes.length > 0) {
			const before: ShapeRecord[] = [];
			const modified: ShapeRecord[] = [];
			const now = Date.now();

			for (const shape of textShapes) {
				before.push({ ...shape, data: { ...shape.data } });
				const nextData = {
					...shape.data,
					fontFamily: family
				};
				const fontSize = nextData.fontSize || this.fontSize;
				const text = nextData.text || '';
				const bounds = this.calculateTextBounds(text, fontSize, family);

				const updated: ShapeRecord = {
					...shape,
					width: bounds.width,
					height: bounds.height,
					data: nextData,
					updatedAt: now
				};
				this.shapes.set(shape.id, updated);
				modified.push(updated);

				if (this.editingShapeId === shape.id) {
					this.onTextShapeStyleChanged?.(updated);
				}
			}

			this.onShapesMutated?.(modified);
			this.onActionRecorded?.({
				type: 'modify',
				before,
				after: modified
			});
			this.renderBuffer();
			this.renderOverlay();
		}
	}

	setFontSize(size: number) {
		this.fontSize = size;
		this.onFontSizeChanged?.(size);

		const targetIds = new Set(this.selectedIds);
		if (this.editingShapeId) {
			targetIds.add(this.editingShapeId);
		}

		const textShapes: ShapeRecord[] = [];
		for (const id of targetIds) {
			const shape = this.shapes.get(id);
			if (shape && shape.type === 'text') {
				textShapes.push(shape);
			}
		}

		if (textShapes.length > 0) {
			const before: ShapeRecord[] = [];
			const modified: ShapeRecord[] = [];
			const now = Date.now();

			for (const shape of textShapes) {
				before.push({ ...shape, data: { ...shape.data } });
				const nextData = {
					...shape.data,
					fontSize: size
				};
				const family = nextData.fontFamily || this.fontFamily;
				const text = nextData.text || '';
				const bounds = this.calculateTextBounds(text, size, family);

				const updated: ShapeRecord = {
					...shape,
					width: bounds.width,
					height: bounds.height,
					data: nextData,
					updatedAt: now
				};
				this.shapes.set(shape.id, updated);
				modified.push(updated);

				if (this.editingShapeId === shape.id) {
					this.onTextShapeStyleChanged?.(updated);
				}
			}

			this.onShapesMutated?.(modified);
			this.onActionRecorded?.({
				type: 'modify',
				before,
				after: modified
			});
			this.renderBuffer();
			this.renderOverlay();
		}
	}

	private applyPropertyToSelection(props: Partial<ShapeRecord>) {
		if (this.selectedIds.length === 0) return;
		const before: ShapeRecord[] = [];
		const modified: ShapeRecord[] = [];
		const now = Date.now();

		for (const id of this.selectedIds) {
			const shape = this.shapes.get(id);
			if (shape) {
				before.push({ ...shape, data: shape.data ? { ...shape.data } : undefined });
				const updated: ShapeRecord = {
					...shape,
					...props,
					updatedAt: now
				};
				this.shapes.set(id, updated);
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
			this.renderBuffer();
			this.renderOverlay();
		}
	}

	private calculateLineEndPoint(
		start: { x: number; y: number },
		current: { x: number; y: number },
		snap: boolean
	): { x: number; y: number } {
		if (!snap) return current;
		const dx = current.x - start.x;
		const dy = current.y - start.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		let angle = Math.atan2(dy, dx);
		const snapInterval = Math.PI / 4; // 45 degrees
		angle = Math.round(angle / snapInterval) * snapInterval;
		return {
			x: start.x + dist * Math.cos(angle),
			y: start.y + dist * Math.sin(angle)
		};
	}

	private drawArrowHead(
		ctx: CanvasRenderingContext2D,
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
		color: string,
		width: number
	) {
		const headLength = Math.max(width * 4, 12);
		const angle = Math.atan2(toY - fromY, toX - fromX);
		const arrowAngle = Math.PI / 6;

		ctx.save();
		ctx.fillStyle = color;
		ctx.strokeStyle = color;
		ctx.lineWidth = width;
		ctx.beginPath();
		ctx.moveTo(toX, toY);
		ctx.lineTo(
			toX - headLength * Math.cos(angle - arrowAngle),
			toY - headLength * Math.sin(angle - arrowAngle)
		);
		ctx.lineTo(
			toX - headLength * Math.cos(angle + arrowAngle),
			toY - headLength * Math.sin(angle + arrowAngle)
		);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}

	// -------------------------------------------------------------
	// POINTER EVENT HANDLERS
	// -------------------------------------------------------------

	handlePointerDown(e: PointerEvent) {
		this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

		// Multi-touch pinch-to-zoom and two-finger pan
		if (this.activePointers.size === 2) {
			const [p1, p2] = Array.from(this.activePointers.values());
			this.initialPinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
			this.initialPinchMidpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
			this.initialPinchZoom = this.viewport.zoom;
			this.initialPinchPan = { x: this.viewport.panX, y: this.viewport.panY };
			this.interactionType = 'pinch_zoom';
			this.isInteracting = true;
			this.activePathPoints = [];
			this.renderOverlay();
			return;
		}

		if (this.activePointers.size > 2) {
			return;
		}

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

		if (this.tool === 'line' || this.tool === 'arrow') {
			this.interactionType = 'create_line';
			this.renderOverlay();
			return;
		}

		if (this.tool === 'rectangle' || this.tool === 'ellipse' || this.tool === 'sticky_note') {
			this.interactionType = 'create_shape';
			this.renderOverlay();
			return;
		}

		if (this.tool === 'text') {
			this.interactionType = 'create_text';
			this.renderOverlay();
			return;
		}

		if (this.tool === 'select') {
			// Hit-test resize handles if single resizable shape is selected
			if (this.selectedIds.length === 1) {
				const selectedShape = this.shapes.get(this.selectedIds[0]);
				if (
					selectedShape &&
					isResizableShape(selectedShape.type) &&
					this.editingShapeId !== selectedShape.id
				) {
					const bounds = getShapeBounds(selectedShape);
					const hitHandle = hitTestResizeHandles(
						screenPos,
						bounds,
						this.viewport.panX,
						this.viewport.panY,
						this.viewport.zoom
					);
					if (hitHandle) {
						this.interactionType = 'resize_shape';
						this.activeResizeHandle = hitHandle;
						this.resizeInitialPointer = { x: worldPos.x, y: worldPos.y };
						this.resizeInitialShape = {
							...selectedShape,
							data: selectedShape.data ? { ...selectedShape.data } : undefined
						};
						this.overlayCanvas.style.cursor = getResizeCursor(hitHandle);
						this.renderOverlay();
						return;
					}
				}
			}

			// Hit-test shapes in reverse zIndex order (top-most first)
			const sortedShapes = Array.from(this.shapes.values()).sort((a, b) => b.zIndex - a.zIndex);
			const hit = sortedShapes.find((s) => hitTestShape(worldPos, s));

			if (hit) {
				let nextSelected = [...this.selectedIds];
				if (e.shiftKey) {
					if (nextSelected.includes(hit.id)) {
						nextSelected = nextSelected.filter((id) => id !== hit.id);
					} else {
						nextSelected.push(hit.id);
					}
				} else {
					if (!nextSelected.includes(hit.id)) {
						nextSelected = [hit.id];
					}
				}
				this.setSelectedIds(nextSelected);

				this.interactionType = 'drag_selection';
				this.dragInitialPositions.clear();
				this.dragInitialShapes.clear();
				for (const id of this.selectedIds) {
					const shape = this.shapes.get(id);
					if (shape) {
						this.dragInitialPositions.set(id, { x: shape.x, y: shape.y });
						const snapshot: ShapeRecord =
							shape.type === 'path'
								? {
										...shape,
										data: {
											...shape.data,
											points: (shape.data?.points ?? []).map((p: PathPoint) => ({ ...p }))
										}
									}
								: { ...shape };
						this.dragInitialShapes.set(id, snapshot);
					}
				}
			} else {
				if (!e.shiftKey) {
					this.setSelectedIds([]);
				}
				this.interactionType = 'marquee';
			}

			this.renderOverlay();
		}
	}

	handlePointerMove(e: PointerEvent) {
		if (this.activePointers.has(e.pointerId)) {
			this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		}

		if (this.activePointers.size === 2 && this.interactionType === 'pinch_zoom') {
			const [p1, p2] = Array.from(this.activePointers.values());
			const currentDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
			const currentMidpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

			if (this.initialPinchDist > 0) {
				const scale = currentDist / this.initialPinchDist;
				const newZoom = Math.min(Math.max(this.initialPinchZoom * scale, 0.1), 5.0);

				const mX = this.initialPinchMidpoint.x;
				const mY = this.initialPinchMidpoint.y;
				const panDeltaX = currentMidpoint.x - this.initialPinchMidpoint.x;
				const panDeltaY = currentMidpoint.y - this.initialPinchMidpoint.y;

				this.viewport.zoom = newZoom;
				this.viewport.panX =
					mX - (mX - this.initialPinchPan.x) * (newZoom / this.initialPinchZoom) + panDeltaX;
				this.viewport.panY =
					mY - (mY - this.initialPinchPan.y) * (newZoom / this.initialPinchZoom) + panDeltaY;

				this.onViewportChanged?.(this.viewport);
				this.renderBuffer();
				this.renderOverlay();
			}
			return;
		}

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
			this.updateHoverCursor(screenPos);
			this.renderOverlay();
			return;
		}

		if (this.interactionType === 'resize_shape') {
			if (!this.activeResizeHandle || !this.resizeInitialShape) return;
			const shape = this.shapes.get(this.resizeInitialShape.id);
			if (!shape) return;

			this.overlayCanvas.style.cursor = getResizeCursor(this.activeResizeHandle);

			const isShift = e.shiftKey || this.isShiftPressed;
			const minW = shape.type === 'sticky_note' ? 80 : shape.type === 'text' ? 20 : 10;
			const minH = shape.type === 'sticky_note' ? 80 : shape.type === 'text' ? 16 : 10;

			const resized = calculateResizedBounds({
				handle: this.activeResizeHandle,
				initialBounds: {
					x: this.resizeInitialShape.x,
					y: this.resizeInitialShape.y,
					width: this.resizeInitialShape.width,
					height: this.resizeInitialShape.height
				},
				startPoint: this.resizeInitialPointer,
				currentPoint: worldPos,
				maintainAspectRatio: isShift,
				minWidth: minW,
				minHeight: minH
			});

			shape.x = resized.x;
			shape.y = resized.y;
			shape.width = resized.width;
			shape.height = resized.height;

			if (shape.type === 'text' && this.resizeInitialShape.height > 0) {
				const scale = resized.height / this.resizeInitialShape.height;
				const initialFontSize = this.resizeInitialShape.data?.fontSize || 18;
				shape.data = {
					...shape.data,
					fontSize: Math.max(Math.round(initialFontSize * scale), 8)
				};
			}

			this.renderBuffer();
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

		if (this.interactionType === 'create_shape' || this.interactionType === 'create_line') {
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
					if (shape.type === 'path') {
						const initialPoints: PathPoint[] = this.dragInitialShapes.get(id)?.data?.points ?? [];
						shape.data = {
							...shape.data,
							points: initialPoints.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }))
						};
					}
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

			this.setSelectedIds(insideIds);
			this.renderOverlay();
		}
	}

	handlePointerUp(e?: PointerEvent) {
		if (e) {
			this.activePointers.delete(e.pointerId);
		} else {
			this.activePointers.clear();
		}

		if (this.interactionType === 'pinch_zoom') {
			if (this.activePointers.size < 2) {
				this.isInteracting = false;
				this.interactionType = null;
				this.initialPinchDist = 0;
			}
			return;
		}

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
		} else if (this.interactionType === 'create_line') {
			const end = this.calculateLineEndPoint(
				this.startPoint,
				this.currentPoint,
				this.isShiftPressed
			);
			const dx = end.x - this.startPoint.x;
			const dy = end.y - this.startPoint.y;
			if (Math.hypot(dx, dy) >= 3) {
				const points: PathPoint[] = [
					{ x: this.startPoint.x, y: this.startPoint.y, pressure: 0.5 },
					{ x: end.x, y: end.y, pressure: 0.5 }
				];
				const bounds = this.calculatePointsBounds(points);
				const isArrow = this.tool === 'arrow';

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
					data: { points, isArrow },
					createdBy: '',
					updatedAt: now
				};

				this.onShapesMutated?.([shape]);
				this.onActionRecorded?.({ type: 'create', shape });
			}
		} else if (this.interactionType === 'create_shape') {
			let x = Math.min(this.startPoint.x, this.currentPoint.x);
			let y = Math.min(this.startPoint.y, this.currentPoint.y);
			let width = Math.abs(this.currentPoint.x - this.startPoint.x);
			let height = Math.abs(this.currentPoint.y - this.startPoint.y);

			let shapeType: ShapeType = 'rectangle';
			let shapeData: any = undefined;

			if (this.tool === 'ellipse') {
				shapeType = 'ellipse';
				width = Math.max(width, 10);
				height = Math.max(height, 10);
			} else if (this.tool === 'sticky_note') {
				shapeType = 'sticky_note';
				shapeData = { text: '' };
				if (width < 15 && height < 15) {
					width = 180;
					height = 180;
					x = this.startPoint.x - 90;
					y = this.startPoint.y - 90;
				} else {
					width = Math.max(width, 80);
					height = Math.max(height, 80);
				}
			} else {
				width = Math.max(width, 10);
				height = Math.max(height, 10);
			}

			const shape: ShapeRecord = {
				id: 'shape_' + Math.random().toString(36).substring(2, 9),
				type: shapeType,
				x,
				y,
				width,
				height,
				fill: shapeType === 'sticky_note' ? '#fef08a' : this.fillColor,
				stroke: shapeType === 'sticky_note' ? '#eab308' : this.strokeColor,
				strokeWidth: shapeType === 'sticky_note' ? 1 : this.strokeWidth,
				rotation: 0,
				zIndex: this.getNextZIndex(),
				data: shapeData,
				createdBy: '',
				updatedAt: now
			};

			this.shapes.set(shape.id, shape);
			this.onShapesMutated?.([shape]);
			this.onActionRecorded?.({ type: 'create', shape });
			this.renderBuffer();

			if (shapeType === 'sticky_note') {
				this.setSelectedIds([shape.id]);
				this.startTextEdit(shape);
			}
		} else if (this.interactionType === 'create_text') {
			this.createTextInput(this.startPoint);
		} else if (this.interactionType === 'drag_selection') {
			const movedShapes: ShapeRecord[] = [];
			const beforeShapes: ShapeRecord[] = [];
			for (const id of this.selectedIds) {
				const shape = this.shapes.get(id);
				const initial = this.dragInitialShapes.get(id);
				if (shape && initial && (shape.x !== initial.x || shape.y !== initial.y)) {
					shape.updatedAt = now;
					const moved: ShapeRecord =
						shape.type === 'path'
							? {
									...shape,
									data: {
										...shape.data,
										points: (shape.data?.points ?? []).map((p: PathPoint) => ({ ...p }))
									}
								}
							: { ...shape };
					movedShapes.push(moved);
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
		} else if (this.interactionType === 'resize_shape') {
			if (this.resizeInitialShape && this.selectedIds.length === 1) {
				const shape = this.shapes.get(this.selectedIds[0]);
				const initial = this.resizeInitialShape;
				if (
					shape &&
					(shape.x !== initial.x ||
						shape.y !== initial.y ||
						shape.width !== initial.width ||
						shape.height !== initial.height ||
						shape.data?.fontSize !== initial.data?.fontSize)
				) {
					shape.updatedAt = now;
					const mutated = { ...shape };
					this.onShapesMutated?.([mutated]);
					this.onActionRecorded?.({
						type: 'modify',
						before: [initial],
						after: [mutated]
					});
				}
			}
			this.resizeInitialShape = null;
			this.activeResizeHandle = null;
			if (e) {
				this.updateHoverCursor({ x: e.clientX, y: e.clientY });
			} else {
				this.overlayCanvas.style.cursor = '';
			}
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

		this.setSelectedIds([]);
		this.onShapesDeleted?.(toDelete);

		if (shapesToDelete.length > 0) {
			this.onActionRecorded?.({
				type: 'delete',
				shapes: shapesToDelete
			});
		}
	}

	getShape(id: string): ShapeRecord | undefined {
		return this.shapes.get(id);
	}

	updateShape(shape: ShapeRecord) {
		this.shapes.set(shape.id, shape);
		this.renderBuffer();
	}

	deleteShapeById(id: string) {
		const shape = this.shapes.get(id);
		this.shapes.delete(id);
		this.setSelectedIds(this.selectedIds.filter((sid) => sid !== id));
		this.onShapesDeleted?.([id]);
		if (shape) {
			this.onActionRecorded?.({
				type: 'delete',
				shapes: [shape]
			});
		}
		this.overlayCanvas.style.cursor = '';
		this.renderBuffer();
		this.renderOverlay();
	}

	startTextEdit(shape: ShapeRecord) {
		this.isInteracting = false;
		this.interactionType = null;
		this.overlayCanvas.style.cursor = 'default';
		this.editingShapeId = shape.id;
		this.renderBuffer();
		this.renderOverlay();
		this.onStartTextEdit?.(shape);
	}

	endTextEdit() {
		this.editingShapeId = null;
		this.renderBuffer();
		this.renderOverlay();
		const evt = window.event as MouseEvent | undefined;
		this.updateHoverCursor({
			x: evt?.clientX ?? -1000,
			y: evt?.clientY ?? -1000
		});
		this.onEndTextEdit?.();
	}

	handleDblClick(e: MouseEvent) {
		const worldPos = screenToWorld(
			e.clientX,
			e.clientY,
			this.viewport.panX,
			this.viewport.panY,
			this.viewport.zoom
		);

		const sortedShapes = Array.from(this.shapes.values()).sort((a, b) => b.zIndex - a.zIndex);
		const hit = sortedShapes.find((s) => hitTestShape(worldPos, s));

		if (hit && (hit.type === 'sticky_note' || hit.type === 'text')) {
			this.isInteracting = false;
			this.interactionType = null;
			this.setSelectedIds([hit.id]);
			this.startTextEdit(hit);
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
		const now = Date.now();
		const shape: ShapeRecord = {
			id: 'shape_' + Math.random().toString(36).substring(2, 9),
			type: 'text',
			x: worldPos.x,
			y: worldPos.y,
			width: 140,
			height: Math.max(Math.round(this.fontSize * 1.3), 32),
			fill: 'transparent',
			stroke: this.strokeColor,
			strokeWidth: 1,
			rotation: 0,
			zIndex: this.getNextZIndex(),
			data: { text: '', fontSize: this.fontSize, fontFamily: this.fontFamily },
			createdBy: '',
			updatedAt: now
		};

		this.shapes.set(shape.id, shape);
		this.onShapesMutated?.([shape]);
		this.onActionRecorded?.({ type: 'create', shape });
		this.setSelectedIds([shape.id]);
		this.startTextEdit(shape);
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

		// 2. Draw in-progress line or arrow preview
		if (this.interactionType === 'create_line') {
			const end = this.calculateLineEndPoint(
				this.startPoint,
				this.currentPoint,
				this.isShiftPressed
			);
			ctx.save();
			ctx.strokeStyle = this.strokeColor;
			ctx.fillStyle = this.strokeColor;
			ctx.lineWidth = this.strokeWidth;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';

			ctx.beginPath();
			ctx.moveTo(this.startPoint.x, this.startPoint.y);
			ctx.lineTo(end.x, end.y);
			ctx.stroke();

			if (this.tool === 'arrow') {
				this.drawArrowHead(
					ctx,
					this.startPoint.x,
					this.startPoint.y,
					end.x,
					end.y,
					this.strokeColor,
					this.strokeWidth
				);
			}
			ctx.restore();
		}

		// 3. Draw in-progress shape preview (rect, ellipse, sticky note)
		if (this.interactionType === 'create_shape') {
			const x = Math.min(this.startPoint.x, this.currentPoint.x);
			const y = Math.min(this.startPoint.y, this.currentPoint.y);
			const w = Math.abs(this.currentPoint.x - this.startPoint.x);
			const h = Math.abs(this.currentPoint.y - this.startPoint.y);

			ctx.save();
			ctx.strokeStyle = this.tool === 'sticky_note' ? '#eab308' : this.strokeColor;
			ctx.fillStyle = this.tool === 'sticky_note' ? 'rgba(254, 240, 138, 0.4)' : this.fillColor;
			ctx.lineWidth = this.strokeWidth;

			if (this.tool === 'sticky_note') {
				ctx.beginPath();
				ctx.roundRect(x, y, w, h, 6);
				ctx.fill();
				ctx.stroke();
			} else if (this.tool === 'rectangle') {
				ctx.beginPath();
				ctx.rect(x, y, w, h);
				if (this.fillColor !== 'transparent') ctx.fill();
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
			const isSingleSelection = this.selectedIds.length === 1;
			const singleShape = isSingleSelection ? this.shapes.get(this.selectedIds[0]) : null;
			const canResizeSingle =
				singleShape && isResizableShape(singleShape.type) && this.editingShapeId !== singleShape.id;

			for (const id of this.selectedIds) {
				const shape = this.shapes.get(id);
				if (shape) {
					const b = getShapeBounds(shape);
					ctx.save();
					ctx.strokeStyle = '#6366f1'; // Electric Indigo selection color
					ctx.lineWidth = 1.5 / this.viewport.zoom;
					ctx.setLineDash([4 / this.viewport.zoom, 4 / this.viewport.zoom]);
					if (canResizeSingle) {
						ctx.strokeRect(b.minX, b.minY, b.width, b.height);
					} else {
						ctx.strokeRect(b.minX - 4, b.minY - 4, b.width + 8, b.height + 8);
					}
					ctx.restore();
				}
			}

			// Draw 8 resize handles for single selected resizable shape
			if (canResizeSingle && singleShape) {
				const b = getShapeBounds(singleShape);
				const handles = getResizeHandles(b);

				const handleSize = 8 / this.viewport.zoom;
				const halfSize = handleSize / 2;

				ctx.save();
				ctx.fillStyle = '#ffffff';
				ctx.strokeStyle = '#6366f1';
				ctx.lineWidth = 1.5 / this.viewport.zoom;
				ctx.setLineDash([]); // solid border for handles

				for (const pos of Object.values(handles)) {
					ctx.beginPath();
					ctx.fillRect(pos.x - halfSize, pos.y - halfSize, handleSize, handleSize);
					ctx.strokeRect(pos.x - halfSize, pos.y - halfSize, handleSize, handleSize);
				}
				ctx.restore();
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

				if (shape.data?.isArrow && points.length >= 2) {
					const p1 = points[points.length - 2];
					const p2 = points[points.length - 1];
					this.drawArrowHead(
						ctx,
						p1.x,
						p1.y,
						p2.x,
						p2.y,
						shape.stroke || '#f4f4f5',
						shape.strokeWidth || 2
					);
				}
			}
		} else if (shape.type === 'rectangle') {
			ctx.beginPath();
			const rx = Math.min(shape.x, shape.x + shape.width);
			const ry = Math.min(shape.y, shape.y + shape.height);
			const rw = Math.max(Math.abs(shape.width), 1);
			const rh = Math.max(Math.abs(shape.height), 1);
			ctx.roundRect(rx, ry, rw, rh, 4);
			if (shape.fill && shape.fill !== 'transparent') ctx.fill();
			ctx.stroke();
		} else if (shape.type === 'ellipse') {
			ctx.beginPath();
			const rx = Math.max(Math.abs(shape.width / 2), 1);
			const ry = Math.max(Math.abs(shape.height / 2), 1);
			ctx.ellipse(shape.x + shape.width / 2, shape.y + shape.height / 2, rx, ry, 0, 0, Math.PI * 2);
			if (shape.fill && shape.fill !== 'transparent') ctx.fill();
			ctx.stroke();
		} else if (shape.type === 'text') {
			if (this.editingShapeId !== shape.id || ctx !== this.staticCtx) {
				const text = shape.data?.text || '';
				if (text) {
					const fSize = shape.data?.fontSize || 18;
					const fFamily = getFontFamilyCss(shape.data?.fontFamily || 'sans');
					ctx.font = `${fSize}px ${fFamily}`;
					ctx.fillStyle = shape.stroke || '#f4f4f5';
					ctx.textBaseline = 'top';
					const lineHeight = Math.round(fSize * 1.3);
					const lines = text.split('\n');
					let curY = shape.y;
					for (const line of lines) {
						ctx.fillText(line, shape.x, curY);
						curY += lineHeight;
					}
				}
			}
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
			if (this.editingShapeId !== shape.id || ctx !== this.staticCtx) {
				const text = shape.data?.text || '';
				if (text) {
					ctx.font = '14px system-ui, -apple-system, sans-serif';
					ctx.fillStyle = '#18181b'; // dark text on yellow
					ctx.textBaseline = 'top';

					const padding = 12;
					const maxWidth = Math.max(shape.width - padding * 2, 20);
					const maxHeight = Math.max(shape.height - padding * 2, 20);
					const lineHeight = 18;

					ctx.save();
					ctx.beginPath();
					ctx.rect(shape.x + padding, shape.y + padding, maxWidth, maxHeight);
					ctx.clip();

					const lines = this.wrapText(ctx, text, maxWidth);
					let currentY = shape.y + padding;
					for (const line of lines) {
						if (currentY + lineHeight > shape.y + shape.height) break;
						ctx.fillText(line, shape.x + padding, currentY);
						currentY += lineHeight;
					}
					ctx.restore();
				}
			}
			ctx.restore();
		}

		ctx.restore();
	}

	private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
		const result: string[] = [];
		const rawLines = text.split('\n');

		for (const rawLine of rawLines) {
			if (rawLine === '') {
				result.push('');
				continue;
			}
			const words = rawLine.split(' ');
			let currentLine = '';

			for (let i = 0; i < words.length; i++) {
				const word = words[i];
				const testLine = currentLine ? `${currentLine} ${word}` : word;
				if (ctx.measureText(testLine).width > maxWidth && currentLine) {
					result.push(currentLine);
					currentLine = word;
				} else {
					currentLine = testLine;
				}

				if (ctx.measureText(currentLine).width > maxWidth) {
					let sub = '';
					for (const char of currentLine) {
						if (ctx.measureText(sub + char).width > maxWidth && sub) {
							result.push(sub);
							sub = char;
						} else {
							sub += char;
						}
					}
					currentLine = sub;
				}
			}
			if (currentLine) {
				result.push(currentLine);
			}
		}

		return result;
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

	private triggerBrowserDownload(source: string | Blob, filename: string) {
		const isBlob = typeof source !== 'string';
		const url = isBlob ? URL.createObjectURL(source) : source;
		const a = document.createElement('a');
		a.style.display = 'none';
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			if (document.body.contains(a)) {
				document.body.removeChild(a);
			}
			if (isBlob) {
				URL.revokeObjectURL(url);
			}
		}, 300);
	}

	exportToPng(filename = 'mesh-whiteboard.png', scale = 2) {
		if (this.shapes.size === 0) {
			alert('Canvas is empty. Draw something before exporting.');
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
		const w = Math.max(maxX - minX + padding * 2, 100);
		const h = Math.max(maxY - minY + padding * 2, 100);

		const offscreen = document.createElement('canvas');
		offscreen.width = Math.round(w * scale);
		offscreen.height = Math.round(h * scale);
		const offCtx = offscreen.getContext('2d');
		if (!offCtx) return;

		offCtx.scale(scale, scale);

		// Dark canvas background (#121214)
		offCtx.fillStyle = '#121214';
		offCtx.fillRect(0, 0, w, h);

		offCtx.translate(-minX + padding, -minY + padding);

		const sorted = Array.from(this.shapes.values()).sort((a, b) => a.zIndex - b.zIndex);
		for (const shape of sorted) {
			this.drawShape(offCtx, shape);
		}

		const dataUrl = offscreen.toDataURL('image/png');
		this.triggerBrowserDownload(dataUrl, filename);
	}

	exportToSvg(filename = 'mesh-whiteboard.svg') {
		if (this.shapes.size === 0) {
			alert('Canvas is empty. Draw something before exporting.');
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
		const w = Math.max(maxX - minX + padding * 2, 100);
		const h = Math.max(maxY - minY + padding * 2, 100);

		let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - padding} ${minY - padding} ${w} ${h}" width="${w}" height="${h}">\n`;
		svgContent += `<rect x="${minX - padding}" y="${minY - padding}" width="${w}" height="${h}" fill="#121214"/>\n`;

		const sorted = Array.from(this.shapes.values()).sort((a, b) => a.zIndex - b.zIndex);
		for (const shape of sorted) {
			if (shape.type === 'path') {
				const points: PathPoint[] = shape.data?.points ?? [];
				if (points.length >= 2) {
					const d = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
					svgContent += `<path d="${d}" fill="none" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>\n`;

					if (shape.data?.isArrow && points.length >= 2) {
						const p1 = points[points.length - 2];
						const p2 = points[points.length - 1];
						const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
						const headLength = Math.max((shape.strokeWidth || 2) * 4, 12);
						const arrowAngle = Math.PI / 6;
						const x1 = p2.x - headLength * Math.cos(angle - arrowAngle);
						const y1 = p2.y - headLength * Math.sin(angle - arrowAngle);
						const x2 = p2.x - headLength * Math.cos(angle + arrowAngle);
						const y2 = p2.y - headLength * Math.sin(angle + arrowAngle);
						svgContent += `<polygon points="${p2.x},${p2.y} ${x1},${y1} ${x2},${y2}" fill="${shape.stroke}"/>\n`;
					}
				}
			} else if (shape.type === 'rectangle') {
				const rx = Math.min(shape.x, shape.x + shape.width);
				const ry = Math.min(shape.y, shape.y + shape.height);
				const rw = Math.max(Math.abs(shape.width), 1);
				const rh = Math.max(Math.abs(shape.height), 1);
				svgContent += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="4" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}"/>\n`;
			} else if (shape.type === 'ellipse') {
				const rx = Math.max(Math.abs(shape.width / 2), 1);
				const ry = Math.max(Math.abs(shape.height / 2), 1);
				const cx = shape.x + shape.width / 2;
				const cy = shape.y + shape.height / 2;
				svgContent += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}"/>\n`;
			} else if (shape.type === 'text') {
				const text = shape.data?.text || '';
				const fSize = shape.data?.fontSize || 18;
				const fFamily = getFontFamilySvg(shape.data?.fontFamily || 'sans');
				const lines = text.split('\n');
				svgContent += `<text x="${shape.x}" y="${shape.y + fSize}" font-family="${fFamily}" font-size="${fSize}" fill="${shape.stroke}">\n`;
				for (let i = 0; i < lines.length; i++) {
					const dy = i === 0 ? '0' : '1.3em';
					svgContent += `<tspan x="${shape.x}" dy="${dy}">${this.escapeXml(lines[i])}</tspan>\n`;
				}
				svgContent += `</text>\n`;
			} else if (shape.type === 'sticky_note') {
				const text = shape.data?.text || '';
				const lines = text.split('\n');
				svgContent += `<g>\n`;
				svgContent += `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="6" fill="${shape.fill || '#fef08a'}" stroke="${shape.stroke || '#eab308'}" stroke-width="1"/>\n`;
				if (lines.length > 0 && lines.some((l: string) => l.length > 0)) {
					svgContent += `<text x="${shape.x + 12}" y="${shape.y + 24}" font-family="system-ui, sans-serif" font-size="14" fill="#18181b">\n`;
					for (let i = 0; i < lines.length; i++) {
						const dy = i === 0 ? '0' : '1.3em';
						svgContent += `<tspan x="${shape.x + 12}" dy="${dy}">${this.escapeXml(lines[i])}</tspan>\n`;
					}
					svgContent += `</text>\n`;
				}
				svgContent += `</g>\n`;
			}
		}

		svgContent += `</svg>`;

		const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
		this.triggerBrowserDownload(blob, filename);
	}

	private escapeXml(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}

	exportToJson(filename = 'mesh-whiteboard.json') {
		if (this.shapes.size === 0) {
			alert('Canvas is empty. Draw something before exporting.');
			return;
		}

		const exportData = {
			app: 'Mesh',
			version: '1.0.0',
			exportedAt: new Date().toISOString(),
			shapes: Array.from(this.shapes.values())
		};

		const blob = new Blob([JSON.stringify(exportData, null, 2)], {
			type: 'application/json;charset=utf-8'
		});
		this.triggerBrowserDownload(blob, filename);
	}

	importFromJson(jsonString: string): ShapeRecord[] | null {
		try {
			const parsed = JSON.parse(jsonString);
			const rawShapes = Array.isArray(parsed) ? parsed : parsed.shapes;
			if (!Array.isArray(rawShapes) || rawShapes.length === 0) {
				alert('No valid shapes found in JSON file.');
				return null;
			}

			const now = Date.now();
			let baseZ = this.getNextZIndex();
			const importedShapes: ShapeRecord[] = [];

			for (const item of rawShapes) {
				if (!item.type || typeof item.x !== 'number' || typeof item.y !== 'number') {
					continue;
				}
				const shape: ShapeRecord = {
					id: 'shape_' + Math.random().toString(36).substring(2, 9),
					type: item.type,
					x: item.x,
					y: item.y,
					width: item.width || 50,
					height: item.height || 50,
					fill: item.fill || 'transparent',
					stroke: item.stroke || '#f4f4f5',
					strokeWidth: item.strokeWidth || 2,
					rotation: item.rotation || 0,
					zIndex: baseZ++,
					data: item.data,
					createdBy: '',
					updatedAt: now
				};
				importedShapes.push(shape);
			}

			if (importedShapes.length > 0) {
				this.onShapesMutated?.(importedShapes);
				this.onActionRecorded?.({
					type: 'modify',
					before: [],
					after: importedShapes
				});
				return importedShapes;
			}
			return null;
		} catch {
			alert('Invalid JSON file format.');
			return null;
		}
	}
}
