import { isShapeInsideMarquee, hitTestShape, type BoundingBox } from '../src/lib/client/math';
import type { ShapeRecord } from '../src/lib/types';

console.log('=== Running Marquee Selection & Hit-Testing Tests ===');

// Test 1: Rectangle Selection with Marquee
{
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

	// 1a. Completely inside marquee
	const fullMarquee: BoundingBox = {
		minX: 50,
		minY: 50,
		maxX: 250,
		maxY: 250,
		width: 200,
		height: 200
	};
	if (!isShapeInsideMarquee(rect, fullMarquee)) {
		throw new Error('Test 1a failed: Fully enclosed rectangle should be selected');
	}

	// 1b. Partial overlap (intersection) - marquee covers only left half of rectangle
	const partialMarquee: BoundingBox = {
		minX: 50,
		minY: 120,
		maxX: 150,
		maxY: 180,
		width: 100,
		height: 60
	};
	if (!isShapeInsideMarquee(rect, partialMarquee)) {
		throw new Error('Test 1b failed: Intersecting rectangle should be selected');
	}

	// 1c. Completely outside
	const outsideMarquee: BoundingBox = {
		minX: 300,
		minY: 300,
		maxX: 400,
		maxY: 400,
		width: 100,
		height: 100
	};
	if (isShapeInsideMarquee(rect, outsideMarquee)) {
		throw new Error('Test 1c failed: Non-intersecting rectangle should NOT be selected');
	}

	console.log('Test 1 - Rectangle marquee selection (enclosed, overlapping, outside): PASSED');
}

// Test 2: Line & Arrow Marquee Selection (with segment precision)
{
	// Diagonal line from (100, 100) to (300, 300)
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

	// 2a. Marquee crossing the diagonal line at (200, 200)
	const crossingMarquee: BoundingBox = {
		minX: 180,
		minY: 180,
		maxX: 220,
		maxY: 220,
		width: 40,
		height: 40
	};
	if (!isShapeInsideMarquee(line, crossingMarquee)) {
		throw new Error('Test 2a failed: Marquee crossing line should select it');
	}

	// 2b. Marquee in the corner of the bounding box (100, 280) to (120, 300)
	// Overlaps AABB, but does NOT cross the actual diagonal line
	const cornerMarquee: BoundingBox = {
		minX: 100,
		minY: 280,
		maxX: 120,
		maxY: 300,
		width: 20,
		height: 20
	};
	if (isShapeInsideMarquee(line, cornerMarquee)) {
		throw new Error(
			'Test 2b failed: Marquee in empty corner of diagonal line should NOT select it'
		);
	}

	console.log('Test 2 - Diagonal line/arrow segment-accurate marquee selection: PASSED');
}

// Test 3: Hit-Testing for Hollow (Transparent) vs Filled Shapes
{
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

	// Clicking in the dead center (200, 200)
	const centerPoint = { x: 200, y: 200 };
	const borderPoint = { x: 100, y: 150 }; // On left border

	// Filled rect: center clicks should hit
	if (!hitTestShape(centerPoint, filledRect)) {
		throw new Error('Test 3a failed: Center of filled rect should be a hit');
	}

	// Hollow rect: center click should click through (NO hit)
	if (hitTestShape(centerPoint, hollowRect)) {
		throw new Error('Test 3b failed: Center of hollow rect should click through (no hit)');
	}

	// Hollow rect: border click should hit
	if (!hitTestShape(borderPoint, hollowRect)) {
		throw new Error('Test 3c failed: Border of hollow rect should be a hit');
	}

	console.log('Test 3 - Hollow shape click-through vs border hit-testing: PASSED');
}

console.log('=== All Marquee Selection Tests Passed Successfully! ===');
