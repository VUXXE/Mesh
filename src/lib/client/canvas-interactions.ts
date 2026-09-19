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
import type { PathPoint, ShapeRecord, ShapeType } from '../types';
import type { HistoryAction } from './history.svelte';

export type InteractionType =
	| 'draw'
	| 'create_shape'
	| 'create_line'
	| 'create_text'
	| 'drag_selection'
	| 'resize_shape'
	| 'marquee'
	| 'pan'
	| 'pinch_zoom'
	| null;

export interface InteractionHost {
	viewport: { panX: number; panY: number; zoom: number };
	tool: string;
	strokeColor: string;
	fillColor: string;
	strokeWidth: number;
	fontSize: number;
	fontFamily: string;
	isSpacePressed: boolean;
	isShiftPressed: boolean;
	selectedIds: string[];
	editingShapeId: string | null;
	overlayCanvas: HTMLCanvasElement;
	getShapes(): Map<string, ShapeRecord>;
	getShape(id: string): ShapeRecord | undefined;
	setShape(id: string, shape: ShapeRecord): void;
	setSelectedIds(ids: string[]): void;
	getNextZIndex(): number;
	startTextEdit(shape: ShapeRecord): void;
	calculateTextBounds(
		text: string,
		fontSize: number,
		fontFamily?: string
	): { width: number; height: number };
	emitViewportChanged(): void;
	renderBuffer(): void;
	renderOverlay(): void;
	onShapesMutated?: (shapes: ShapeRecord[]) => void;
	onActionRecorded?: (action: HistoryAction) => void;
	onCursorMoved?: (pos: { x: number; y: number } | null) => void;
}

export class InteractionController {
	isInteracting = false;
	interactionType: InteractionType = null;
	startPoint = { x: 0, y: 0 };
	currentPoint = { x: 0, y: 0 };
	activePathPoints: PathPoint[] = [];

	private activePointers = new Map<number, { x: number; y: number }>();
	private initialPinchDist = 0;
	private initialPinchMidpoint = { x: 0, y: 0 };
	private initialPinchZoom = 1;
	private initialPinchPan = { x: 0, y: 0 };

	private activeResizeHandle: ResizeHandle | null = null;
	private resizeInitialPointer = { x: 0, y: 0 };
	private resizeInitialShape: ShapeRecord | null = null;
	private dragInitialPositions = new Map<string, { x: number; y: number }>();
	private dragInitialShapes = new Map<string, ShapeRecord>();
	private marqueeInitialSelected: string[] = [];

	constructor(private host: InteractionHost) {}

	handlePointerLeave() {
		if (!this.isInteracting) {
			this.host.overlayCanvas.style.cursor = '';
			this.host.onCursorMoved?.(null);
		}
	}

	updateHoverCursor(screenPos: { x: number; y: number }) {
		if (
			this.host.tool !== 'select' ||
			this.host.selectedIds.length !== 1 ||
			this.host.editingShapeId !== null
		) {
			this.host.overlayCanvas.style.cursor = '';
			return;
		}

		const selectedShape = this.host.getShape(this.host.selectedIds[0]);
		if (!selectedShape || !isResizableShape(selectedShape.type)) {
			this.host.overlayCanvas.style.cursor = '';
			return;
		}

		const bounds = getShapeBounds(selectedShape);
		const hitHandle = hitTestResizeHandles(
			screenPos,
			bounds,
			this.host.viewport.panX,
			this.host.viewport.panY,
			this.host.viewport.zoom
		);

		if (hitHandle) {
			this.host.overlayCanvas.style.cursor = getResizeCursor(hitHandle);
		} else {
			this.host.overlayCanvas.style.cursor = '';
		}
	}

