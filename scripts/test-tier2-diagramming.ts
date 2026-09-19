// Polyfill environment for testing in Bun
if (typeof (globalThis as any).$state === 'undefined') {
	(globalThis as any).$state = (init: any) => init;
}

if (typeof (globalThis as any).window === 'undefined') {
	(globalThis as any).window = {
		innerWidth: 1920,
		innerHeight: 1080,
		devicePixelRatio: 1,
		addEventListener: () => {},
		removeEventListener: () => {}
	};
}

if (typeof (globalThis as any).document === 'undefined') {
	(globalThis as any).document = {
		createElement: () => createMockCanvas(),
		body: {
			appendChild: () => {},
			removeChild: () => {}
		}
	};
}

function createMockCanvas(): any {
	const mockCtx = {
		scale: () => {},
		save: () => {},
		restore: () => {},
		clearRect: () => {},
		fillRect: () => {},
		strokeRect: () => {},
		beginPath: () => {},
		stroke: () => {},
		fill: () => {},
		ellipse: () => {},
		rect: () => {},
		roundRect: () => {},
		clip: () => {},
		fillText: () => {},
		measureText: (text: string) => ({ width: text.length * 10 }),
		setLineDash: () => {},
		translate: () => {},
		moveTo: () => {},
		lineTo: () => {},
		closePath: () => {},
		arc: () => {}
	};

	return {
		width: 1920,
		height: 1080,
		style: {},
		getContext: () => mockCtx,
		setPointerCapture: () => {},
		releasePointerCapture: () => {}
	};
}

import {
	findNearestAnchor,
	getShapeAnchors,
	hitTestShape,
	isPointInsidePolygon
} from '../src/lib/client/math';
import { exportToSvg } from '../src/lib/client/canvas-export';
import { CanvasEngine } from '../src/lib/client/canvas-engine';
import { HistoryManager } from '../src/lib/client/history.svelte';
import type { ShapeRecord } from '../src/lib/types';

function createDiamondShape(id: string, x = 100, y = 100, width = 100, height = 100): ShapeRecord {
	const points = [
		{ x: x + width / 2, y },
		{ x: x + width, y: y + height / 2 },
		{ x: x + width / 2, y: y + height },
		{ x, y: y + height / 2 },
		{ x: x + width / 2, y }
	];
	return {
		id,
		type: 'path',
		x,
		y,
		width,
		height,
		fill: '#1e293b',
		stroke: '#6366f1',
		strokeWidth: 2,
		rotation: 0,
		zIndex: 1,
		data: { isDiamond: true, points, text: 'Decision?' },
		createdBy: 'user_1',
		updatedAt: 1000
	};
}

function createRectShape(id: string, x = 300, y = 100, width = 120, height = 80): ShapeRecord {
	return {
		id,
		type: 'rectangle',
		x,
		y,
		width,
		height,
		fill: '#0f172a',
		stroke: '#10b981',
		strokeWidth: 2,
		rotation: 0,
		zIndex: 2,
		data: { text: 'Process A' },
		createdBy: 'user_1',
		updatedAt: 1000
	};
}

