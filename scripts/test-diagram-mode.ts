import {
	calculateOrthogonalPath,
	calculateSnapAndGuides,
	getQuickAddButtons
} from '../src/lib/client/math';
import { parseMermaidToShapes } from '../src/lib/client/mermaid-parser';
import type { ShapeRecord } from '../src/lib/types';

function assert(condition: boolean, msg: string) {
	if (!condition) {
		console.error(`❌ ASSERTION FAILED: ${msg}`);
		process.exit(1);
	}
	console.log(`✅ PASS: ${msg}`);
}

console.log('🧪 Testing Diagram Mode: Orthogonal Paths, Guides, Quick-Add, and Mermaid Parser...');

// 1. Orthogonal Path Calculation Tests
console.log('\n--- 1. Testing Orthogonal (Elbow 90°) Path Calculation ---');
{
	// Test horizontal right-to-left connection (Z-step)
	const start = { x: 100, y: 100 };
	const end = { x: 300, y: 200 };
	const path1 = calculateOrthogonalPath(start, end, 'right', 'left');

	assert(path1.length >= 4, `Orthogonal Z-path has at least 4 waypoints (got ${path1.length})`);
	assert(path1[0].x === 100 && path1[0].y === 100, 'Starts at start anchor point');
	assert(
		path1[path1.length - 1].x === 300 && path1[path1.length - 1].y === 200,
		'Ends at end anchor point'
	);

	// Verify all segments are 90-degree orthogonal (each delta is either strictly horizontal or strictly vertical)
	for (let i = 0; i < path1.length - 1; i++) {
		const p1 = path1[i];
		const p2 = path1[i + 1];
		const isHorizontal = p1.y === p2.y && p1.x !== p2.x;
		const isVertical = p1.x === p2.x && p1.y !== p2.y;
		assert(
			isHorizontal || isVertical,
			`Segment ${i} -> ${i + 1} (${p1.x},${p1.y}) to (${p2.x},${p2.y}) is strictly orthogonal (horizontal=${isHorizontal}, vertical=${isVertical})`
		);
	}

	// Test vertical bottom-to-top connection
	const startV = { x: 200, y: 100 };
	const endV = { x: 400, y: 300 };
	const pathV = calculateOrthogonalPath(startV, endV, 'bottom', 'top');
	assert(pathV.length >= 4, `Vertical orthogonal path has at least 4 waypoints (got ${pathV.length})`);
	for (let i = 0; i < pathV.length - 1; i++) {
		const p1 = pathV[i];
		const p2 = pathV[i + 1];
		const isH = p1.y === p2.y;
		const isV = p1.x === p2.x;
		assert(isH || isV, `Vertical connection segment ${i} is strictly orthogonal`);
	}
}

// 2. Alignment Guides & Snapping Tests
console.log('\n--- 2. Testing Smart Alignment Guides & Snapping ---');
{
	const existingShape: ShapeRecord = {
		id: 'shape_1',
		type: 'rectangle',
		x: 200,
		y: 200,
		width: 100,
		height: 60,
		fill: 'transparent',
		stroke: '#fff',
		strokeWidth: 2,
		rotation: 0,
		zIndex: 1,
		createdBy: '',
		updatedAt: Date.now()
	};

	const shapesMap = new Map<string, ShapeRecord>([['shape_1', existingShape]]);

	// Dragged box near left edge of existing shape (200) within threshold (e.g. at 203)
	const draggedNearLeft = { minX: 203, minY: 400, maxX: 303, maxY: 460, width: 100, height: 60 };
	const resultLeft = calculateSnapAndGuides(draggedNearLeft, shapesMap.values(), new Set(['dragged_id']), 6);

	assert(resultLeft.dx === -3, `Snaps to left edge with dx = -3 (got ${resultLeft.dx})`);
	assert(
		resultLeft.guides.some((g) => g.type === 'vertical' && g.pos === 200),
		'Emits vertical alignment guide at x=200'
	);

	// Dragged box near center of existing shape (centerX = 250) within threshold (e.g. at 248)
	// Dragged box width = 80, minX = 208 => centerX = 248 (left=208, right=288 do not align with 200/300)
	const draggedNearCenter = { minX: 208, minY: 500, maxX: 288, maxY: 560, width: 80, height: 60 };
	const resultCenter = calculateSnapAndGuides(
		draggedNearCenter,
		shapesMap.values(),
		new Set(['dragged_id']),
		6
	);
	assert(resultCenter.dx === 2, `Snaps center-to-center with dx = 2 (got ${resultCenter.dx})`);
	assert(
		resultCenter.guides.some((g) => g.type === 'vertical' && g.pos === 250),
		'Emits vertical alignment guide at centerX=250'
	);
}

