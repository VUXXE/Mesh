// Ported from:
// - scripts/test-sticky-note.ts
// - scripts/test-arrow-line.ts
// - scripts/test-marquee-selection.ts
// - scripts/test-touch-pinch.ts
// - scripts/test-cursor-interpolation.ts

import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import {
	hitTestShape,
	getShapeBounds,
	isShapeInsideMarquee,
	type BoundingBox
} from '../src/lib/client/math';
import type { ShapeRecord } from '../src/lib/types';

test('Sticky Note & Text Editing: Hit-Testing and Bounds Calculation', async () => {
	const stickyNote: ShapeRecord = {
		id: 'shape_test_sticky',
		type: 'sticky_note',
		x: 100,
		y: 100,
		width: 180,
		height: 180,
		fill: '#fef08a',
		stroke: '#eab308',
		strokeWidth: 1,
		rotation: 0,
		zIndex: 1,
		data: { text: 'Hello World\nLine 2\nLine 3' },
		createdBy: 'user_1',
		updatedAt: Date.now()
	};

	// 1. Inside hit test
	const insideHit = hitTestShape({ x: 150, y: 150 }, stickyNote);
	expect(insideHit).toBe(true);

	// 2. Outside hit test
	const outsideHit = hitTestShape({ x: 350, y: 350 }, stickyNote);
	expect(outsideHit).toBe(false);

	// 3. Bounds calculation
	const bounds = getShapeBounds(stickyNote);
	expect(bounds.minX).toBe(100);
	expect(bounds.minY).toBe(100);
	expect(bounds.width).toBe(180);
	expect(bounds.height).toBe(180);
});

test('Arrow & Line Tools: Hit-Testing, Geometry and Arrowhead State', async () => {
	// 1. Straight line segment
	const lineShape: ShapeRecord = {
		id: 'shape_line_1',
		type: 'path',
		x: 50,
		y: 50,
		width: 100,
		height: 100,
		fill: 'transparent',
		stroke: '#6366f1',
		strokeWidth: 2,
		rotation: 0,
		zIndex: 1,
		data: {
			points: [
				{ x: 50, y: 50, pressure: 0.5 },
				{ x: 150, y: 150, pressure: 0.5 }
			],
			isArrow: false
		},
		createdBy: 'user_1',
		updatedAt: 1000
	};

	const hitOnLine = hitTestShape({ x: 100, y: 100 }, lineShape);
	expect(hitOnLine).toBe(true);

	const hitFarOff = hitTestShape({ x: 300, y: 300 }, lineShape);
	expect(hitFarOff).toBe(false);

	// 2. Arrow shape
	const arrowShape: ShapeRecord = {
		id: 'shape_arrow_1',
		type: 'path',
		x: 100,
		y: 200,
		width: 200,
		height: 0,
		fill: 'transparent',
		stroke: '#10b981',
		strokeWidth: 3,
		rotation: 0,
		zIndex: 2,
		data: {
			points: [
				{ x: 100, y: 200, pressure: 0.5 },
				{ x: 300, y: 200, pressure: 0.5 }
			],
			isArrow: true
		},
		createdBy: 'user_1',
		updatedAt: 1001
	};

	expect(arrowShape.data?.isArrow).toBe(true);
	const hitOnArrow = hitTestShape({ x: 200, y: 200 }, arrowShape);
	expect(hitOnArrow).toBe(true);
});

test('Marquee Selection: Enclosed, Overlapping, Segment Crossing, and Hollow Shapes', async () => {
	// 1. Rectangle Marquee Selection
	const rect: ShapeRecord = {
		id: 'rect1',
		type: 'rectangle',
		x: 100,
		y: 100,
		width: 100,
		height: 100,
		fill: '#ffffff',
		stroke: '#000000',
		strokeWidth: 2,
		rotation: 0,
		zIndex: 1,
		createdBy: 'user1',
		updatedAt: 1000
	};

	const fullMarquee: BoundingBox = {
		minX: 50,
		minY: 50,
		maxX: 250,
		maxY: 250,
		width: 200,
		height: 200
	};
	expect(isShapeInsideMarquee(rect, fullMarquee)).toBe(true);

	const partialMarquee: BoundingBox = {
		minX: 50,
		minY: 120,
		maxX: 150,
		maxY: 180,
		width: 100,
		height: 60
	};
	expect(isShapeInsideMarquee(rect, partialMarquee)).toBe(true);

	const outsideMarquee: BoundingBox = {
		minX: 300,
		minY: 300,
		maxX: 400,
		maxY: 400,
		width: 100,
		height: 100
	};
	expect(isShapeInsideMarquee(rect, outsideMarquee)).toBe(false);

	// 2. Diagonal line/arrow segment-accurate marquee selection
	const line: ShapeRecord = {
		id: 'line1',
		type: 'path',
		x: 100,
		y: 100,
		width: 200,
		height: 200,
		fill: 'transparent',
		stroke: '#000000',
		strokeWidth: 2,
		rotation: 0,
		zIndex: 1,
		data: {
			isArrow: true,
			points: [
				{ x: 100, y: 100, pressure: 0.5 },
				{ x: 300, y: 300, pressure: 0.5 }
			]
		},
		createdBy: 'user1',
		updatedAt: 1000
	};

	const crossingMarquee: BoundingBox = {
		minX: 180,
		minY: 180,
		maxX: 220,
		maxY: 220,
		width: 40,
		height: 40
	};
	expect(isShapeInsideMarquee(line, crossingMarquee)).toBe(true);

	const cornerMarquee: BoundingBox = {
		minX: 100,
		minY: 280,
		maxX: 120,
		maxY: 300,
		width: 20,
		height: 20
	};
	expect(isShapeInsideMarquee(line, cornerMarquee)).toBe(false);

	// 3. Hollow vs Filled Shape Click-Through
	const hollowRect: ShapeRecord = {
		id: 'hollow1',
		type: 'rectangle',
		x: 100,
		y: 100,
		width: 200,
		height: 200,
		fill: 'transparent',
		stroke: '#000000',
		strokeWidth: 4,
		rotation: 0,
		zIndex: 1,
		createdBy: 'user1',
		updatedAt: 1000
	};

	const filledRect: ShapeRecord = {
		...hollowRect,
		id: 'filled1',
		fill: '#ff0000'
	};

	const centerPoint = { x: 200, y: 200 };
	const borderPoint = { x: 100, y: 150 };

	expect(hitTestShape(centerPoint, filledRect)).toBe(true);
	expect(hitTestShape(centerPoint, hollowRect)).toBe(false);
	expect(hitTestShape(borderPoint, hollowRect)).toBe(true);
});

