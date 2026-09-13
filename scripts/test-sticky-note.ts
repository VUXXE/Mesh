import { hitTestShape, getShapeBounds } from '../src/lib/client/math';
import type { ShapeRecord } from '../src/lib/types';

console.log('--- Testing Sticky Note & Text Editing ---');

// 1. Verify hit testing on sticky note
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

const insideHit = hitTestShape({ x: 150, y: 150 }, stickyNote);
if (!insideHit) {
	console.error('FAILED: Point inside sticky note should hit test positive');
	process.exit(1);
}

const outsideHit = hitTestShape({ x: 350, y: 350 }, stickyNote);
if (outsideHit) {
	console.error('FAILED: Point outside sticky note should hit test negative');
	process.exit(1);
}

// 2. Verify bounds calculation
const bounds = getShapeBounds(stickyNote);
if (bounds.minX !== 100 || bounds.minY !== 100 || bounds.width !== 180 || bounds.height !== 180) {
	console.error('FAILED: Bounds mismatch for sticky note', bounds);
	process.exit(1);
}

console.log('PASSED: Sticky note bounds and hit-testing verified!');
