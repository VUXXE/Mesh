import type { PathPoint, ShapeRecord } from '../types';

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

	if (shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'sticky_note') {
		return (
			point.x >= shape.x - hitPadding &&
			point.x <= shape.x + shape.width + hitPadding &&
			point.y >= shape.y - hitPadding &&
			point.y <= shape.y + shape.height + hitPadding
		);
	}

	if (shape.type === 'ellipse') {
		const rx = shape.width / 2;
		const ry = shape.height / 2;
		if (rx === 0 || ry === 0) return false;
		const cx = shape.x + rx;
		const cy = shape.y + ry;
		const normalizedX = (point.x - cx) / (rx + hitPadding);
		const normalizedY = (point.y - cy) / (ry + hitPadding);
		return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
	}

	if (shape.type === 'path') {
		const points: PathPoint[] = shape.data?.points ?? [];
		if (points.length < 2) return false;

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

/**
 * Checks if a shape is inside a marquee selection box.
 */
export function isShapeInsideMarquee(shape: ShapeRecord, marquee: BoundingBox): boolean {
	const b = getShapeBounds(shape);
	return (
		b.minX >= marquee.minX &&
		b.maxX <= marquee.maxX &&
		b.minY >= marquee.minY &&
		b.maxY <= marquee.maxY
	);
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
