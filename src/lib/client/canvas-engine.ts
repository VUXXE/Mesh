import type { PeerPresence, ShapeRecord } from '../types';
import type { HistoryAction } from './history.svelte';
import {
	FONT_FAMILIES,
	FONT_SIZES,
	getFontFamilyCss,
	calculateTextBounds,
	type FontFamilyKey
} from './canvas-text';
import {
	drawActiveStroke,
	drawArrowHead,
	drawLinePreview,
	drawMarqueeBox,
	drawPeerCursor,
	drawSelectionOutline,
	drawShape,
	drawShapePreview,
	renderGrid
} from './canvas-render';
import {
	exportToPng,
	exportToSvg,
	exportToJson,
	importFromJson,
	triggerBrowserDownload,
	escapeXml
} from './canvas-export';
import { InteractionController, type InteractionHost } from './canvas-interactions';

export {
	FONT_FAMILIES,
	FONT_SIZES,
	getFontFamilyCss,
	getFontFamilySvg,
	calculateTextBounds,
	wrapText,
	type FontFamilyKey
} from './canvas-text';
export {
	drawActiveStroke,
	drawArrowHead,
	drawLinePreview,
	drawMarqueeBox,
	drawPeerCursor,
	drawSelectionOutline,
	drawShape,
	drawShapePreview,
	renderGrid
} from './canvas-render';
export {
	exportToPng,
	exportToSvg,
	exportToJson,
	importFromJson,
	triggerBrowserDownload,
	escapeXml
} from './canvas-export';
export { InteractionController, type InteractionHost } from './canvas-interactions';

export type ToolMode =
	'select' | 'pen' | 'line' | 'arrow' | 'rectangle' | 'ellipse' | 'text' | 'sticky_note' | 'pan';

export interface ViewportState {
	panX: number;
	panY: number;
	zoom: number;
}

interface SmoothPeerCursor {
	currentX: number;
	currentY: number;
	targetX: number;
	targetY: number;
	alpha: number;
	targetAlpha: number;
}

export class CanvasEngine implements InteractionHost {
	private staticCanvas: HTMLCanvasElement;
	overlayCanvas: HTMLCanvasElement;
	private staticCtx: CanvasRenderingContext2D;
	private overlayCtx: CanvasRenderingContext2D;
	private interactions: InteractionController;

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

	selectedIds: string[] = [];
	editingShapeId: string | null = null;

	private shapes: Map<string, ShapeRecord> = new Map();
	private peers: PeerPresence[] = [];
	private smoothCursors = new Map<string, SmoothPeerCursor>();
	private cursorRafId: number | null = null;
	private lastRafTimestamp = 0;

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
	onStartTextEdit?: (shape: ShapeRecord) => void;
	onEndTextEdit?: () => void;

	private toolChangedListeners: ((tool: ToolMode) => void)[] = [];
	private selectionListeners: ((selectedIds: string[]) => void)[] = [];
	private viewportListeners: ((vp: ViewportState) => void)[] = [];

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

		this.interactions = new InteractionController(this);

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

	getShapes(): Map<string, ShapeRecord> {
		return this.shapes;
	}

	getShape(id: string): ShapeRecord | undefined {
		return this.shapes.get(id);
	}

	setShape(id: string, shape: ShapeRecord) {
		this.shapes.set(id, shape);
	}

	setShapes(shapes: Map<string, ShapeRecord>) {
		this.shapes = shapes;
		this.updateFontSettingsFromSelection();
		this.renderBuffer();
		this.renderOverlay();
	}

	setPeers(peers: PeerPresence[]) {
		this.peers = peers;
		const currentPeerIds = new Set(peers.map((p) => p.userId));

		// Remove smooth cursors for peers who are no longer present
		for (const [id] of this.smoothCursors) {
			if (!currentPeerIds.has(id)) {
				this.smoothCursors.delete(id);
			}
		}

		let needsAnimation = false;

		for (const peer of peers) {
			let state = this.smoothCursors.get(peer.userId);
			if (peer.cursor) {
				if (!state) {
					state = {
						currentX: peer.cursor.x,
						currentY: peer.cursor.y,
						targetX: peer.cursor.x,
						targetY: peer.cursor.y,
						alpha: 1,
						targetAlpha: 1
					};
					this.smoothCursors.set(peer.userId, state);
				} else {
					state.targetX = peer.cursor.x;
					state.targetY = peer.cursor.y;
					state.targetAlpha = 1;

					// If jump is huge (> 1000px), snap immediately without lerp
					const dist = Math.hypot(state.targetX - state.currentX, state.targetY - state.currentY);
					if (dist > 1000) {
						state.currentX = state.targetX;
						state.currentY = state.targetY;
					} else if (dist > 0.2 || state.alpha < 1) {
						needsAnimation = true;
					}
				}
			} else if (state) {
				state.targetAlpha = 0;
				if (state.alpha > 0.05) {
					needsAnimation = true;
				}
			}
		}

		this.renderOverlay();

		if (
			needsAnimation &&
			this.cursorRafId === null &&
			typeof requestAnimationFrame !== 'undefined'
		) {
			this.lastRafTimestamp = performance.now();
			this.cursorRafId = requestAnimationFrame(this.tickCursorInterpolation);
		}
	}