// 3. Quick-Add Buttons Placement Tests
console.log('\n--- 3. Testing Quick-Add Floating Handles ---');
{
	const rect: ShapeRecord = {
		id: 'rect_1',
		type: 'rectangle',
		x: 100,
		y: 100,
		width: 120,
		height: 80,
		fill: 'transparent',
		stroke: '#fff',
		strokeWidth: 2,
		rotation: 0,
		zIndex: 1,
		createdBy: '',
		updatedAt: Date.now()
	};

	const buttons = getQuickAddButtons(rect, 24);
	assert(buttons.length === 4, `Quick-add produces exactly 4 cardinal buttons (got ${buttons.length})`);

	const rightBtn = buttons.find((b) => b.side === 'right');
	const leftBtn = buttons.find((b) => b.side === 'left');
	const topBtn = buttons.find((b) => b.side === 'top');
	const bottomBtn = buttons.find((b) => b.side === 'bottom');

	assert(Boolean(rightBtn && leftBtn && topBtn && bottomBtn), 'All 4 sides present');
	assert(rightBtn!.x === 100 + 120 + 24, `Right button placed at distance 24 beyond right edge (${rightBtn!.x})`);
	assert(rightBtn!.y === 100 + 40, `Right button centered vertically (${rightBtn!.y})`);
	assert(leftBtn!.x === 100 - 24, `Left button placed at distance 24 beyond left edge (${leftBtn!.x})`);
	assert(bottomBtn!.y === 100 + 80 + 24, `Bottom button placed at distance 24 beyond bottom edge (${bottomBtn!.y})`);
}

// 4. Mermaid Flowchart Parser Tests
console.log('\n--- 4. Testing Mermaid Flowchart Parser (DAG Layout & Shape Generation) ---');
{
	const mermaidCode = `
flowchart LR
    Client[Web Client] --> Gateway[API Gateway]
    Gateway --> Auth{Token Valid?}
    Auth -->|Yes| Service([Worker Service])
    Auth -->|No| Reject[401 Error]
    Service --> DB[(Database)]
`;

	const result = parseMermaidToShapes(mermaidCode, { x: 500, y: 500 }, 10);
	assert(!result.error, `Parsed without syntax errors: ${result.error ?? 'OK'}`);
	assert(result.shapes.length > 0, `Generated ${result.shapes.length} shapes`);

	const nodes = result.shapes.filter((s) => s.data?.text && !s.data?.isArrow);
	const arrows = result.shapes.filter((s) => s.data?.isArrow);

	assert(nodes.length === 6, `Extracted 6 flowchart nodes (got ${nodes.length})`);
	assert(arrows.length === 5, `Extracted 5 connecting arrows (got ${arrows.length})`);

	// Verify shape types
	const diamond = nodes.find((n) => n.data?.text === 'Token Valid?');
	assert(Boolean(diamond && diamond.type === 'path' && diamond.data?.isDiamond), 'Auth diamond node correctly identified');

	const serviceEllipse = nodes.find((n) => n.data?.text === 'Worker Service');
	assert(Boolean(serviceEllipse && serviceEllipse.type === 'ellipse'), 'Service ([...]) node created as ellipse');

	const clientRect = nodes.find((n) => n.data?.text === 'Web Client');
	assert(Boolean(clientRect && clientRect.type === 'rectangle'), 'Client [...] node created as rectangle');

	// Verify all arrows have orthogonal routing and bindings
	for (const arrow of arrows) {
		assert(arrow.type === 'path', 'Arrow is path shape');
		assert(arrow.data?.routing === 'orthogonal', 'Arrow uses orthogonal routing');
		assert(Array.isArray(arrow.data?.points) && arrow.data.points.length >= 2, 'Arrow has valid points');
		assert(Boolean(arrow.data?.startAnchor && arrow.data?.endAnchor), 'Arrow has bound start and end anchors');
	}

	// Verify empty / invalid input handling
	const emptyResult = parseMermaidToShapes('   \n  %% comment only \n');
	assert(Boolean(emptyResult.error), 'Empty diagram returns descriptive error');
}

console.log('\n🎉 ALL DIAGRAM MODE TESTS PASSED SUCCESFULLY!\n');
