import type { PathPoint, ShapeRecord, ShapeType } from '../types';

/**
 * Perpendicular distance from a point P to a line segment AB.
 */
export function perpendicularDistance(p: PathPoint, a: PathPoint, b: PathPoint): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;

	if (dx === 0 && dy === 0) {
		const px = p.x - a.x;
		const py = p.y - a.y;
		return Math.sqrt(px * px + py * py);
	}

	const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);

	if (t < 0) {
		const px = p.x - a.x;
		const py = p.y - a.y;
		return Math.sqrt(px * px + py * py);
	}
	if (t > 1) {
		const px = p.x - b.x;
		const py = p.y - b.y;
		return Math.sqrt(px * px + py * py);
	}

	const projX = a.x + t * dx;
	const projY = a.y + t * dy;
	const diffX = p.x - projX;
	const diffY = p.y - projY;
	return Math.sqrt(diffX * diffX + diffY * diffY);
}

/**
 * Ramer-Douglas-Peucker (RDP) algorithm for path smoothing and simplification.
 * Runs client-side only (PRD §2, §7.2).
 */
export function simplifyRDP(points: PathPoint[], epsilon = 1.5): PathPoint[] {
	if (points.length <= 2) return points;

	let dmax = 0;
	let index = 0;
	const end = points.length - 1;

	for (let i = 1; i < end; i++) {
		const d = perpendicularDistance(points[i], points[0], points[end]);
		if (d > dmax) {
			index = i;
			dmax = d;
		}
	}

	if (dmax > epsilon) {
		const left = simplifyRDP(points.slice(0, index + 1), epsilon);
		const right = simplifyRDP(points.slice(index), epsilon);
		return left.slice(0, left.length - 1).concat(right);
	} else {
		return [points[0], points[end]];
	}
}

export interface BoundingBox {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	width: number;
	height: number;
}

/**
 * Computes the axis-aligned bounding box of any shape.
 */
