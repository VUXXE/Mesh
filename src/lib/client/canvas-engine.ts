import type {
	CornerRoundness,
	FillStyle,
	PathPoint,
	PeerPresence,
	ShapeRecord,
	StrokeStyle
} from '../types';
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
	drawAlignmentGuides,
	drawAnchorIndicator,
	drawArrowHead,
	drawLinePreview,
	drawMarqueeBox,
	drawPeerCursor,
	drawQuickAddButtons,
	drawSelectionOutline,
	drawShape,
	drawShapePreview,
	renderGrid
} from './canvas-render';
import {
	calculateOrthogonalPath,
	getQuickAddButtons,
	getShapeAnchors,
	type AnchorSide
} from './math';
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
	drawAnchorIndicator,
	drawArrowHead,
	drawLinePreview,
	drawMarqueeBox,
	drawPeerCursor,
	drawSelectionOutline,
	drawShape,
	drawShapeCenteredText,
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
	| 'select'
	| 'pen'
	| 'line'
	| 'arrow'
	| 'rectangle'
	| 'diamond'
	| 'ellipse'
	| 'text'
	| 'sticky_note'
	| 'pan';

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

export interface MeshClipboardPayload {
	type: 'mesh/shapes';
	version: number;
	shapes: ShapeRecord[];
}

export function generateShapeId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return 'shape_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
	}
	return 'shape_' + Math.random().toString(36).substring(2, 10);
}

