import { screenToWorld } from './math';
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

export function drawPeerCursor(ctx: CanvasRenderingContext2D, peer: PeerPresence) {
	if (!peer.cursor) return;

	ctx.save();
	const { x, y } = peer.cursor;
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