async function runTier2Tests() {
	console.log('=== Running Tier 2 Diagramming Primitives Tests ===\n');

	// 1. Test isPointInsidePolygon & Diamond Hit-Testing
	console.log('1. Testing Diamond Polygon Hit-Testing...');
	const diamond = createDiamondShape('diamond_1', 100, 100, 100, 100);

	// Center (150, 150) should be INSIDE diamond
	const centerHit = hitTestShape({ x: 150, y: 150 }, diamond);
	if (!centerHit) throw new Error('Center of diamond should be a hit');

	// Corner of bounding box (105, 105) is OUTSIDE diamond polygon
	const cornerHit = hitTestShape({ x: 105, y: 105 }, diamond);
	if (cornerHit) throw new Error('Top-left corner of diamond bounding box should NOT be a hit');

	// Far point (50, 50) is completely outside
	const outsideHit = hitTestShape({ x: 50, y: 50 }, diamond);
	if (outsideHit) throw new Error('Point (50, 50) should NOT hit diamond');

	console.log('  ✓ Diamond polygon hit-testing matches diamond geometry correctly\n');

	// 2. Test getShapeAnchors
	console.log('2. Testing getShapeAnchors for shapes...');
	const rect = createRectShape('rect_1', 300, 100, 100, 80);
	const rectAnchors = getShapeAnchors(rect);

	if (rectAnchors.length !== 4) throw new Error('Expected 4 anchors for rectangle');
	const topA = rectAnchors.find((a) => a.side === 'top')!;
	const rightA = rectAnchors.find((a) => a.side === 'right')!;
	const bottomA = rectAnchors.find((a) => a.side === 'bottom')!;
	const leftA = rectAnchors.find((a) => a.side === 'left')!;

	if (topA.x !== 350 || topA.y !== 100)
		throw new Error(`Top anchor wrong: ${JSON.stringify(topA)}`);
	if (rightA.x !== 400 || rightA.y !== 140)
		throw new Error(`Right anchor wrong: ${JSON.stringify(rightA)}`);
	if (bottomA.x !== 350 || bottomA.y !== 180)
		throw new Error(`Bottom anchor wrong: ${JSON.stringify(bottomA)}`);
	if (leftA.x !== 300 || leftA.y !== 140)
		throw new Error(`Left anchor wrong: ${JSON.stringify(leftA)}`);

	console.log('  ✓ getShapeAnchors computes cardinal midpoints correctly\n');

	// 3. Test findNearestAnchor
	console.log('3. Testing findNearestAnchor snapping...');
	const shapes = [rect, diamond];

	// Point near right anchor of rect (400, 140)
	const nearestRight = findNearestAnchor({ x: 405, y: 142 }, shapes, undefined, 20);
	if (!nearestRight || nearestRight.shapeId !== 'rect_1' || nearestRight.side !== 'right') {
		throw new Error(`Failed to snap to rect right anchor: ${JSON.stringify(nearestRight)}`);
	}

	// Point too far from any anchor (> 20px)
	const tooFar = findNearestAnchor({ x: 500, y: 500 }, shapes, undefined, 20);
	if (tooFar !== null) throw new Error('Expected no anchor found for far point');

	console.log('  ✓ findNearestAnchor correctly identifies nearest anchor within maxDistance\n');

	// 4. Test SVG Export with Diamond and Centered Text
	console.log('4. Testing SVG Export with Diamond and Shape Labels...');
	let svgBlob: Blob | null = null;
	exportToSvg(new Map(shapes.map((s) => [s.id, s])), '#09090b', 'test.svg', (content) => {
		svgBlob = content as Blob;
	});
	const svgOutput = await (svgBlob as any).text();

	if (!svgOutput.includes('<polygon points=')) {
		throw new Error('SVG should export diamond as <polygon>');
	}
	if (!svgOutput.includes('Decision?')) {
		throw new Error('SVG should include centered text "Decision?" for diamond');
	}
	if (!svgOutput.includes('Process A')) {
		throw new Error('SVG should include centered text "Process A" for rectangle');
	}
	if (!svgOutput.includes('text-anchor="middle"')) {
		throw new Error('SVG should render centered text with text-anchor="middle"');
	}

	console.log('  ✓ SVG export contains diamond polygon and centered shape text\n');

	// 5. Test Smart Connectors in CanvasEngine
	console.log('5. Testing CanvasEngine with Smart Arrow Connectors...');
	const staticCanvas = createMockCanvas();
	const overlayCanvas = createMockCanvas();
	const engine = new CanvasEngine(staticCanvas, overlayCanvas);

	const shapeA = createDiamondShape('diamond_a', 100, 100, 100, 100);
	const shapeB = createRectShape('rect_b', 300, 100, 100, 80);

	// Arrow connecting shapeA (right: 200, 150) to shapeB (left: 300, 140)
	const arrow: ShapeRecord = {
		id: 'arrow_1',
		type: 'path',
		x: 200,
		y: 140,
		width: 100,
		height: 10,
		fill: 'transparent',
		stroke: '#f4f4f5',
		strokeWidth: 2,
		rotation: 0,
		zIndex: 3,
		data: {
			isArrow: true,
			points: [
				{ x: 200, y: 150 },
				{ x: 300, y: 140 }
			],
			startAnchor: { shapeId: 'diamond_a', side: 'right' },
			endAnchor: { shapeId: 'rect_b', side: 'left' }
		},
		createdBy: 'user_1',
		updatedAt: 1000
	};

	const shapeMap = new Map<string, ShapeRecord>([
		['diamond_a', shapeA],
		['rect_b', shapeB],
		['arrow_1', arrow]
	]);

	const history = new HistoryManager();
	engine.onActionRecorded = (action) => history.push(action);
	engine.setShapes(shapeMap);

	// Select diamond_a and drag it by dx = 50, dy = 30
	engine.setSelectedIds(['diamond_a']);

	// Trigger pointerdown on diamond_a
	// We call interactions through engine pointer events
	engine.handlePointerDown({
		clientX: 150,
		clientY: 150,
		pointerId: 1,
		shiftKey: false
	} as any);

	// Move pointer
	engine.handlePointerMove({
		clientX: 200,
		clientY: 180,
		pointerId: 1
	} as any);

	// Shape A should have moved
	const updatedA = engine.getShape('diamond_a')!;
	if (updatedA.x !== 150 || updatedA.y !== 130) {
		throw new Error(`Shape A did not move as expected: x=${updatedA.x}, y=${updatedA.y}`);
	}

	// Arrow start endpoint should have automatically updated to follow Shape A's right anchor!
	const updatedArrow = engine.getShape('arrow_1')!;
	const startPt = updatedArrow.data?.points?.[0];
	const endPt = updatedArrow.data?.points?.[1];

	// New diamond_a right anchor: x = 150 + 100 = 250, y = 130 + 50 = 180
	if (startPt.x !== 250 || startPt.y !== 180) {
		throw new Error(
			`Connected arrow start point did not follow shape A: got (${startPt.x}, ${startPt.y}), expected (250, 180)`
		);
	}
	// End point should remain anchored to Shape B (300, 140)
	if (endPt.x !== 300 || endPt.y !== 140) {
		throw new Error(
			`Connected arrow end point should stay on shape B: got (${endPt.x}, ${endPt.y}), expected (300, 140)`
		);
	}

	// Release pointer
	engine.handlePointerUp({
		clientX: 200,
		clientY: 180,
		pointerId: 1
	} as any);

	console.log('  ✓ Arrow endpoints dynamically track moving shapes in real-time\n');

	// 6. Test Undo of Shape Drag with Connected Arrow
	console.log('6. Testing Undo/Redo of Shape Drag with Connected Arrows...');
	const applyUpsert = (shapes: ShapeRecord[]) => {
		for (const s of shapes) {
			engine.updateShape(s);
		}
	};
	const applyDelete = (ids: string[]) => {
		for (const id of ids) {
			engine.deleteShapeById(id);
		}
	};
	const applyClear = () => {};

	history.undo(applyUpsert, applyDelete, applyClear);

	const undoneA = engine.getShape('diamond_a')!;
	const undoneArrow = engine.getShape('arrow_1')!;

	if (undoneA.x !== 100 || undoneA.y !== 100) {
		throw new Error(`Undo failed for Shape A: x=${undoneA.x}, y=${undoneA.y}`);
	}
	if (undoneArrow.data?.points?.[0].x !== 200 || undoneArrow.data?.points?.[0].y !== 150) {
		throw new Error(
			`Undo failed for connected arrow: start point is (${undoneArrow.data?.points?.[0].x}, ${undoneArrow.data?.points?.[0].y})`
		);
	}

	console.log('  ✓ Undo properly restores both moved shape and connected arrow geometry\n');

	// Redo
	history.redo(applyUpsert, applyDelete, applyClear);
	const redoneA = engine.getShape('diamond_a')!;
	const redoneArrow = engine.getShape('arrow_1')!;
	if (redoneA.x !== 150 || redoneA.y !== 130) {
		throw new Error(`Redo failed for Shape A: x=${redoneA.x}`);
	}
	if (redoneArrow.data?.points?.[0].x !== 250 || redoneArrow.data?.points?.[0].y !== 180) {
		throw new Error(`Redo failed for connected arrow`);
	}

	console.log('  ✓ Redo properly restores moved shape and connected arrow geometry\n');

	console.log('=== All Tier 2 Diagramming Primitives Tests Passed! ===\n');
}

runTier2Tests().catch((err) => {
	console.error('Test failed:', err);
	process.exit(1);
});
