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
	type BoundingBox,
	type ResizeHandle
} from './math';
import type { PathPoint, PeerPresence, ShapeRecord, ShapeType } from '../types';
import type { HistoryAction } from './history.svelte';
import {
	FONT_FAMILIES,
	FONT_SIZES,
	getFontFamilyCss,
	calculateTextBounds,
	wrapText,
	type FontFamilyKey
} from './canvas-text';
import { drawArrowHead, drawPeerCursor, drawShape, renderGrid } from './canvas-render';
import {
	exportToPng,
	exportToSvg,
	exportToJson,
	importFromJson,
	triggerBrowserDownload,
	escapeXml
} from './canvas-export';

export {
	FONT_FAMILIES,
	FONT_SIZES,
	getFontFamilyCss,
	getFontFamilySvg,
	calculateTextBounds,
	wrapText,
	type FontFamilyKey
} from './canvas-text';
export { drawArrowHead, drawPeerCursor, drawShape, renderGrid } from './canvas-render';
export {
	exportToPng,
	exportToSvg,
	exportToJson,
	importFromJson,
	triggerBrowserDownload,
	escapeXml
} from './canvas-export';

export type ToolMode =
	'select' | 'pen' | 'line' | 'arrow' | 'rectangle' | 'ellipse' | 'text' | 'sticky_note' | 'pan';

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

	viewport: ViewportState = {
		panX: 0,
		panY: 0,
		zoom: 1
	};

	tool: ToolMode = 'select';
	strokeColor = '#f4f4f5';
	fillColor = 'transparent';
	strokeWidth = 2;
	fontSize = 18;
	fontFamily = 'sans';

	static readonly DARK_DEFAULT_STROKE = '#f4f4f5';
	static readonly LIGHT_DEFAULT_STROKE = '#18181b';

	isLightTheme(): boolean {
		return (
			typeof document !== 'undefined' &&
			document.documentElement?.classList?.contains('light') === true
		);
	}

	defaultStroke(): string {
		return this.isLightTheme()
			? CanvasEngine.LIGHT_DEFAULT_STROKE
			: CanvasEngine.DARK_DEFAULT_STROKE;
	}

	themeCanvasBg(): string {
		return this.isLightTheme() ? '#fafafa' : '#121214';
	}

	applyTheme() {
		const want = this.defaultStroke();
		const other =
			want === CanvasEngine.DARK_DEFAULT_STROKE
				? CanvasEngine.LIGHT_DEFAULT_STROKE
				: CanvasEngine.DARK_DEFAULT_STROKE;
		if (this.strokeColor === other) {
			this.strokeColor = want;
			this.onStrokeColorChanged?.(want);
		}
		this.renderBuffer();
		this.renderOverlay();
	}

	isSpacePressed = false;
	isShiftPressed = false;

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

	private activePointers = new Map<number, { x: number; y: number }>();
	private initialPinchDist = 0;
	private initialPinchMidpoint = { x: 0, y: 0 };
	private initialPinchZoom = 1;
	private initialPinchPan = { x: 0, y: 0 };

	selectedIds: string[] = [];
	private dragInitialPositions = new Map<string, { x: number; y: number }>();
	private dragInitialShapes = new Map<string, ShapeRecord>();

	private shapes: Map<string, ShapeRecord> = new Map();
	private peers: PeerPresence[] = [];

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

		this.strokeColor = this.defaultStroke();

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
	private viewportListeners: ((vp: ViewportState) => void)[] = [];

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

	addViewportListener(fn: (vp: ViewportState) => void) {
		this.viewportListeners.push(fn);
		return () => {
			this.viewportListeners = this.viewportListeners.filter((l) => l !== fn);
		};
	}

	private emitViewportChanged() {
		this.onViewportChanged?.(this.viewport);
		for (const fn of this.viewportListeners) {
			fn(this.viewport);
		}
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
		return calculateTextBounds(text, fontSize, fontFamily, this.staticCtx);
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

	drawArrowHead(
		ctx: CanvasRenderingContext2D,
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
		color: string,
		width: number
	) {
		drawArrowHead(ctx, fromX, fromY, toX, toY, color, width);
	}

	handlePointerDown(e: PointerEvent) {
		this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

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
							data:
								selectedShape.type === 'path'
									? {
											...selectedShape.data,
											points: (selectedShape.data?.points ?? []).map((p: PathPoint) => ({
												...p
											}))
										}
									: selectedShape.data
										? { ...selectedShape.data }
										: undefined
						};
						this.overlayCanvas.style.cursor = getResizeCursor(hitHandle);
						this.renderOverlay();
						return;
					}
				}
			}

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

				this.emitViewportChanged();
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

			if (shape.type === 'path') {
				const initialPoints: PathPoint[] = this.resizeInitialShape.data?.points ?? [];
				const scaleX =
					this.resizeInitialShape.width > 0 ? resized.width / this.resizeInitialShape.width : 1;
				const scaleY =
					this.resizeInitialShape.height > 0 ? resized.height / this.resizeInitialShape.height : 1;
				shape.data = {
					...shape.data,
					points: initialPoints.map((p) => ({
						...p,
						x: resized.x + (p.x - this.resizeInitialShape!.x) * scaleX,
						y: resized.y + (p.y - this.resizeInitialShape!.y) * scaleY
					}))
				};
			}

			this.renderBuffer();
			this.renderOverlay();
			return;
		}

		if (this.interactionType === 'pan') {
			this.viewport.panX += e.movementX;
			this.viewport.panY += e.movementY;
			this.emitViewportChanged();
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
					const mutated: ShapeRecord =
						shape.type === 'path'
							? {
									...shape,
									data: {
										...shape.data,
										points: (shape.data?.points ?? []).map((p: PathPoint) => ({ ...p }))
									}
								}
							: { ...shape };
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
			const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
			const newZoom = Math.min(Math.max(this.viewport.zoom * zoomFactor, 0.1), 5.0);

			const mouseX = e.clientX;
			const mouseY = e.clientY;

			this.viewport.panX = mouseX - (mouseX - this.viewport.panX) * (newZoom / this.viewport.zoom);
			this.viewport.panY = mouseY - (mouseY - this.viewport.panY) * (newZoom / this.viewport.zoom);
			this.viewport.zoom = newZoom;
		} else {
			this.viewport.panX -= e.deltaX;
			this.viewport.panY -= e.deltaY;
		}

		this.emitViewportChanged();
		this.renderBuffer();
		this.renderOverlay();
	}

	resetZoom() {
		this.viewport.zoom = 1;
		this.viewport.panX = 0;
		this.viewport.panY = 0;
		this.emitViewportChanged();
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

	getNextZIndex(): number {
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

	renderBuffer() {
		const ctx = this.staticCtx;
		const width = window.innerWidth;
		const height = window.innerHeight;

		ctx.save();
		ctx.clearRect(0, 0, width, height);

		ctx.translate(this.viewport.panX, this.viewport.panY);
		ctx.scale(this.viewport.zoom, this.viewport.zoom);

		renderGrid(
			ctx,
			this.viewport.panX,
			this.viewport.panY,
			this.viewport.zoom,
			this.isLightTheme(),
			width,
			height
		);

		const sorted = Array.from(this.shapes.values()).sort((a, b) => a.zIndex - b.zIndex);
		for (const shape of sorted) {
			drawShape(ctx, shape, this.defaultStroke(), {
				editingShapeId: this.editingShapeId,
				isStaticCtx: true
			});
		}

		ctx.restore();
	}

	renderOverlay() {
		const ctx = this.overlayCtx;
		const width = window.innerWidth;
		const height = window.innerHeight;

		ctx.save();
		ctx.clearRect(0, 0, width, height);

		ctx.translate(this.viewport.panX, this.viewport.panY);
		ctx.scale(this.viewport.zoom, this.viewport.zoom);

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
				drawArrowHead(
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
					ctx.strokeStyle = '#6366f1';
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

			if (canResizeSingle && singleShape) {
				const b = getShapeBounds(singleShape);
				const handles = getResizeHandles(b);

				const handleSize = 8 / this.viewport.zoom;
				const halfSize = handleSize / 2;

				ctx.save();
				ctx.fillStyle = '#ffffff';
				ctx.strokeStyle = '#6366f1';
				ctx.lineWidth = 1.5 / this.viewport.zoom;
				ctx.setLineDash([]);

				for (const pos of Object.values(handles)) {
					ctx.beginPath();
					ctx.fillRect(pos.x - halfSize, pos.y - halfSize, handleSize, handleSize);
					ctx.strokeRect(pos.x - halfSize, pos.y - halfSize, handleSize, handleSize);
				}
				ctx.restore();
			}
		}

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

		for (const peer of this.peers) {
			if (peer.cursor) {
				drawPeerCursor(ctx, peer);
			}
		}

		ctx.restore();
	}

	triggerBrowserDownload(source: string | Blob, filename: string) {
		triggerBrowserDownload(source, filename);
	}

	exportToPng(filename = 'mesh-whiteboard.png', scale = 2) {
		exportToPng(
			this.shapes,
			this.themeCanvasBg(),
			this.defaultStroke(),
			filename,
			scale,
			(source, name) => this.triggerBrowserDownload(source, name)
		);
	}

	exportToSvg(filename = 'mesh-whiteboard.svg') {
		exportToSvg(this.shapes, this.themeCanvasBg(), filename, (source, name) =>
			this.triggerBrowserDownload(source, name)
		);
	}

	exportToJson(filename = 'mesh-whiteboard.json') {
		exportToJson(this.shapes, filename, (source, name) =>
			this.triggerBrowserDownload(source, name)
		);
	}

	importFromJson(jsonString: string): ShapeRecord[] | null {
		const importedShapes = importFromJson(jsonString, this.getNextZIndex(), this.defaultStroke());
		if (importedShapes && importedShapes.length > 0) {
			this.onShapesMutated?.(importedShapes);
			this.onActionRecorded?.({
				type: 'modify',
				before: [],
				after: importedShapes
			});
			return importedShapes;
		}
		return null;
	}
}
