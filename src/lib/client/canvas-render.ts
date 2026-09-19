import { getResizeHandles, getShapeBounds, isResizableShape, screenToWorld } from './math';
import { getFontFamilyCss, wrapText } from './canvas-text';
import type { PathPoint, PeerPresence, ShapeRecord } from '../types';

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

export function drawShape(
	ctx: CanvasRenderingContext2D,
	shape: ShapeRecord,
	defaultStroke: string,
	options: DrawShapeOptions = {}
) {
	const { editingShapeId = null, isStaticCtx = false } = options;

	ctx.save();

	ctx.strokeStyle = shape.stroke || defaultStroke;
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
			if (shape.data?.isDiamond) {
				ctx.closePath();
				if (shape.fill && shape.fill !== 'transparent') ctx.fill();
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

			if (shape.data?.isDiamond && (editingShapeId !== shape.id || !isStaticCtx)) {
				drawShapeCenteredText(ctx, shape, defaultStroke);
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

		if (editingShapeId !== shape.id || !isStaticCtx) {
			drawShapeCenteredText(ctx, shape, defaultStroke);
		}
	} else if (shape.type === 'ellipse') {
		ctx.beginPath();
		const rx = Math.max(Math.abs(shape.width / 2), 1);
		const ry = Math.max(Math.abs(shape.height / 2), 1);
		ctx.ellipse(shape.x + shape.width / 2, shape.y + shape.height / 2, rx, ry, 0, 0, Math.PI * 2);
		if (shape.fill && shape.fill !== 'transparent') ctx.fill();
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
	height: number
) {
	const dotSpacing = 32;

	const startWorld = screenToWorld(0, 0, panX, panY, zoom);
	const endWorld = screenToWorld(width, height, panX, panY, zoom);

	const startX = Math.floor(startWorld.x / dotSpacing) * dotSpacing;
	const startY = Math.floor(startWorld.y / dotSpacing) * dotSpacing;

	ctx.save();
	ctx.fillStyle = isLightTheme ? '#d4d4d8' : '#27272a';

	for (let x = startX; x <= endWorld.x; x += dotSpacing) {
		for (let y = startY; y <= endWorld.y; y += dotSpacing) {
			ctx.fillRect(x, y, 1.5, 1.5);
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
	strokeWidth: number
) {
	if (points.length <= 1) return;

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
}

export function drawLinePreview(
	ctx: CanvasRenderingContext2D,
	startPoint: { x: number; y: number },
	currentPoint: { x: number; y: number },
	strokeColor: string,
	strokeWidth: number,
	isArrow: boolean,
	isShiftPressed: boolean
) {
	const end = calculateLineEndPoint(startPoint, currentPoint, isShiftPressed);

	ctx.save();
	ctx.strokeStyle = strokeColor;
	ctx.fillStyle = strokeColor;
	ctx.lineWidth = strokeWidth;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	ctx.beginPath();
	ctx.moveTo(startPoint.x, startPoint.y);
	ctx.lineTo(end.x, end.y);
	ctx.stroke();

	if (isArrow) {
		drawArrowHead(ctx, startPoint.x, startPoint.y, end.x, end.y, strokeColor, strokeWidth);
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
	strokeWidth: number
) {
	const x = Math.min(startPoint.x, currentPoint.x);
	const y = Math.min(startPoint.y, currentPoint.y);
	const w = Math.abs(currentPoint.x - startPoint.x);
	const h = Math.abs(currentPoint.y - startPoint.y);

	ctx.save();
	ctx.strokeStyle = tool === 'sticky_note' ? '#eab308' : strokeColor;
	ctx.fillStyle = tool === 'sticky_note' ? 'rgba(254, 240, 138, 0.4)' : fillColor;
	ctx.lineWidth = strokeWidth;

	if (tool === 'sticky_note') {
		ctx.beginPath();
		ctx.roundRect(x, y, w, h, 6);
		ctx.fill();
		ctx.stroke();
	} else if (tool === 'rectangle') {
		ctx.beginPath();
		ctx.rect(x, y, w, h);
		if (fillColor !== 'transparent') ctx.fill();
		ctx.stroke();
	} else if (tool === 'ellipse') {
		ctx.beginPath();
		ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
		if (fillColor !== 'transparent') ctx.fill();
		ctx.stroke();
	} else if (tool === 'diamond') {
		ctx.beginPath();
		ctx.moveTo(x + w / 2, y);
		ctx.lineTo(x + w, y + h / 2);
		ctx.lineTo(x + w / 2, y + h);
		ctx.lineTo(x, y + h / 2);
		ctx.closePath();
		if (fillColor !== 'transparent') ctx.fill();
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
