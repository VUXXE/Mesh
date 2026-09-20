import {
	calculateOrthogonalPath,
	getResizeHandles,
	getShapeBounds,
	isResizableShape,
	screenToWorld,
	type AlignmentGuide,
	type AnchorSide,
	type QuickAddButton
} from './math';
import { getFontFamilyCss, wrapText } from './canvas-text';
import type {
	CornerRoundness,
	FillStyle,
	GridMode,
	PathPoint,
	PeerPresence,
	ShapeRecord,
	StrokeStyle
} from '../types';

export interface DrawShapeOptions {
	editingShapeId?: string | null;
	isStaticCtx?: boolean;
}

export function drawArrowHead(
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

export function drawHachureFill(
	ctx: CanvasRenderingContext2D,
	fillColor: string,
	bounds: { minX: number; minY: number; width: number; height: number },
	isCrossHatch = false,
	strokeWidth = 2
) {
	if (!fillColor || fillColor === 'transparent') return;

	ctx.save();
	ctx.strokeStyle = fillColor;
	ctx.lineWidth = Math.max(1, Math.min(strokeWidth, 2.5));
	ctx.lineCap = 'round';
	if (typeof ctx.setLineDash === 'function') {
		ctx.setLineDash([]);
	}

	const gap = 10;
	const { minX, minY, width, height } = bounds;
	const startX = minX - height - 30;
	const endX = minX + width + height + 30;

	// Diagonal 45° lines
	ctx.beginPath();
	for (let x = startX; x <= endX; x += gap) {
		ctx.moveTo(x, minY - 10);
		ctx.lineTo(x + height + 20, minY + height + 10);
	}
	ctx.stroke();

	if (isCrossHatch) {
		ctx.beginPath();
		for (let x = startX; x <= endX; x += gap) {
			ctx.moveTo(x + height + 20, minY - 10);
			ctx.lineTo(x, minY + height + 10);
		}
		ctx.stroke();
	}

	ctx.restore();
}

export function drawShape(
	ctx: CanvasRenderingContext2D,
	shape: ShapeRecord,
	defaultStroke: string,
	options: DrawShapeOptions = {}
) {
	const { editingShapeId = null, isStaticCtx = false } = options;

	ctx.save();

	const opacity =
		shape.data?.opacity !== undefined && shape.data?.opacity !== null
			? Number(shape.data.opacity)
			: 1;
	ctx.globalAlpha = Math.max(0.05, Math.min(1, opacity));

	const strokeStyle: StrokeStyle = shape.data?.strokeStyle || 'solid';
	const sw = shape.strokeWidth || 2;
	if (typeof ctx.setLineDash === 'function') {
		if (strokeStyle === 'dashed') {
			ctx.setLineDash([Math.max(sw * 3, 8), Math.max(sw * 2, 6)]);
		} else if (strokeStyle === 'dotted') {
			ctx.setLineDash([Math.max(sw, 2), Math.max(sw * 2, 5)]);
		} else {
			ctx.setLineDash([]);
		}
	}

	ctx.strokeStyle = shape.stroke || defaultStroke;
	ctx.fillStyle = shape.fill || 'transparent';
	ctx.lineWidth = sw;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	if (shape.type === 'path') {
		const points: PathPoint[] = shape.data?.points ?? [];
		if (points.length >= 2) {
			if (shape.data?.isDiamond) {
				const fillStyle: FillStyle = shape.data?.fillStyle || 'solid';
				if (shape.fill && shape.fill !== 'transparent') {
					if (fillStyle === 'hachure' || fillStyle === 'cross-hatch') {
						ctx.save();
						ctx.beginPath();
						ctx.moveTo(points[0].x, points[0].y);
						for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
						ctx.closePath();
						ctx.clip();
						drawHachureFill(
							ctx,
							shape.fill,
							{ minX: shape.x, minY: shape.y, width: shape.width, height: shape.height },
							fillStyle === 'cross-hatch',
							sw
						);
						ctx.restore();
					} else {
						ctx.beginPath();
						ctx.moveTo(points[0].x, points[0].y);
						for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
						ctx.closePath();
						ctx.fill();
					}
				}
				ctx.beginPath();
				ctx.moveTo(points[0].x, points[0].y);
				for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
				ctx.closePath();
				ctx.stroke();
			} else {
				ctx.beginPath();
				ctx.moveTo(points[0].x, points[0].y);
				for (let i = 1; i < points.length; i++) {
					ctx.lineTo(points[i].x, points[i].y);
				}
				ctx.stroke();

				if (shape.data?.isArrow && points.length >= 2) {
					const p1 = points[points.length - 2];
					const p2 = points[points.length - 1];
					drawArrowHead(
						ctx,
						p1.x,
						p1.y,
						p2.x,
						p2.y,
						shape.stroke || defaultStroke,
						shape.strokeWidth || 2
					);
				}
			}

			if (shape.data?.isDiamond && (editingShapeId !== shape.id || !isStaticCtx)) {
				drawShapeCenteredText(ctx, shape, defaultStroke);
			}
		}
	} else if (shape.type === 'rectangle') {
		const rx = Math.min(shape.x, shape.x + shape.width);
		const ry = Math.min(shape.y, shape.y + shape.height);
		const rw = Math.max(Math.abs(shape.width), 1);
		const rh = Math.max(Math.abs(shape.height), 1);
		const isRound = shape.data?.roundness === 'round' || shape.data?.roundness === undefined;
		const cr = isRound ? Math.min(10, Math.min(rw, rh) / 4) : 0;
		const fillStyle: FillStyle = shape.data?.fillStyle || 'solid';

		if (shape.fill && shape.fill !== 'transparent') {
			if (fillStyle === 'hachure' || fillStyle === 'cross-hatch') {
				ctx.save();
				ctx.beginPath();
				ctx.roundRect(rx, ry, rw, rh, cr);
				ctx.clip();
				drawHachureFill(
					ctx,
					shape.fill,
					{ minX: rx, minY: ry, width: rw, height: rh },
					fillStyle === 'cross-hatch',
					sw
				);
				ctx.restore();
			} else {
				ctx.beginPath();
				ctx.roundRect(rx, ry, rw, rh, cr);
				ctx.fill();
			}
		}

		ctx.beginPath();
		ctx.roundRect(rx, ry, rw, rh, cr);
		ctx.stroke();

		if (editingShapeId !== shape.id || !isStaticCtx) {
			drawShapeCenteredText(ctx, shape, defaultStroke);
		}
	} else if (shape.type === 'ellipse') {
		const rx = Math.max(Math.abs(shape.width / 2), 1);
		const ry = Math.max(Math.abs(shape.height / 2), 1);
		const cx = shape.x + shape.width / 2;
		const cy = shape.y + shape.height / 2;
		const fillStyle: FillStyle = shape.data?.fillStyle || 'solid';

		if (shape.fill && shape.fill !== 'transparent') {
			if (fillStyle === 'hachure' || fillStyle === 'cross-hatch') {
				ctx.save();
				ctx.beginPath();
				ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
				ctx.clip();
				drawHachureFill(
					ctx,
					shape.fill,
					{ minX: cx - rx, minY: cy - ry, width: rx * 2, height: ry * 2 },
					fillStyle === 'cross-hatch',
					sw
				);
				ctx.restore();
			} else {
				ctx.beginPath();
				ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		ctx.beginPath();
		ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
		ctx.stroke();

		if (editingShapeId !== shape.id || !isStaticCtx) {
			drawShapeCenteredText(ctx, shape, defaultStroke);
		}
	} else if (shape.type === 'text') {
		// Suppress static text while actively edited to avoid double-rendering under the textarea
		if (editingShapeId !== shape.id || !isStaticCtx) {
			const text = shape.data?.text || '';
			if (text) {
				const fSize = shape.data?.fontSize || 18;
				const fFamily = getFontFamilyCss(shape.data?.fontFamily || 'sans');
				ctx.font = `${fSize}px ${fFamily}`;
				ctx.fillStyle = shape.stroke || defaultStroke;
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
		ctx.save();
		ctx.fillStyle = shape.fill || '#fef08a';
		ctx.strokeStyle = shape.stroke || '#eab308';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.roundRect(shape.x, shape.y, shape.width, shape.height, 6);
		ctx.fill();
		ctx.stroke();

		if (editingShapeId !== shape.id || !isStaticCtx) {
			const text = shape.data?.text || '';
			if (text) {
				ctx.font = '14px system-ui, -apple-system, sans-serif';
				ctx.fillStyle = '#18181b';
				ctx.textBaseline = 'top';

				const padding = 12;
				const maxWidth = Math.max(shape.width - padding * 2, 20);
				const maxHeight = Math.max(shape.height - padding * 2, 20);
				const lineHeight = 18;

				ctx.save();
				ctx.beginPath();
				ctx.rect(shape.x + padding, shape.y + padding, maxWidth, maxHeight);
				ctx.clip();

				const lines = wrapText(ctx, text, maxWidth);
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

export function drawPeerCursor(
	ctx: CanvasRenderingContext2D,
	peer: PeerPresence,
	overridePos?: { x: number; y: number } | null,
	alpha = 1
) {
	const pos = overridePos ?? peer.cursor;
	if (!pos || alpha <= 0.01) return;

	ctx.save();
	if (alpha < 1) {
		ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
	}
	const { x, y } = pos;
	const color = peer.color || '#06b6d4';

	// SVG-style pointer arrow
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

	// Peer identification pill
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

export function renderGrid(
	ctx: CanvasRenderingContext2D,
	panX: number,
	panY: number,
	zoom: number,
	isLightTheme: boolean,
	width: number,
	height: number,
	gridMode: GridMode = 'dots'
) {
	if (gridMode === 'none') return;

	let spacing = 32;
	if (zoom < 0.2) {
		spacing = 128;
	} else if (zoom < 0.45) {
		spacing = 64;
	}

	const startWorld = screenToWorld(0, 0, panX, panY, zoom);
	const endWorld = screenToWorld(width, height, panX, panY, zoom);

	const startX = Math.floor(startWorld.x / spacing) * spacing;
	const startY = Math.floor(startWorld.y / spacing) * spacing;

	ctx.save();

	if (gridMode === 'lines') {
		ctx.strokeStyle = isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.07)';
		ctx.lineWidth = 1 / zoom;
		ctx.beginPath();
		for (let x = startX; x <= endWorld.x; x += spacing) {
			ctx.moveTo(x, startWorld.y);
			ctx.lineTo(x, endWorld.y);
		}
		for (let y = startY; y <= endWorld.y; y += spacing) {
			ctx.moveTo(startWorld.x, y);
			ctx.lineTo(endWorld.x, y);
		}
		ctx.stroke();
	} else {
		// gridMode === 'dots'
		ctx.fillStyle = isLightTheme ? '#a1a1aa' : '#2e2e33';
		const dotSize = Math.max(1.75, 1.75 / Math.min(zoom, 1));
		for (let x = startX; x <= endWorld.x; x += spacing) {
			for (let y = startY; y <= endWorld.y; y += spacing) {
				ctx.fillRect(x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
			}
		}
	}

	ctx.restore();
}

export function calculateLineEndPoint(
	start: { x: number; y: number },
	current: { x: number; y: number },
	snap: boolean
): { x: number; y: number } {
	if (!snap) return current;
	const dx = current.x - start.x;
	const dy = current.y - start.y;
	const dist = Math.sqrt(dx * dx + dy * dy);
	let angle = Math.atan2(dy, dx);
	const snapInterval = Math.PI / 4;
	angle = Math.round(angle / snapInterval) * snapInterval;
	return {
		x: start.x + dist * Math.cos(angle),
		y: start.y + dist * Math.sin(angle)
	};
}

export function drawActiveStroke(
	ctx: CanvasRenderingContext2D,
	points: PathPoint[],
	strokeColor: string,
	strokeWidth: number,
	options?: {
		strokeStyle?: StrokeStyle;
		opacity?: number;
	}
) {
	if (points.length <= 1) return;

	ctx.save();
	if (options?.opacity !== undefined && options.opacity < 1) {
		ctx.globalAlpha *= options.opacity;
	}
	if (options?.strokeStyle === 'dashed') {
		ctx.setLineDash([Math.max(strokeWidth * 3, 8), Math.max(strokeWidth * 2, 6)]);
	} else if (options?.strokeStyle === 'dotted') {
		ctx.setLineDash([Math.max(strokeWidth, 2), Math.max(strokeWidth * 2, 5)]);
	}

	ctx.beginPath();
	ctx.strokeStyle = strokeColor;
	ctx.lineWidth = strokeWidth;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	ctx.moveTo(points[0].x, points[0].y);
	for (let i = 1; i < points.length; i++) {
		ctx.lineTo(points[i].x, points[i].y);
	}
	ctx.stroke();
	ctx.restore();
}

export function drawLinePreview(
	ctx: CanvasRenderingContext2D,
	startPoint: { x: number; y: number },
	currentPoint: { x: number; y: number },
	strokeColor: string,
	strokeWidth: number,
	isArrow: boolean,
	isShiftPressed: boolean,
	routing: 'straight' | 'orthogonal' = 'straight',
	startSide?: AnchorSide,
	endSide?: AnchorSide,
	styleOptions?: {
		strokeStyle?: StrokeStyle;
		opacity?: number;
	}
) {
	const end = calculateLineEndPoint(startPoint, currentPoint, isShiftPressed);

	ctx.save();

	const opacity = styleOptions?.opacity !== undefined ? Number(styleOptions.opacity) : 1;
	ctx.globalAlpha = Math.max(0.05, Math.min(1, opacity));

	const strokeStyle: StrokeStyle = styleOptions?.strokeStyle || 'solid';
	if (strokeStyle === 'dashed') {
		ctx.setLineDash([Math.max(strokeWidth * 3, 8), Math.max(strokeWidth * 2, 6)]);
	} else if (strokeStyle === 'dotted') {
		ctx.setLineDash([Math.max(strokeWidth, 2), Math.max(strokeWidth * 2, 5)]);
	} else {
		ctx.setLineDash([]);
	}

	ctx.strokeStyle = strokeColor;
	ctx.fillStyle = strokeColor;
	ctx.lineWidth = strokeWidth;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	if (routing === 'orthogonal') {
		const points = calculateOrthogonalPath(startPoint, end, startSide, endSide);
		if (points.length >= 2) {
			ctx.beginPath();
			ctx.moveTo(points[0].x, points[0].y);
			for (let i = 1; i < points.length; i++) {
				ctx.lineTo(points[i].x, points[i].y);
			}
			ctx.stroke();

			if (isArrow) {
				const p1 = points[points.length - 2];
				const p2 = points[points.length - 1];
				drawArrowHead(ctx, p1.x, p1.y, p2.x, p2.y, strokeColor, strokeWidth);
			}
		}
	} else {
		ctx.beginPath();
		ctx.moveTo(startPoint.x, startPoint.y);
		ctx.lineTo(end.x, end.y);
		ctx.stroke();

		if (isArrow) {
			drawArrowHead(ctx, startPoint.x, startPoint.y, end.x, end.y, strokeColor, strokeWidth);
		}
	}
	ctx.restore();
}

export function drawShapePreview(
	ctx: CanvasRenderingContext2D,
	startPoint: { x: number; y: number },
	currentPoint: { x: number; y: number },
	tool: string,
	strokeColor: string,
	fillColor: string,
	strokeWidth: number,
	styleOptions?: {
		strokeStyle?: StrokeStyle;
		fillStyle?: FillStyle;
		roundness?: CornerRoundness;
		opacity?: number;
	}
) {
	const x = Math.min(startPoint.x, currentPoint.x);
	const y = Math.min(startPoint.y, currentPoint.y);
	const w = Math.abs(currentPoint.x - startPoint.x);
	const h = Math.abs(currentPoint.y - startPoint.y);

	ctx.save();

	const opacity = styleOptions?.opacity !== undefined ? Number(styleOptions.opacity) : 1;
	ctx.globalAlpha = Math.max(0.05, Math.min(1, opacity));

	const strokeStyle: StrokeStyle = styleOptions?.strokeStyle || 'solid';
	if (strokeStyle === 'dashed') {
		ctx.setLineDash([Math.max(strokeWidth * 3, 8), Math.max(strokeWidth * 2, 6)]);
	} else if (strokeStyle === 'dotted') {
		ctx.setLineDash([Math.max(strokeWidth, 2), Math.max(strokeWidth * 2, 5)]);
	} else {
		ctx.setLineDash([]);
	}

	ctx.strokeStyle = tool === 'sticky_note' ? '#eab308' : strokeColor;
	ctx.fillStyle = tool === 'sticky_note' ? 'rgba(254, 240, 138, 0.4)' : fillColor;
	ctx.lineWidth = strokeWidth;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	if (tool === 'sticky_note') {
		ctx.beginPath();
		ctx.roundRect(x, y, w, h, 6);
		ctx.fill();
		ctx.stroke();
	} else if (tool === 'rectangle') {
		const isRound = styleOptions?.roundness === 'round' || styleOptions?.roundness === undefined;
		const cr = isRound ? Math.min(10, Math.min(w, h) / 4) : 0;
		const fillStyle = styleOptions?.fillStyle || 'solid';

		if (fillColor && fillColor !== 'transparent') {
			if (fillStyle === 'hachure' || fillStyle === 'cross-hatch') {
				ctx.save();
				ctx.beginPath();
				ctx.roundRect(x, y, w, h, cr);
				ctx.clip();
				drawHachureFill(
					ctx,
					fillColor,
					{ minX: x, minY: y, width: w, height: h },
					fillStyle === 'cross-hatch',
					strokeWidth
				);
				ctx.restore();
			} else {
				ctx.beginPath();
				ctx.roundRect(x, y, w, h, cr);
				ctx.fill();
			}
		}

		ctx.beginPath();
		ctx.roundRect(x, y, w, h, cr);
		ctx.stroke();
	} else if (tool === 'ellipse') {
		const rx = Math.max(w / 2, 1);
		const ry = Math.max(h / 2, 1);
		const cx = x + rx;
		const cy = y + ry;
		const fillStyle = styleOptions?.fillStyle || 'solid';

		if (fillColor && fillColor !== 'transparent') {
			if (fillStyle === 'hachure' || fillStyle === 'cross-hatch') {
				ctx.save();
				ctx.beginPath();
				ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
				ctx.clip();
				drawHachureFill(
					ctx,
					fillColor,
					{ minX: x, minY: y, width: w, height: h },
					fillStyle === 'cross-hatch',
					strokeWidth
				);
				ctx.restore();
			} else {
				ctx.beginPath();
				ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		ctx.beginPath();
		ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
		ctx.stroke();
	} else if (tool === 'diamond') {
		const fillStyle = styleOptions?.fillStyle || 'solid';
		if (fillColor && fillColor !== 'transparent') {
			if (fillStyle === 'hachure' || fillStyle === 'cross-hatch') {
				ctx.save();
				ctx.beginPath();
				ctx.moveTo(x + w / 2, y);
				ctx.lineTo(x + w, y + h / 2);
				ctx.lineTo(x + w / 2, y + h);
				ctx.lineTo(x, y + h / 2);
				ctx.closePath();
				ctx.clip();
				drawHachureFill(
					ctx,
					fillColor,
					{ minX: x, minY: y, width: w, height: h },
					fillStyle === 'cross-hatch',
					strokeWidth
				);
				ctx.restore();
			} else {
				ctx.beginPath();
				ctx.moveTo(x + w / 2, y);
				ctx.lineTo(x + w, y + h / 2);
				ctx.lineTo(x + w / 2, y + h);
				ctx.lineTo(x, y + h / 2);
				ctx.closePath();
				ctx.fill();
			}
		}

		ctx.beginPath();
		ctx.moveTo(x + w / 2, y);
		ctx.lineTo(x + w, y + h / 2);
		ctx.lineTo(x + w / 2, y + h);
		ctx.lineTo(x, y + h / 2);
		ctx.closePath();
		ctx.stroke();
	}
	ctx.restore();
}

export function drawSelectionOutline(
	ctx: CanvasRenderingContext2D,
	selectedIds: string[],
	shapes: Map<string, ShapeRecord>,
	zoom: number,
	editingShapeId?: string | null
) {
	if (selectedIds.length === 0) return;

	const isSingleSelection = selectedIds.length === 1;
	const singleShape = isSingleSelection ? shapes.get(selectedIds[0]) : null;
	const canResizeSingle =
		singleShape && isResizableShape(singleShape.type) && editingShapeId !== singleShape.id;

	for (const id of selectedIds) {
		const shape = shapes.get(id);
		if (shape) {
			const b = getShapeBounds(shape);
			ctx.save();
			ctx.strokeStyle = '#6366f1';
			ctx.lineWidth = 1.5 / zoom;
			ctx.setLineDash([4 / zoom, 4 / zoom]);
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

		const handleSize = 8 / zoom;
		const halfSize = handleSize / 2;

		ctx.save();
		ctx.fillStyle = '#ffffff';
		ctx.strokeStyle = '#6366f1';
		ctx.lineWidth = 1.5 / zoom;
		ctx.setLineDash([]);

		for (const pos of Object.values(handles)) {
			ctx.beginPath();
			ctx.fillRect(pos.x - halfSize, pos.y - halfSize, handleSize, handleSize);
			ctx.strokeRect(pos.x - halfSize, pos.y - halfSize, handleSize, handleSize);
		}
		ctx.restore();
	}
}

export function drawMarqueeBox(
	ctx: CanvasRenderingContext2D,
	startPoint: { x: number; y: number },
	currentPoint: { x: number; y: number },
	zoom: number
) {
	const minX = Math.min(startPoint.x, currentPoint.x);
	const minY = Math.min(startPoint.y, currentPoint.y);
	const w = Math.abs(currentPoint.x - startPoint.x);
	const h = Math.abs(currentPoint.y - startPoint.y);

	ctx.save();
	ctx.strokeStyle = '#6366f1';
	ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
	ctx.lineWidth = 1 / zoom;
	ctx.fillRect(minX, minY, w, h);
	ctx.strokeRect(minX, minY, w, h);
	ctx.restore();
}

export function drawAnchorIndicator(
	ctx: CanvasRenderingContext2D,
	anchor: { x: number; y: number },
	zoom: number
) {
	ctx.save();
	const r = Math.max(5 / zoom, 3);
	// Outer glow ring
	ctx.beginPath();
	ctx.arc(anchor.x, anchor.y, r * 1.8, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
	ctx.fill();

	// Inner dot
	ctx.beginPath();
	ctx.arc(anchor.x, anchor.y, r, 0, Math.PI * 2);
	ctx.fillStyle = '#6366f1';
	ctx.fill();
	ctx.lineWidth = 1.5 / zoom;
	ctx.strokeStyle = '#ffffff';
	ctx.stroke();
	ctx.restore();
}

export function drawShapeCenteredText(
	ctx: CanvasRenderingContext2D,
	shape: ShapeRecord,
	defaultStroke: string
) {
	const text = shape.data?.text;
	if (!text) return;

	ctx.save();
	const fSize = shape.data?.fontSize || 16;
	const fFamily = getFontFamilyCss(shape.data?.fontFamily || 'sans');
	ctx.font = `${fSize}px ${fFamily}`;
	ctx.fillStyle = shape.stroke || defaultStroke;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	const cx = shape.x + shape.width / 2;
	const cy = shape.y + shape.height / 2;
	const maxTextWidth = Math.max(shape.data?.isDiamond ? shape.width * 0.6 : shape.width * 0.85, 20);
	const lines = wrapText(ctx, text, maxTextWidth);
	const lineHeight = Math.round(fSize * 1.3);
	const totalH = lines.length * lineHeight;
	let curY = cy - totalH / 2 + lineHeight / 2;

	for (const line of lines) {
		ctx.fillText(line, cx, curY);
		curY += lineHeight;
	}
	ctx.restore();
}

export function drawAlignmentGuides(
	ctx: CanvasRenderingContext2D,
	guides: AlignmentGuide[],
	zoom: number
) {
	if (!guides || guides.length === 0) return;

	ctx.save();
	ctx.lineWidth = 1 / zoom;
	ctx.strokeStyle = '#06b6d4';
	ctx.setLineDash([4 / zoom, 4 / zoom]);

	for (const guide of guides) {
		ctx.beginPath();
		if (guide.type === 'vertical') {
			ctx.moveTo(guide.pos, guide.from);
			ctx.lineTo(guide.pos, guide.to);
		} else {
			ctx.moveTo(guide.from, guide.pos);
			ctx.lineTo(guide.to, guide.pos);
		}
		ctx.stroke();
	}
	ctx.restore();
}

export function drawQuickAddButtons(
	ctx: CanvasRenderingContext2D,
	buttons: QuickAddButton[],
	zoom: number,
	hoveredSide: string | null = null
) {
	if (!buttons || buttons.length === 0) return;

	ctx.save();
	for (const b of buttons) {
		const isHovered = hoveredSide === b.side;
		const r = (isHovered ? 12 : 10) / zoom;

		ctx.beginPath();
		ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
		ctx.fillStyle = isHovered ? '#4f46e5' : '#1e1b4b';
		ctx.fill();
		ctx.lineWidth = 1.5 / zoom;
		ctx.strokeStyle = isHovered ? '#a5b4fc' : '#6366f1';
		ctx.stroke();

		// Draw '+' symbol
		const plusR = (isHovered ? 5 : 4) / zoom;
		ctx.beginPath();
		ctx.moveTo(b.x - plusR, b.y);
		ctx.lineTo(b.x + plusR, b.y);
		ctx.moveTo(b.x, b.y - plusR);
		ctx.lineTo(b.x, b.y + plusR);
		ctx.lineWidth = 1.8 / zoom;
		ctx.strokeStyle = '#ffffff';
		ctx.stroke();
	}
	ctx.restore();
}