export function getShapeBounds(shape: ShapeRecord): BoundingBox {
	if (shape.type === 'path') {
		const points: PathPoint[] = shape.data?.points ?? [];
		if (points.length === 0) {
			const minX = Math.min(shape.x, shape.x + shape.width);
			const minY = Math.min(shape.y, shape.y + shape.height);
			const maxX = Math.max(shape.x, shape.x + shape.width);
			const maxY = Math.max(shape.y, shape.y + shape.height);
			return {
				minX,
				minY,
				maxX,
				maxY,
				width: Math.max(maxX - minX, 1),
				height: Math.max(maxY - minY, 1)
			};
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

		const padding = (shape.strokeWidth || 2) / 2;
		return {
			minX: minX - padding,
			minY: minY - padding,
			maxX: maxX + padding,
			maxY: maxY + padding,
			width: Math.max(maxX - minX + padding * 2, 1),
			height: Math.max(maxY - minY + padding * 2, 1)
		};
	}

	const minX = Math.min(shape.x, shape.x + shape.width);
	const minY = Math.min(shape.y, shape.y + shape.height);
	const maxX = Math.max(shape.x, shape.x + shape.width);
	const maxY = Math.max(shape.y, shape.y + shape.height);

	return {
		minX,
		minY,
		maxX,
		maxY,
		width: Math.max(maxX - minX, 1),
		height: Math.max(maxY - minY, 1)
	};
}

/**
 * Checks if a point (world space) is inside a shape's hit area.
 */
export function hitTestShape(point: { x: number; y: number }, shape: ShapeRecord): boolean {
	const bounds = getShapeBounds(shape);
	const hitPadding = Math.max(shape.strokeWidth || 2, 6);

	if (
		point.x < bounds.minX - hitPadding ||
		point.x > bounds.maxX + hitPadding ||
		point.y < bounds.minY - hitPadding ||
		point.y > bounds.maxY + hitPadding
	) {
		return false;
	}

	if (shape.type === 'text' || shape.type === 'sticky_note') {
		return (
			point.x >= shape.x - hitPadding &&
			point.x <= shape.x + shape.width + hitPadding &&
			point.y >= shape.y - hitPadding &&
			point.y <= shape.y + shape.height + hitPadding
		);
	}

	if (shape.type === 'rectangle') {
		const isFilled =
			(shape.fill && shape.fill !== 'transparent' && shape.fill !== 'none') ||
			Boolean(shape.data?.text?.trim());
		if (isFilled) {
			return (
				point.x >= shape.x - hitPadding &&
				point.x <= shape.x + shape.width + hitPadding &&
				point.y >= shape.y - hitPadding &&
				point.y <= shape.y + shape.height + hitPadding
			);
		} else {
			const outerMinX = shape.x - hitPadding;
			const outerMaxX = shape.x + shape.width + hitPadding;
			const outerMinY = shape.y - hitPadding;
			const outerMaxY = shape.y + shape.height + hitPadding;

			const inOuter =
				point.x >= outerMinX &&
				point.x <= outerMaxX &&
				point.y >= outerMinY &&
				point.y <= outerMaxY;

			if (!inOuter) return false;
			if (shape.width <= hitPadding * 2 || shape.height <= hitPadding * 2) return true;

			const innerMinX = shape.x + hitPadding;
			const innerMaxX = shape.x + shape.width - hitPadding;
			const innerMinY = shape.y + hitPadding;
			const innerMaxY = shape.y + shape.height - hitPadding;

			const inInner =
				point.x > innerMinX && point.x < innerMaxX && point.y > innerMinY && point.y < innerMaxY;

			return !inInner;
		}
	}

	if (shape.type === 'ellipse') {
		const rx = shape.width / 2;
		const ry = shape.height / 2;
		if (rx === 0 || ry === 0) return false;
		const cx = shape.x + rx;
		const cy = shape.y + ry;

		const isFilled =
			(shape.fill && shape.fill !== 'transparent' && shape.fill !== 'none') ||
			Boolean(shape.data?.text?.trim());
		const normalizedX = (point.x - cx) / (rx + hitPadding);
		const normalizedY = (point.y - cy) / (ry + hitPadding);
		const inOuter = normalizedX * normalizedX + normalizedY * normalizedY <= 1;

		if (!inOuter) return false;
		if (isFilled || rx <= hitPadding || ry <= hitPadding) return true;

		const innerRx = Math.max(rx - hitPadding, 0);
		const innerRy = Math.max(ry - hitPadding, 0);
		if (innerRx === 0 || innerRy === 0) return true;

		const normInnerX = (point.x - cx) / innerRx;
		const normInnerY = (point.y - cy) / innerRy;
		const inInner = normInnerX * normInnerX + normInnerY * normInnerY < 1;

		return !inInner;
	}

	if (shape.type === 'path') {
		const points: PathPoint[] = shape.data?.points ?? [];
		if (points.length < 2) return false;

		if (shape.data?.isDiamond) {
			const isFilled =
				(shape.fill && shape.fill !== 'transparent' && shape.fill !== 'none') ||
				Boolean(shape.data?.text?.trim());
			if (isFilled && isPointInsidePolygon(point, points)) {
				return true;
			}
		}

		for (let i = 0; i < points.length - 1; i++) {
			const dist = perpendicularDistance(point, points[i], points[i + 1]);
			if (dist <= hitPadding) {
				return true;
			}
		}
		return false;
	}

	return false;
}

export function isPointInsidePolygon(point: { x: number; y: number }, vs: PathPoint[]): boolean {
	let inside = false;
	for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
		const xi = vs[i].x;
		const yi = vs[i].y;
		const xj = vs[j].x;
		const yj = vs[j].y;
		const intersect =
			yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

export type AnchorSide = 'top' | 'right' | 'bottom' | 'left';

export interface ShapeAnchor {
	shapeId: string;
	side: AnchorSide;
	x: number;
	y: number;
}

export function getShapeAnchors(shape: ShapeRecord): ShapeAnchor[] {
	const cx = shape.x + shape.width / 2;
	const cy = shape.y + shape.height / 2;
	return [
		{ shapeId: shape.id, side: 'top', x: cx, y: shape.y },
		{ shapeId: shape.id, side: 'right', x: shape.x + shape.width, y: cy },
		{ shapeId: shape.id, side: 'bottom', x: cx, y: shape.y + shape.height },
		{ shapeId: shape.id, side: 'left', x: shape.x, y: cy }
	];
}

export function findNearestAnchor(
	point: { x: number; y: number },
	shapes: Iterable<ShapeRecord>,
	excludeShapeId?: string,
	maxDistance = 20
): ShapeAnchor | null {
	let bestAnchor: ShapeAnchor | null = null;
	let minDist = maxDistance;

	for (const shape of shapes) {
		if (shape.id === excludeShapeId) continue;
		if (
			shape.type !== 'rectangle' &&
			shape.type !== 'ellipse' &&
			shape.type !== 'sticky_note' &&
			!(shape.type === 'path' && shape.data?.isDiamond)
		) {
			continue;
		}

		for (const anchor of getShapeAnchors(shape)) {
			const dist = Math.hypot(point.x - anchor.x, point.y - anchor.y);
			if (dist < minDist) {
				minDist = dist;
				bestAnchor = anchor;
			}
		}
	}

	return bestAnchor;
}

function ccw(
	a: { x: number; y: number },
	b: { x: number; y: number },
	c: { x: number; y: number }
): boolean {
	return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(
	p1: { x: number; y: number },
	p2: { x: number; y: number },
	p3: { x: number; y: number },
	p4: { x: number; y: number }
): boolean {
	return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

function segmentIntersectsBox(
	p1: { x: number; y: number },
	p2: { x: number; y: number },
	box: BoundingBox
): boolean {
	if (
		(p1.x >= box.minX && p1.x <= box.maxX && p1.y >= box.minY && p1.y <= box.maxY) ||
		(p2.x >= box.minX && p2.x <= box.maxX && p2.y >= box.minY && p2.y <= box.maxY)
	) {
		return true;
	}
	const tl = { x: box.minX, y: box.minY };
	const tr = { x: box.maxX, y: box.minY };
	const br = { x: box.maxX, y: box.maxY };
	const bl = { x: box.minX, y: box.maxY };

	return (
		segmentsIntersect(p1, p2, tl, tr) ||
		segmentsIntersect(p1, p2, tr, br) ||
		segmentsIntersect(p1, p2, br, bl) ||
		segmentsIntersect(p1, p2, bl, tl)
	);
}

/**
 * Checks if a shape intersects with or is inside a marquee selection box.
 */
export function isShapeInsideMarquee(shape: ShapeRecord, marquee: BoundingBox): boolean {
	const b = getShapeBounds(shape);

	const aabbOverlap =
		b.minX <= marquee.maxX &&
		b.maxX >= marquee.minX &&
		b.minY <= marquee.maxY &&
		b.maxY >= marquee.minY;

	if (!aabbOverlap) {
		return false;
	}

	if (shape.type === 'path') {
		const points: PathPoint[] = shape.data?.points ?? [];
		if (points.length <= 1) {
			return aabbOverlap;
		}

		for (let i = 0; i < points.length; i++) {
			const p = points[i];
			if (
				p.x >= marquee.minX &&
				p.x <= marquee.maxX &&
				p.y >= marquee.minY &&
				p.y <= marquee.maxY
			) {
				return true;
			}
		}

		for (let i = 0; i < points.length - 1; i++) {
			if (segmentIntersectsBox(points[i], points[i + 1], marquee)) {
				return true;
			}
		}

		return false;
	}

	return true;
}

/**
 * Screen to World coordinate transform.
 */
export function screenToWorld(
	screenX: number,
	screenY: number,
	panX: number,
	panY: number,
	zoom: number
): { x: number; y: number } {
	return {
		x: (screenX - panX) / zoom,
		y: (screenY - panY) / zoom
	};
}

/**
 * World to Screen coordinate transform.
 */
export function worldToScreen(
	worldX: number,
	worldY: number,
	panX: number,
	panY: number,
	zoom: number
): { x: number; y: number } {
	return {
		x: worldX * zoom + panX,
		y: worldY * zoom + panY
	};
}

export type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';

export function isResizableShape(type: ShapeType): boolean {
	return (
		type === 'rectangle' ||
		type === 'ellipse' ||
		type === 'sticky_note' ||
		type === 'text' ||
		type === 'path'
	);
}

export function getResizeHandles(
	bounds: BoundingBox
): Record<ResizeHandle, { x: number; y: number }> {
	const midX = bounds.minX + bounds.width / 2;
	const midY = bounds.minY + bounds.height / 2;

	return {
		nw: { x: bounds.minX, y: bounds.minY },
		n: { x: midX, y: bounds.minY },
		ne: { x: bounds.maxX, y: bounds.minY },
		e: { x: bounds.maxX, y: midY },
		se: { x: bounds.maxX, y: bounds.maxY },
		s: { x: midX, y: bounds.maxY },
		sw: { x: bounds.minX, y: bounds.maxY },
		w: { x: bounds.minX, y: midY }
	};
}

export function hitTestResizeHandles(
	screenPos: { x: number; y: number },
	bounds: BoundingBox,
	panX: number,
	panY: number,
	zoom: number,
	hitRadius = 8
): ResizeHandle | null {
	const handles = getResizeHandles(bounds);
	const handleOrder: ResizeHandle[] = ['nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w'];

	for (const handle of handleOrder) {
		const pos = handles[handle];
		const screenHandle = worldToScreen(pos.x, pos.y, panX, panY, zoom);
		const dx = Math.abs(screenPos.x - screenHandle.x);
		const dy = Math.abs(screenPos.y - screenHandle.y);
		if (dx <= hitRadius && dy <= hitRadius) {
			return handle;
		}
	}

	return null;
}

export function getResizeCursor(handle: ResizeHandle): string {
	switch (handle) {
		case 'nw':
		case 'se':
			return 'nwse-resize';
		case 'ne':
		case 'sw':
			return 'nesw-resize';
		case 'n':
		case 's':
			return 'ns-resize';
		case 'e':
		case 'w':
			return 'ew-resize';
	}
}

export interface ResizeBoundsOptions {
	handle: ResizeHandle;
	initialBounds: { x: number; y: number; width: number; height: number };
	startPoint: { x: number; y: number };
	currentPoint: { x: number; y: number };
	maintainAspectRatio: boolean;
	minWidth?: number;
	minHeight?: number;
}

export function calculateResizedBounds(options: ResizeBoundsOptions): {
	x: number;
	y: number;
	width: number;
	height: number;
} {
	const {
		handle,
		initialBounds: { x: x0, y: y0, width: w0, height: h0 },
		startPoint,
		currentPoint,
		maintainAspectRatio,
		minWidth = 10,
		minHeight = 10
	} = options;

	const dx = currentPoint.x - startPoint.x;
	const dy = currentPoint.y - startPoint.y;
	const right0 = x0 + w0;
	const bottom0 = y0 + h0;
	const aspect = h0 > 0 ? w0 / h0 : 1;

	if (!maintainAspectRatio) {
		switch (handle) {
			case 'se': {
				const w = Math.max(minWidth, w0 + dx);
				const h = Math.max(minHeight, h0 + dy);
				return { x: x0, y: y0, width: w, height: h };
			}
			case 'sw': {
				const w = Math.max(minWidth, w0 - dx);
				const h = Math.max(minHeight, h0 + dy);
				return { x: right0 - w, y: y0, width: w, height: h };
			}
			case 'ne': {
				const w = Math.max(minWidth, w0 + dx);
				const h = Math.max(minHeight, h0 - dy);
				return { x: x0, y: bottom0 - h, width: w, height: h };
			}
			case 'nw': {
				const w = Math.max(minWidth, w0 - dx);
				const h = Math.max(minHeight, h0 - dy);
				return { x: right0 - w, y: bottom0 - h, width: w, height: h };
			}
			case 'e': {
				const w = Math.max(minWidth, w0 + dx);
				return { x: x0, y: y0, width: w, height: h0 };
			}
			case 'w': {
				const w = Math.max(minWidth, w0 - dx);
				return { x: right0 - w, y: y0, width: w, height: h0 };
			}
			case 's': {
				const h = Math.max(minHeight, h0 + dy);
				return { x: x0, y: y0, width: w0, height: h };
			}
			case 'n': {
				const h = Math.max(minHeight, h0 - dy);
				return { x: x0, y: bottom0 - h, width: w0, height: h };
			}
		}
	}

	// Aspect ratio locked resizing
	const minScale = Math.max(minWidth / w0, minHeight / h0);

	switch (handle) {
		case 'se': {
			const len = Math.hypot(w0, h0);
			const proj = (dx * w0 + dy * h0) / len;
			const scale = Math.max((len + proj) / len, minScale);
			const w = w0 * scale;
			const h = h0 * scale;
			return { x: x0, y: y0, width: w, height: h };
		}
		case 'nw': {
			const len = Math.hypot(w0, h0);
			const proj = (-dx * w0 - dy * h0) / len;
			const scale = Math.max((len + proj) / len, minScale);
			const w = w0 * scale;
			const h = h0 * scale;
			return { x: right0 - w, y: bottom0 - h, width: w, height: h };
		}
		case 'ne': {
			const len = Math.hypot(w0, h0);
			const proj = (dx * w0 - dy * h0) / len;
			const scale = Math.max((len + proj) / len, minScale);
			const w = w0 * scale;
			const h = h0 * scale;
			return { x: x0, y: bottom0 - h, width: w, height: h };
		}
		case 'sw': {
			const len = Math.hypot(w0, h0);
			const proj = (-dx * w0 + dy * h0) / len;
			const scale = Math.max((len + proj) / len, minScale);
			const w = w0 * scale;
			const h = h0 * scale;
			return { x: right0 - w, y: y0, width: w, height: h };
		}
		case 'e': {
			const w = Math.max(minWidth, minHeight * aspect, w0 + dx);
			const h = w / aspect;
			return { x: x0, y: y0 - (h - h0) / 2, width: w, height: h };
		}
		case 'w': {
			const w = Math.max(minWidth, minHeight * aspect, w0 - dx);
			const h = w / aspect;
			return { x: right0 - w, y: y0 - (h - h0) / 2, width: w, height: h };
		}
		case 's': {
			const h = Math.max(minHeight, minWidth / aspect, h0 + dy);
			const w = h * aspect;
			return { x: x0 - (w - w0) / 2, y: y0, width: w, height: h };
		}
		case 'n': {
			const h = Math.max(minHeight, minWidth / aspect, h0 - dy);
			const w = h * aspect;
			return { x: x0 - (w - w0) / 2, y: bottom0 - h, width: w, height: h };
		}
	}
}
