import { hitTestShape } from '../src/lib/client/math';
import type { ShapeRecord } from '../src/lib/types';

async function testArrowAndLine() {
	console.log('--- Testing Arrow & Line Tools ---');

	// 1. Line shape validation
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

	// Test hit testing on the line segment
	const hitOnLine = hitTestShape({ x: 100, y: 100 }, lineShape);
	if (!hitOnLine) {
		throw new Error('Hit test failed on midpoint of line segment (100, 100)');
	}

	const hitFarOff = hitTestShape({ x: 300, y: 300 }, lineShape);
	if (hitFarOff) {
		throw new Error('Hit test should not match distant point (300, 300)');
	}

	// 2. Arrow shape validation
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

	if (!arrowShape.data?.isArrow) {
		throw new Error('Arrow shape must have data.isArrow = true');
	}

	const hitOnArrow = hitTestShape({ x: 200, y: 200 }, arrowShape);
	if (!hitOnArrow) {
		throw new Error('Hit test failed on horizontal arrow line (200, 200)');
	}

	console.log('PASSED: Arrow & Line tools math and hit-testing verified!\n');
}

testArrowAndLine().catch((err) => {
	console.error(err);
	process.exit(1);
});