	private tickCursorInterpolation = (timestamp: number) => {
		const dt = Math.min((timestamp - this.lastRafTimestamp) / 1000, 0.1);
		this.lastRafTimestamp = timestamp;

		// Exponential smoothing factor: 1 - Math.exp(-decay * dt)
		// decay = 25 gives a smooth, brisk response (~95% reached in 60-80ms matching network interval)
		const posFactor = 1 - Math.exp(-25 * dt);
		const alphaFactor = 1 - Math.exp(-15 * dt);

		let hasActiveMotion = false;

		for (const [userId, state] of this.smoothCursors) {
			const dx = state.targetX - state.currentX;
			const dy = state.targetY - state.currentY;
			const dist = Math.hypot(dx, dy);

			if (dist > 0.2) {
				state.currentX += dx * posFactor;
				state.currentY += dy * posFactor;
				hasActiveMotion = true;
			} else {
				state.currentX = state.targetX;
				state.currentY = state.targetY;
			}

			const dAlpha = state.targetAlpha - state.alpha;
			if (Math.abs(dAlpha) > 0.02) {
				state.alpha += dAlpha * alphaFactor;
				hasActiveMotion = true;
			} else {
				state.alpha = state.targetAlpha;
			}

			if (state.targetAlpha === 0 && state.alpha <= 0.02) {
				this.smoothCursors.delete(userId);
			}
		}

		this.renderOverlay();

		if (
			hasActiveMotion &&
			this.smoothCursors.size > 0 &&
			typeof requestAnimationFrame !== 'undefined'
		) {
			this.cursorRafId = requestAnimationFrame(this.tickCursorInterpolation);
		} else {
			this.cursorRafId = null;
		}
	};

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

	emitViewportChanged() {
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

	handlePointerLeave() {
		this.interactions.handlePointerLeave();
	}

	handlePointerDown(e: PointerEvent) {
		this.interactions.handlePointerDown(e);
	}

	handlePointerMove(e: PointerEvent) {
		this.interactions.handlePointerMove(e);
	}

	handlePointerUp(e?: PointerEvent) {
		this.interactions.handlePointerUp(e);
	}

	handleWheel(e: WheelEvent) {
		this.interactions.handleWheel(e);
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
		this.interactions.isInteracting = false;
		this.interactions.interactionType = null;
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
		this.interactions.updateHoverCursor({
			x: evt?.clientX ?? -1000,
			y: evt?.clientY ?? -1000
		});
		this.onEndTextEdit?.();
	}

	handleDblClick(e: MouseEvent) {
		this.interactions.handleDblClick(e);
	}

	getNextZIndex(): number {
		let maxZ = 0;
		for (const s of this.shapes.values()) {
			if (s.zIndex > maxZ) maxZ = s.zIndex;
		}
		return maxZ + 1;
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

		const { interactionType, activePathPoints, startPoint, currentPoint } = this.interactions;

		if (interactionType === 'draw' && activePathPoints.length > 1) {
			drawActiveStroke(ctx, activePathPoints, this.strokeColor, this.strokeWidth);
		} else if (interactionType === 'create_line') {
			drawLinePreview(
				ctx,
				startPoint,
				currentPoint,
				this.strokeColor,
				this.strokeWidth,
				this.tool === 'arrow',
				this.isShiftPressed
			);
		} else if (interactionType === 'create_shape') {
			drawShapePreview(
				ctx,
				startPoint,
				currentPoint,
				this.tool,
				this.strokeColor,
				this.fillColor,
				this.strokeWidth
			);
		} else if (interactionType === 'marquee') {
			drawMarqueeBox(ctx, startPoint, currentPoint, this.viewport.zoom);
		}

		drawSelectionOutline(
			ctx,
			this.selectedIds,
			this.shapes,
			this.viewport.zoom,
			this.editingShapeId
		);

		for (const peer of this.peers) {
			const smooth = this.smoothCursors.get(peer.userId);
			if (smooth && smooth.alpha > 0.01) {
				drawPeerCursor(ctx, peer, { x: smooth.currentX, y: smooth.currentY }, smooth.alpha);
			} else if (peer.cursor) {
				drawPeerCursor(ctx, peer, peer.cursor, 1);
			}
		}

		ctx.restore();
	}

	destroy() {
		if (this.cursorRafId !== null && typeof cancelAnimationFrame !== 'undefined') {
			cancelAnimationFrame(this.cursorRafId);
			this.cursorRafId = null;
		}
		this.smoothCursors.clear();
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