export function cloneAndOffsetShape(
	shape: ShapeRecord,
	dx: number,
	dy: number,
	newId: string,
	zIndex: number,
	updatedAt: number
): ShapeRecord {
	const cloned: ShapeRecord = {
		...shape,
		id: newId,
		x: shape.x + dx,
		y: shape.y + dy,
		zIndex,
		updatedAt
	};

	if (shape.data) {
		cloned.data = { ...shape.data };
		if (shape.type === 'path' && Array.isArray(shape.data.points)) {
			cloned.data.points = shape.data.points.map((p: PathPoint) => ({
				...p,
				x: p.x + dx,
				y: p.y + dy
			}));
		}
	}

	return cloned;
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
	strokeStyle: StrokeStyle = 'solid';
	fillStyle: FillStyle = 'solid';
	roundness: CornerRoundness = 'round';
	opacity = 1;
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
	private clipboard: ShapeRecord[] = [];
	private pasteCount = 0;

	onShapesMutated?: (shapes: ShapeRecord[]) => void;
	onShapesDeleted?: (ids: string[]) => void;
	onSelectionChanged?: (selectedIds: string[]) => void;
	onCursorMoved?: (pos: { x: number; y: number } | null) => void;
	onViewportChanged?: (vp: ViewportState) => void;
	onActionRecorded?: (action: HistoryAction) => void;
	onToolChanged?: (tool: ToolMode) => void;
	onStrokeColorChanged?: (color: string) => void;
	onFillColorChanged?: (color: string) => void;
	onStrokeWidthChanged?: (width: number) => void;
	onStrokeStyleChanged?: (style: StrokeStyle) => void;
	onFillStyleChanged?: (style: FillStyle) => void;
	onRoundnessChanged?: (roundness: CornerRoundness) => void;
	onOpacityChanged?: (opacity: number) => void;
	onFontFamilyChanged?: (family: string) => void;
	onFontSizeChanged?: (size: number) => void;
	onArrowRoutingChanged?: (routing: 'straight' | 'orthogonal') => void;
	onTextShapeStyleChanged?: (shape: ShapeRecord) => void;
	onStartTextEdit?: (shape: ShapeRecord) => void;
	onEndTextEdit?: () => void;

	arrowRouting: 'straight' | 'orthogonal' = 'orthogonal';

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
		this.onFillColorChanged?.(color);
	}

	setStrokeStyle(style: StrokeStyle) {
		this.strokeStyle = style;
		this.applyDataPropertyToSelection({ strokeStyle: style });
		this.onStrokeStyleChanged?.(style);
	}

	setFillStyle(style: FillStyle) {
		this.fillStyle = style;
		this.applyDataPropertyToSelection({ fillStyle: style });
		this.onFillStyleChanged?.(style);
	}

	setRoundness(roundness: CornerRoundness) {
		this.roundness = roundness;
		this.applyDataPropertyToSelection({ roundness });
		this.onRoundnessChanged?.(roundness);
	}

	setOpacity(opacity: number) {
		this.opacity = opacity;
		this.applyDataPropertyToSelection({ opacity });
		this.onOpacityChanged?.(opacity);
	}

	setStrokeWidth(width: number) {
		this.strokeWidth = width;
		this.applyPropertyToSelection({ strokeWidth: width });
		this.onStrokeWidthChanged?.(width);
	}

	setArrowRouting(routing: 'straight' | 'orthogonal') {
		this.arrowRouting = routing;
		this.onArrowRoutingChanged?.(routing);

		if (this.selectedIds.length > 0) {
			const modified: ShapeRecord[] = [];
			const before: ShapeRecord[] = [];
			const now = Date.now();

			for (const id of this.selectedIds) {
				const shape = this.shapes.get(id);
				if (shape && shape.type === 'path' && shape.data?.isArrow) {
					before.push({ ...shape, data: { ...shape.data } });
					let points = shape.data.points ? [...shape.data.points] : [];
					const startAnchor = shape.data.startAnchor;
					const endAnchor = shape.data.endAnchor;

					if (startAnchor && endAnchor) {
						const startShape = this.shapes.get(startAnchor.shapeId);
						const endShape = this.shapes.get(endAnchor.shapeId);
						if (startShape && endShape) {
							const startAnchors = getShapeAnchors(startShape);
							const endAnchors = getShapeAnchors(endShape);
							const sA = startAnchors.find((a) => a.side === startAnchor.side);
							const eA = endAnchors.find((a) => a.side === endAnchor.side);
							if (sA && eA) {
								if (routing === 'orthogonal') {
									points = calculateOrthogonalPath(sA, eA, sA.side, eA.side);
								} else {
									points = [
										{ x: sA.x, y: sA.y },
										{ x: eA.x, y: eA.y }
									];
								}
							}
						}
					} else if (points.length >= 2) {
						if (routing === 'orthogonal') {
							points = calculateOrthogonalPath(points[0], points[points.length - 1]);
						} else {
							points = [points[0], points[points.length - 1]];
						}
					}

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

					const updated: ShapeRecord = {
						...shape,
						x: minX !== Infinity ? minX : shape.x,
						y: minY !== Infinity ? minY : shape.y,
						width: maxX !== -Infinity ? Math.max(maxX - minX, 10) : shape.width,
						height: maxY !== -Infinity ? Math.max(maxY - minY, 10) : shape.height,
						data: {
							...shape.data,
							routing,
							points
						},
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

	private applyDataPropertyToSelection(dataProps: Record<string, unknown>) {
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
					data: {
						...shape.data,
						...dataProps
					},
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
				this.shapes.delete(id);
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
		this.renderBuffer();
		this.renderOverlay();
	}

	hasClipboard(): boolean {
		return this.clipboard.length > 0;
	}

	getClipboard(): ShapeRecord[] {
		return this.clipboard;
	}

	copySelected(): boolean {
		if (this.selectedIds.length === 0) return false;
		const selected = this.selectedIds
			.map((id) => this.shapes.get(id))
			.filter((s): s is ShapeRecord => Boolean(s));

		if (selected.length === 0) return false;

		this.clipboard = selected.map((s) => ({
			...s,
			data: s.data
				? {
						...s.data,
						points:
							s.type === 'path' && Array.isArray(s.data.points)
								? s.data.points.map((p: PathPoint) => ({ ...p }))
								: s.data.points
					}
				: undefined
		}));
		this.pasteCount = 0;

		if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
			const payload: MeshClipboardPayload = {
				type: 'mesh/shapes',
				version: 1,
				shapes: this.clipboard
			};
			navigator.clipboard.writeText(JSON.stringify(payload)).catch(() => {
				// Ignore clipboard permissions or headless failure
			});
		}

		return true;
	}

	cutSelected(): boolean {
		if (this.selectedIds.length === 0) return false;
		const ok = this.copySelected();
		if (ok) {
			this.deleteSelected();
		}
		return ok;
	}

	pasteShapes(shapesToPaste: ShapeRecord[], offsetMultiplier?: number): ShapeRecord[] {
		if (!shapesToPaste || shapesToPaste.length === 0) return [];

		const multiplier = offsetMultiplier ?? ++this.pasteCount;
		const offset = multiplier * 20;
		const now = Date.now();
		const baseZ = this.getNextZIndex();

		const newShapes: ShapeRecord[] = shapesToPaste.map((shape, idx) => {
			const newId = generateShapeId();
			return cloneAndOffsetShape(shape, offset, offset, newId, baseZ + idx, now + idx);
		});

		for (const s of newShapes) {
			this.shapes.set(s.id, s);
		}

		this.onActionRecorded?.({
			type: 'batch_create',
			shapes: newShapes
		});
		this.onShapesMutated?.(newShapes);
		this.setSelectedIds(newShapes.map((s) => s.id));
		this.renderBuffer();
		this.renderOverlay();

		return newShapes;
	}

	insertBatchShapes(shapes: ShapeRecord[]) {
		if (!shapes || shapes.length === 0) return;
		for (const s of shapes) {
			this.shapes.set(s.id, s);
		}
		this.onShapesMutated?.(shapes);
		this.onActionRecorded?.({
			type: 'batch_create',
			shapes
		});
		this.setSelectedIds(shapes.map((s) => s.id));
		this.renderBuffer();
		this.renderOverlay();
	}

	quickAddConnectedNode(sourceShapeId: string, side: AnchorSide): ShapeRecord | null {
		const sourceShape = this.shapes.get(sourceShapeId);
		if (!sourceShape) return null;

		const spacing = 120;
		const width = sourceShape.width || 120;
		const height = sourceShape.height || 60;
		let newX = sourceShape.x;
		let newY = sourceShape.y;
		let oppositeSide: AnchorSide = 'left';

		if (side === 'right') {
			newX = sourceShape.x + sourceShape.width + spacing;
			newY = sourceShape.y + (sourceShape.height - height) / 2;
			oppositeSide = 'left';
		} else if (side === 'left') {
			newX = sourceShape.x - width - spacing;
			newY = sourceShape.y + (sourceShape.height - height) / 2;
			oppositeSide = 'right';
		} else if (side === 'bottom') {
			newX = sourceShape.x + (sourceShape.width - width) / 2;
			newY = sourceShape.y + sourceShape.height + spacing;
			oppositeSide = 'top';
		} else if (side === 'top') {
			newX = sourceShape.x + (sourceShape.width - width) / 2;
			newY = sourceShape.y - height - spacing;
			oppositeSide = 'bottom';
		}

		const newId = generateShapeId();
		const now = Date.now();
		const nextZ = this.getNextZIndex();

		const isDiamond = sourceShape.type === 'path' && sourceShape.data?.isDiamond;
		let newShapeData: Record<string, unknown> = {
			...(sourceShape.data?.strokeStyle ? { strokeStyle: sourceShape.data.strokeStyle } : {}),
			...(sourceShape.data?.fillStyle ? { fillStyle: sourceShape.data.fillStyle } : {}),
			...(sourceShape.data?.roundness ? { roundness: sourceShape.data.roundness } : {}),
			...(sourceShape.data?.opacity !== undefined ? { opacity: sourceShape.data.opacity } : {})
		};
		if (isDiamond) {
			const points: PathPoint[] = [
				{ x: newX + width / 2, y: newY },
				{ x: newX + width, y: newY + height / 2 },
				{ x: newX + width / 2, y: newY + height },
				{ x: newX, y: newY + height / 2 },
				{ x: newX + width / 2, y: newY }
			];
			newShapeData = { ...newShapeData, isDiamond: true, points, text: '' };
		} else if (sourceShape.type === 'sticky_note') {
			newShapeData = { ...newShapeData, text: '' };
		}

		const newShape: ShapeRecord = {
			id: newId,
			type: sourceShape.type,
			x: Math.round(newX),
			y: Math.round(newY),
			width,
			height,
			fill: sourceShape.fill,
			stroke: sourceShape.stroke || this.strokeColor,
			strokeWidth: sourceShape.strokeWidth || this.strokeWidth,
			rotation: 0,
			zIndex: nextZ,
			data: newShapeData,
			createdBy: '',
			updatedAt: now
		};

		// Create connecting arrow
		const sourceAnchors = getShapeAnchors(sourceShape);
		const targetAnchors = getShapeAnchors(newShape);
		const startAnchor = sourceAnchors.find((a) => a.side === side) || {
			x: sourceShape.x + sourceShape.width,
			y: sourceShape.y + sourceShape.height / 2,
			side
		};
		const endAnchor = targetAnchors.find((a) => a.side === oppositeSide) || {
			x: newShape.x,
			y: newShape.y + newShape.height / 2,
			side: oppositeSide
		};

		let arrowPoints: PathPoint[];
		if (this.arrowRouting === 'orthogonal') {
			arrowPoints = calculateOrthogonalPath(startAnchor, endAnchor, side, oppositeSide);
		} else {
			arrowPoints = [
				{ x: startAnchor.x, y: startAnchor.y },
				{ x: endAnchor.x, y: endAnchor.y }
			];
		}

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const p of arrowPoints) {
			if (p.x < minX) minX = p.x;
			if (p.y < minY) minY = p.y;
			if (p.x > maxX) maxX = p.x;
			if (p.y > maxY) maxY = p.y;
		}

		const arrowId = generateShapeId();
		const arrowShape: ShapeRecord = {
			id: arrowId,
			type: 'path',
			x: minX !== Infinity ? minX : newX,
			y: minY !== Infinity ? minY : newY,
			width: maxX !== -Infinity ? Math.max(maxX - minX, 10) : 10,
			height: maxY !== -Infinity ? Math.max(maxY - minY, 10) : 10,
			fill: 'transparent',
			stroke: this.strokeColor,
			strokeWidth: 2,
			rotation: 0,
			zIndex: nextZ + 1,
			data: {
				points: arrowPoints,
				isArrow: true,
				routing: this.arrowRouting,
				startAnchor: { shapeId: sourceShape.id, side },
				endAnchor: { shapeId: newShape.id, side: oppositeSide }
			},
			createdBy: '',
			updatedAt: now + 1
		};

		this.shapes.set(newShape.id, newShape);
		this.shapes.set(arrowShape.id, arrowShape);

		const created = [newShape, arrowShape];
		this.onShapesMutated?.(created);
		this.onActionRecorded?.({
			type: 'batch_create',
			shapes: created
		});

		this.setSelectedIds([newShape.id]);
		this.renderBuffer();
		this.renderOverlay();

		this.startTextEdit(newShape);

		return newShape;
	}

	pastePlainText(text: string): ShapeRecord | null {
		const trimmed = text.trim();
		if (!trimmed) return null;

		const viewportW =
			typeof window !== 'undefined' ? window.innerWidth : this.overlayCanvas?.width || 1920;
		const viewportH =
			typeof window !== 'undefined' ? window.innerHeight : this.overlayCanvas?.height || 1080;

		const centerX = (viewportW / 2 - this.viewport.panX) / this.viewport.zoom;
		const centerY = (viewportH / 2 - this.viewport.panY) / this.viewport.zoom;

		const fontSize = this.fontSize || 18;
		const fontFamily = this.fontFamily || 'sans';
		const bounds = this.calculateTextBounds(trimmed, fontSize, fontFamily);

		const shape: ShapeRecord = {
			id: generateShapeId(),
			type: 'text',
			x: Math.round(centerX - bounds.width / 2),
			y: Math.round(centerY - bounds.height / 2),
			width: bounds.width,
			height: bounds.height,
			fill: 'transparent',
			stroke: this.strokeColor,
			strokeWidth: 1,
			rotation: 0,
			zIndex: this.getNextZIndex(),
			data: { text: trimmed, fontSize, fontFamily },
			createdBy: '',
			updatedAt: Date.now()
		};

		this.shapes.set(shape.id, shape);
		this.setSelectedIds([shape.id]);
		this.renderBuffer();
		this.renderOverlay();
		this.onShapesMutated?.([shape]);
		this.onActionRecorded?.({ type: 'create', shape });
		return shape;
	}

	async paste(): Promise<ShapeRecord[]> {
		if (this.clipboard.length > 0) {
			return this.pasteShapes(this.clipboard);
		}

		if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
			try {
				const text = await navigator.clipboard.readText();
				if (text) {
					const parsed = JSON.parse(text);
					if (
						parsed &&
						parsed.type === 'mesh/shapes' &&
						Array.isArray(parsed.shapes) &&
						parsed.shapes.length > 0
					) {
						return this.pasteShapes(parsed.shapes);
					}
					if (typeof text === 'string' && text.trim()) {
						const created = this.pastePlainText(text);
						return created ? [created] : [];
					}
				}
			} catch {
				// Fall through on read failure / rejection
			}
		}

		return [];
	}

	duplicateSelected(): ShapeRecord[] {
		if (this.selectedIds.length === 0) return [];
		const selected = this.selectedIds
			.map((id) => this.shapes.get(id))
			.filter((s): s is ShapeRecord => Boolean(s));

		if (selected.length === 0) return [];

		const now = Date.now();
		const baseZ = this.getNextZIndex();
		const dx = 20;
		const dy = 20;

		const duplicated: ShapeRecord[] = selected.map((shape, idx) => {
			const newId = generateShapeId();
			return cloneAndOffsetShape(shape, dx, dy, newId, baseZ + idx, now + idx);
		});

		for (const s of duplicated) {
			this.shapes.set(s.id, s);
		}

		this.onActionRecorded?.({
			type: 'batch_create',
			shapes: duplicated
		});
		this.onShapesMutated?.(duplicated);
		this.setSelectedIds(duplicated.map((s) => s.id));
		this.renderBuffer();
		this.renderOverlay();

		return duplicated;
	}

	selectAll() {
		if (this.shapes.size === 0) return;
		this.setSelectedIds(Array.from(this.shapes.keys()));
		this.renderOverlay();
	}

	bringToFront(): boolean {
		if (this.selectedIds.length === 0) return false;
		const sortedAll = Array.from(this.shapes.values()).sort((a, b) => a.zIndex - b.zIndex);
		const selectedSet = new Set(this.selectedIds);
		const nonSelected = sortedAll.filter((s) => !selectedSet.has(s.id));
		if (nonSelected.length === 0) return false;

		const highestNonSelectedZ = nonSelected[nonSelected.length - 1].zIndex;
		const selectedShapes = sortedAll.filter((s) => selectedSet.has(s.id));

		if (selectedShapes[0].zIndex > highestNonSelectedZ) {
			return false;
		}

		const now = Date.now();
		const before: ShapeRecord[] = [];
		const after: ShapeRecord[] = [];

		selectedShapes.forEach((s, idx) => {
			before.push({ ...s });
			const updated: ShapeRecord = {
				...s,
				zIndex: highestNonSelectedZ + 1 + idx,
				updatedAt: now + idx
			};
			this.shapes.set(updated.id, updated);
			after.push(updated);
		});

		this.onShapesMutated?.(after);
		this.onActionRecorded?.({
			type: 'modify',
			before,
			after
		});
		this.renderBuffer();
		this.renderOverlay();
		return true;
	}

	sendToBack(): boolean {
		if (this.selectedIds.length === 0) return false;
		const sortedAll = Array.from(this.shapes.values()).sort((a, b) => a.zIndex - b.zIndex);
		const selectedSet = new Set(this.selectedIds);
		const nonSelected = sortedAll.filter((s) => !selectedSet.has(s.id));
		if (nonSelected.length === 0) return false;

		const lowestNonSelectedZ = nonSelected[0].zIndex;
		const selectedShapes = sortedAll.filter((s) => selectedSet.has(s.id));

		if (selectedShapes[selectedShapes.length - 1].zIndex < lowestNonSelectedZ) {
			return false;
		}

		const now = Date.now();
		const before: ShapeRecord[] = [];
		const after: ShapeRecord[] = [];
		const count = selectedShapes.length;

		selectedShapes.forEach((s, idx) => {
			before.push({ ...s });
			const updated: ShapeRecord = {
				...s,
				zIndex: lowestNonSelectedZ - count + idx,
				updatedAt: now + idx
			};
			this.shapes.set(updated.id, updated);
			after.push(updated);
		});

		this.onShapesMutated?.(after);
		this.onActionRecorded?.({
			type: 'modify',
			before,
			after
		});
		this.renderBuffer();
		this.renderOverlay();
		return true;
	}

	bringForward(): boolean {
		if (this.selectedIds.length === 0) return false;
		const sorted = Array.from(this.shapes.values()).sort((a, b) => a.zIndex - b.zIndex);
		const selectedSet = new Set(this.selectedIds);

		const originalIndices = new Map<string, number>();
		const originalZMap = new Map<string, number>();
		sorted.forEach((s, idx) => {
			originalIndices.set(s.id, idx);
			originalZMap.set(s.id, s.zIndex);
		});

		let swappedAny = false;
		for (let i = sorted.length - 2; i >= 0; i--) {
			if (selectedSet.has(sorted[i].id) && !selectedSet.has(sorted[i + 1].id)) {
				const temp = sorted[i];
				sorted[i] = sorted[i + 1];
				sorted[i + 1] = temp;
				swappedAny = true;
			}
		}

		if (!swappedAny) return false;

		return this.applyReorderedZIndices(sorted, originalIndices, originalZMap);
	}

	sendBackward(): boolean {
		if (this.selectedIds.length === 0) return false;
		const sorted = Array.from(this.shapes.values()).sort((a, b) => a.zIndex - b.zIndex);
		const selectedSet = new Set(this.selectedIds);

		const originalIndices = new Map<string, number>();
		const originalZMap = new Map<string, number>();
		sorted.forEach((s, idx) => {
			originalIndices.set(s.id, idx);
			originalZMap.set(s.id, s.zIndex);
		});

		let swappedAny = false;
		for (let i = 1; i < sorted.length; i++) {
			if (selectedSet.has(sorted[i].id) && !selectedSet.has(sorted[i - 1].id)) {
				const temp = sorted[i];
				sorted[i] = sorted[i - 1];
				sorted[i - 1] = temp;
				swappedAny = true;
			}
		}

		if (!swappedAny) return false;

		return this.applyReorderedZIndices(sorted, originalIndices, originalZMap);
	}

	private applyReorderedZIndices(
		sorted: ShapeRecord[],
		originalIndices: Map<string, number>,
		originalZMap: Map<string, number>
	): boolean {
		const now = Date.now();
		const before: ShapeRecord[] = [];
		const after: ShapeRecord[] = [];

		let i = 0;
		while (i < sorted.length) {
			if (originalIndices.get(sorted[i].id) !== i) {
				const start = i;
				while (i < sorted.length && originalIndices.get(sorted[i].id) !== i) {
					i++;
				}
				const end = i - 1;

				const blockShapes = sorted.slice(start, end + 1);
				const zPool = blockShapes.map((s) => originalZMap.get(s.id)!).sort((a, b) => a - b);

				for (let k = 1; k < zPool.length; k++) {
					if (zPool[k] <= zPool[k - 1]) {
						zPool[k] = zPool[k - 1] + 1;
					}
				}

				blockShapes.forEach((s, idx) => {
					const oldZ = originalZMap.get(s.id)!;
					const newZ = zPool[idx];
					if (oldZ !== newZ) {
						before.push({ ...s, zIndex: oldZ });
						const updated: ShapeRecord = {
							...s,
							zIndex: newZ,
							updatedAt: now + before.length
						};
						this.shapes.set(updated.id, updated);
						after.push(updated);
					}
				});
			} else {
				i++;
			}
		}

		if (after.length > 0) {
			this.onShapesMutated?.(after);
			this.onActionRecorded?.({
				type: 'modify',
				before,
				after
			});
			this.renderBuffer();
			this.renderOverlay();
			return true;
		}

		return false;
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
			drawActiveStroke(ctx, activePathPoints, this.strokeColor, this.strokeWidth, {
				strokeStyle: this.strokeStyle,
				opacity: this.opacity
			});
		} else if (interactionType === 'create_line') {
			const startAnchor = this.interactions.getActiveStartAnchor();
			const hoverAnchor = this.interactions.getActiveHoverAnchor();
			drawLinePreview(
				ctx,
				startPoint,
				currentPoint,
				this.strokeColor,
				this.strokeWidth,
				this.tool === 'arrow',
				this.isShiftPressed,
				this.arrowRouting,
				startAnchor?.side,
				hoverAnchor?.side,
				{
					strokeStyle: this.strokeStyle,
					opacity: this.opacity
				}
			);
		} else if (interactionType === 'create_shape') {
			drawShapePreview(
				ctx,
				startPoint,
				currentPoint,
				this.tool,
				this.strokeColor,
				this.fillColor,
				this.strokeWidth,
				{
					strokeStyle: this.strokeStyle,
					fillStyle: this.fillStyle,
					roundness: this.roundness,
					opacity: this.opacity
				}
			);
		} else if (interactionType === 'marquee') {
			drawMarqueeBox(ctx, startPoint, currentPoint, this.viewport.zoom);
		}

		const guides = this.interactions.getActiveGuides();
		if (guides && guides.length > 0) {
			drawAlignmentGuides(ctx, guides, this.viewport.zoom);
		}

		const hoverAnchor = this.interactions.getActiveHoverAnchor();
		if (hoverAnchor) {
			drawAnchorIndicator(ctx, hoverAnchor, this.viewport.zoom);
		}

		drawSelectionOutline(
			ctx,
			this.selectedIds,
			this.shapes,
			this.viewport.zoom,
			this.editingShapeId
		);

		if (
			this.tool === 'select' &&
			this.selectedIds.length === 1 &&
			!this.editingShapeId &&
			!this.interactions.isInteracting
		) {
			const selectedShape = this.shapes.get(this.selectedIds[0]);
			if (
				selectedShape &&
				(selectedShape.type === 'rectangle' ||
					selectedShape.type === 'ellipse' ||
					selectedShape.type === 'sticky_note' ||
					(selectedShape.type === 'path' && selectedShape.data?.isDiamond))
			) {
				const buttons = getQuickAddButtons(selectedShape);
				const hoveredSide = this.interactions.getHoveredQuickAddSide();
				drawQuickAddButtons(ctx, buttons, this.viewport.zoom, hoveredSide);
			}
		}

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