	handlePointerDown(e: PointerEvent) {
		this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

		if (this.activePointers.size === 2) {
			const [p1, p2] = Array.from(this.activePointers.values());
			this.initialPinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
			this.initialPinchMidpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
			this.initialPinchZoom = this.host.viewport.zoom;
			this.initialPinchPan = { x: this.host.viewport.panX, y: this.host.viewport.panY };
			this.interactionType = 'pinch_zoom';
			this.isInteracting = true;
			this.activePathPoints = [];
			this.host.renderOverlay();
			return;
		}

		if (this.activePointers.size > 2) {
			return;
		}

		const screenPos = { x: e.clientX, y: e.clientY };
		const worldPos = screenToWorld(
			screenPos.x,
			screenPos.y,
			this.host.viewport.panX,
			this.host.viewport.panY,
			this.host.viewport.zoom
		);

		this.isInteracting = true;
		this.startPoint = worldPos;
		this.currentPoint = worldPos;

		if (this.host.tool === 'pan' || e.button === 1 || e.buttons === 4 || this.host.isSpacePressed) {
			this.interactionType = 'pan';
			return;
		}

		if (this.host.tool === 'pen') {
			this.interactionType = 'draw';
			this.activePathPoints = [{ x: worldPos.x, y: worldPos.y, pressure: e.pressure || 0.5 }];
			this.host.renderOverlay();
			return;
		}

		if (this.host.tool === 'line' || this.host.tool === 'arrow') {
			this.interactionType = 'create_line';
			this.host.renderOverlay();
			return;
		}

		if (
			this.host.tool === 'rectangle' ||
			this.host.tool === 'ellipse' ||
			this.host.tool === 'sticky_note'
		) {
			this.interactionType = 'create_shape';
			this.host.renderOverlay();
			return;
		}

		if (this.host.tool === 'text') {
			this.interactionType = 'create_text';
			this.host.renderOverlay();
			return;
		}

		if (this.host.tool === 'select') {
			if (this.host.selectedIds.length === 1) {
				const selectedShape = this.host.getShape(this.host.selectedIds[0]);
				if (
					selectedShape &&
					isResizableShape(selectedShape.type) &&
					this.host.editingShapeId !== selectedShape.id
				) {
					const bounds = getShapeBounds(selectedShape);
					const hitHandle = hitTestResizeHandles(
						screenPos,
						bounds,
						this.host.viewport.panX,
						this.host.viewport.panY,
						this.host.viewport.zoom
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
						this.host.overlayCanvas.style.cursor = getResizeCursor(hitHandle);
						this.host.renderOverlay();
						return;
					}
				}
			}

			const shapes = this.host.getShapes();
			const sortedShapes = Array.from(shapes.values()).sort((a, b) => b.zIndex - a.zIndex);
			const hit = sortedShapes.find((s) => hitTestShape(worldPos, s));

			if (hit) {
				let nextSelected = [...this.host.selectedIds];
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
				this.host.setSelectedIds(nextSelected);

				this.interactionType = 'drag_selection';
				this.dragInitialPositions.clear();
				this.dragInitialShapes.clear();
				for (const id of this.host.selectedIds) {
					const shape = this.host.getShape(id);
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
					this.host.setSelectedIds([]);
					this.marqueeInitialSelected = [];
				} else {
					this.marqueeInitialSelected = [...this.host.selectedIds];
				}
				this.interactionType = 'marquee';
			}

			this.host.renderOverlay();
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

				this.host.viewport.zoom = newZoom;
				this.host.viewport.panX =
					mX - (mX - this.initialPinchPan.x) * (newZoom / this.initialPinchZoom) + panDeltaX;
				this.host.viewport.panY =
					mY - (mY - this.initialPinchPan.y) * (newZoom / this.initialPinchZoom) + panDeltaY;

				this.host.emitViewportChanged();
				this.host.renderBuffer();
				this.host.renderOverlay();
			}
			return;
		}

		const screenPos = { x: e.clientX, y: e.clientY };
		const worldPos = screenToWorld(
			screenPos.x,
			screenPos.y,
			this.host.viewport.panX,
			this.host.viewport.panY,
			this.host.viewport.zoom
		);

		this.currentPoint = worldPos;
		this.host.onCursorMoved?.(worldPos);

		if (!this.isInteracting) {
			this.updateHoverCursor(screenPos);
			this.host.renderOverlay();
			return;
		}