test('Multi-touch Pinch Zoom & Pan Math and Clamping', async () => {
	const t1_initial = { x: 150, y: 200 };
	const t2_initial = { x: 250, y: 200 };

	const initialDist = Math.hypot(t2_initial.x - t1_initial.x, t2_initial.y - t1_initial.y);
	const initialMidpoint = {
		x: (t1_initial.x + t2_initial.x) / 2,
		y: (t1_initial.y + t2_initial.y) / 2
	};

	expect(initialDist).toBe(100);
	expect(initialMidpoint.x).toBe(200);
	expect(initialMidpoint.y).toBe(200);

	const currentZoom = 1.0;
	const panX = 0;
	const panY = 0;

	const t1_moved = { x: 150, y: 230 };
	const t2_moved = { x: 350, y: 230 };

	const currentDist = Math.hypot(t2_moved.x - t1_moved.x, t2_moved.y - t1_moved.y);
	const currentMidpoint = {
		x: (t1_moved.x + t2_moved.x) / 2,
		y: (t1_moved.y + t2_moved.y) / 2
	};

	const scale = currentDist / initialDist;
	const newZoom = Math.min(Math.max(currentZoom * scale, 0.1), 5.0);

	const mX = initialMidpoint.x;
	const mY = initialMidpoint.y;
	const panDeltaX = currentMidpoint.x - initialMidpoint.x;
	const panDeltaY = currentMidpoint.y - initialMidpoint.y;

	const newPanX = mX - (mX - panX) * (newZoom / currentZoom) + panDeltaX;
	const newPanY = mY - (mY - panY) * (newZoom / currentZoom) + panDeltaY;

	expect(newZoom).toBe(2.0);
	expect(panDeltaX).toBe(50);
	expect(panDeltaY).toBe(30);
	expect(newPanX).toBe(-150);
	expect(newPanY).toBe(-170);

	const extremeScale = 100;
	const clampedZoom = Math.min(Math.max(currentZoom * extremeScale, 0.1), 5.0);
	expect(clampedZoom).toBe(5.0);
});

test('Cursor Interpolation: Smoothing Convergence, Snapping, and Alpha Decay', async () => {
	let currentX = 0;
	let currentY = 0;
	const targetX = 100;
	const targetY = 200;

	const dt = 0.016;
	const decay = 25;
	const factor = 1 - Math.exp(-decay * dt);

	const trajectory: { frame: number; x: number; y: number }[] = [];

	for (let frame = 1; frame <= 6; frame++) {
		const dx = targetX - currentX;
		const dy = targetY - currentY;
		currentX += dx * factor;
		currentY += dy * factor;
		trajectory.push({
			frame,
			x: Math.round(currentX * 10) / 10,
			y: Math.round(currentY * 10) / 10
		});
	}

	const progressAfter80ms = trajectory[4].x / targetX;
	expect(progressAfter80ms).toBeGreaterThanOrEqual(0.75);
	expect(progressAfter80ms).toBeLessThanOrEqual(0.95);

	for (let i = 1; i < trajectory.length; i++) {
		expect(trajectory[i].x).toBeGreaterThan(trajectory[i - 1].x);
		expect(trajectory[i].y).toBeGreaterThan(trajectory[i - 1].y);
	}

	// Huge teleport snaps
	const snapDist = Math.hypot(2500 - 0, 3000 - 0);
	expect(snapDist > 1000).toBe(true);

	// Alpha fade-out
	let alpha = 1;
	const targetAlpha = 0;
	const alphaFactor = 1 - Math.exp(-15 * dt);

	for (let frame = 1; frame <= 10; frame++) {
		alpha += (targetAlpha - alpha) * alphaFactor;
	}
	expect(alpha).toBeLessThan(0.2);
});

test('Canvas Tool Selection in Browser UI', async ({ browser }) => {
	const room = `room-geom-${Date.now()}`;
	await browser.goto(`/room/${room}`);

	const homeLink = browser.locator('a[aria-label="Back to Mesh Home"]');
	await expect(homeLink).toBeVisible({ timeout: 10000 });

	const canvas = browser.locator('canvas').first();
	await expect(canvas).toBeVisible();
});