		if (this.interactionType === 'resize_shape') {
			if (!this.activeResizeHandle || !this.resizeInitialShape) return;
			const shape = this.host.getShape(this.resizeInitialShape.id);
			if (!shape) return;

			this.host.overlayCanvas.style.cursor = getResizeCursor(this.activeResizeHandle);

			const isShift = e.shiftKey || this.host.isShiftPressed;
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

			this.host.renderBuffer();
			this.host.renderOverlay();
			return;
		}

		if (this.interactionType === 'pan') {
			this.host.viewport.panX += e.movementX;
			this.host.viewport.panY += e.movementY;
			this.host.emitViewportChanged();
			this.host.renderBuffer();
			this.host.renderOverlay();
			return;
		}

		if (this.interactionType === 'draw') {
			this.activePathPoints.push({
				x: worldPos.x,
				y: worldPos.y,
				pressure: e.pressure || 0.5
			});
			this.host.renderOverlay();
			return;
		}

		if (this.interactionType === 'create_shape' || this.interactionType === 'create_line') {
			this.host.renderOverlay();
			return;
		}

		if (this.interactionType === 'drag_selection') {
			const dx = worldPos.x - this.startPoint.x;
			const dy = worldPos.y - this.startPoint.y;

			for (const [id, initialPos] of this.dragInitialPositions) {
				const shape = this.host.getShape(id);
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

			this.host.renderBuffer();
			this.host.renderOverlay();
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

			if (marquee.width >= 3 || marquee.height >= 3) {
				const hitIds = new Set(this.marqueeInitialSelected);
				for (const shape of this.host.getShapes().values()) {
					if (isShapeInsideMarquee(shape, marquee)) {
						hitIds.add(shape.id);
					}
				}
				this.host.setSelectedIds(Array.from(hitIds));
			} else {
				this.host.setSelectedIds(this.marqueeInitialSelected);
			}

			this.host.renderOverlay();
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
					stroke: this.host.strokeColor,
					strokeWidth: this.host.strokeWidth,
					rotation: 0,
					zIndex: this.host.getNextZIndex(),
					data: { points: simplified },
					createdBy: '',
					updatedAt: now
				};

				this.host.onShapesMutated?.([shape]);
				this.host.onActionRecorded?.({ type: 'create', shape });
			}
			this.activePathPoints = [];
		} else if (this.interactionType === 'create_line') {
			const dx = this.currentPoint.x - this.startPoint.x;
			const dy = this.currentPoint.y - this.startPoint.y;
			if (Math.hypot(dx, dy) >= 3) {
				const points: PathPoint[] = [
					{ x: this.startPoint.x, y: this.startPoint.y, pressure: 0.5 },
					{ x: this.currentPoint.x, y: this.currentPoint.y, pressure: 0.5 }
				];
				const bounds = this.calculatePointsBounds(points);
				const isArrow = this.host.tool === 'arrow';

				const shape: ShapeRecord = {
					id: 'shape_' + Math.random().toString(36).substring(2, 9),
					type: 'path',
					x: bounds.minX,
					y: bounds.minY,
					width: bounds.width,
					height: bounds.height,
					fill: 'transparent',
					stroke: this.host.strokeColor,
					strokeWidth: this.host.strokeWidth,
					rotation: 0,
					zIndex: this.host.getNextZIndex(),
					data: { points, isArrow },
					createdBy: '',
					updatedAt: now
				};

				this.host.onShapesMutated?.([shape]);
				this.host.onActionRecorded?.({ type: 'create', shape });
			}
		} else if (this.interactionType === 'create_shape') {
			let x = Math.min(this.startPoint.x, this.currentPoint.x);
			let y = Math.min(this.startPoint.y, this.currentPoint.y);
			let width = Math.abs(this.currentPoint.x - this.startPoint.x);
			let height = Math.abs(this.currentPoint.y - this.startPoint.y);

			let shapeType: ShapeType = 'rectangle';
			let shapeData: any = undefined;

			if (this.host.tool === 'ellipse') {
				shapeType = 'ellipse';
				width = Math.max(width, 10);
				height = Math.max(height, 10);
			} else if (this.host.tool === 'sticky_note') {
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
				fill: shapeType === 'sticky_note' ? '#fef08a' : this.host.fillColor,
				stroke: shapeType === 'sticky_note' ? '#eab308' : this.host.strokeColor,
				strokeWidth: shapeType === 'sticky_note' ? 1 : this.host.strokeWidth,
				rotation: 0,
				zIndex: this.host.getNextZIndex(),
				data: shapeData,
				createdBy: '',
				updatedAt: now
			};

			this.host.setShape(shape.id, shape);
			this.host.onShapesMutated?.([shape]);
			this.host.onActionRecorded?.({ type: 'create', shape });
			this.host.renderBuffer();

			if (shapeType === 'sticky_note') {
				this.host.setSelectedIds([shape.id]);
				this.host.startTextEdit(shape);
			}
		} else if (this.interactionType === 'create_text') {
			this.createTextInput(this.startPoint);
		} else if (this.interactionType === 'drag_selection') {
			const movedShapes: ShapeRecord[] = [];
			const beforeShapes: ShapeRecord[] = [];
			for (const id of this.host.selectedIds) {
				const shape = this.host.getShape(id);
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
				this.host.onShapesMutated?.(movedShapes);
				this.host.onActionRecorded?.({
					type: 'modify',
					before: beforeShapes,
					after: movedShapes
				});
			}
			this.dragInitialPositions.clear();
			this.dragInitialShapes.clear();
		} else if (this.interactionType === 'resize_shape') {
			if (this.resizeInitialShape && this.host.selectedIds.length === 1) {
				const shape = this.host.getShape(this.host.selectedIds[0]);
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
					this.host.onShapesMutated?.([mutated]);
					this.host.onActionRecorded?.({
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
				this.host.overlayCanvas.style.cursor = '';
			}
		}

		this.isInteracting = false;
		this.interactionType = null;
		this.marqueeInitialSelected = [];
		this.host.renderBuffer();
		this.host.renderOverlay();
	}

	handleWheel(e: WheelEvent) {
		e.preventDefault();

		if (e.ctrlKey || e.metaKey) {
			const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
			const newZoom = Math.min(Math.max(this.host.viewport.zoom * zoomFactor, 0.1), 5.0);

			const mouseX = e.clientX;
			const mouseY = e.clientY;

			this.host.viewport.panX =
				mouseX - (mouseX - this.host.viewport.panX) * (newZoom / this.host.viewport.zoom);
			this.host.viewport.panY =
				mouseY - (mouseY - this.host.viewport.panY) * (newZoom / this.host.viewport.zoom);
			this.host.viewport.zoom = newZoom;
		} else {
			this.host.viewport.panX -= e.deltaX;
			this.host.viewport.panY -= e.deltaY;
		}

		this.host.emitViewportChanged();
		this.host.renderBuffer();
		this.host.renderOverlay();
	}

	handleDblClick(e: MouseEvent) {
		const worldPos = screenToWorld(
			e.clientX,
			e.clientY,
			this.host.viewport.panX,
			this.host.viewport.panY,
			this.host.viewport.zoom
		);

		const sortedShapes = Array.from(this.host.getShapes().values()).sort(
			(a, b) => b.zIndex - a.zIndex
		);
		const hit = sortedShapes.find((s) => hitTestShape(worldPos, s));

		if (hit && (hit.type === 'sticky_note' || hit.type === 'text')) {
			this.isInteracting = false;
			this.interactionType = null;
			this.host.setSelectedIds([hit.id]);
			this.host.startTextEdit(hit);
		}
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
			height: Math.max(Math.round(this.host.fontSize * 1.3), 32),
			fill: 'transparent',
			stroke: this.host.strokeColor,
			strokeWidth: 1,
			rotation: 0,
			zIndex: this.host.getNextZIndex(),
			data: { text: '', fontSize: this.host.fontSize, fontFamily: this.host.fontFamily },
			createdBy: '',
			updatedAt: now
		};

		this.host.setShape(shape.id, shape);
		this.host.onShapesMutated?.([shape]);
		this.host.onActionRecorded?.({ type: 'create', shape });
		this.host.setSelectedIds([shape.id]);
		this.host.startTextEdit(shape);
	}
}
