// Polyfill environment for CanvasEngine testing in Bun
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
		getContext: () => mockCtx
	};
}

import {
	CanvasEngine,
	cloneAndOffsetShape,
	generateShapeId
} from '../src/lib/client/canvas-engine';
import type { ShapeRecord } from '../src/lib/types';
import type { HistoryAction } from '../src/lib/client/history.svelte';

function createMockShape(
	id: string,
	type: ShapeRecord['type'] = 'rectangle',
	x = 100,
	y = 100,
	zIndex = 1
): ShapeRecord {
	return {
		id,
		type,
		x,
		y,
		width: 120,
		height: 80,
		fill: 'transparent',
		stroke: '#f4f4f5',
		strokeWidth: 2,
		rotation: 0,
		zIndex,
		data:
			type === 'path'
				? {
						points: [
							{ x: 100, y: 100 },
							{ x: 150, y: 150 }
						]
					}
				: undefined,
		createdBy: 'user_1',
		updatedAt: 1000
	};
}

async function runTier1Tests() {
	console.log('=== Running Tier 1 Editing Ergonomics Tests ===\n');

	// --- 1. Test cloneAndOffsetShape ---
	console.log('1. Testing cloneAndOffsetShape...');
	const rect1 = createMockShape('rect_1', 'rectangle', 50, 60, 2);
	const clonedRect = cloneAndOffsetShape(rect1, 20, 30, 'cloned_1', 10, 5000);
	if (clonedRect.id !== 'cloned_1' || clonedRect.x !== 70 || clonedRect.y !== 90) {
		throw new Error('cloneAndOffsetShape failed to offset rectangle coordinates');
	}
	if (clonedRect.zIndex !== 10 || clonedRect.updatedAt !== 5000) {
		throw new Error('cloneAndOffsetShape failed to update zIndex or updatedAt');
	}

	const path1 = createMockShape('path_1', 'path', 100, 100, 3);
	const clonedPath = cloneAndOffsetShape(path1, 25, 35, 'cloned_path', 11, 5001);
	if (clonedPath.x !== 125 || clonedPath.y !== 135) {
		throw new Error('cloneAndOffsetShape failed to offset path base coordinates');
	}
	const points = clonedPath.data?.points;
	if (
		!points ||
		points[0].x !== 125 ||
		points[0].y !== 135 ||
		points[1].x !== 175 ||
		points[1].y !== 185
	) {
		throw new Error('cloneAndOffsetShape failed to offset individual path points');
	}

	// --- 2. Setup CanvasEngine ---
	const staticCanvas = createMockCanvas();
	const overlayCanvas = createMockCanvas();
	const engine = new CanvasEngine(staticCanvas, overlayCanvas);

	let recordedActions: HistoryAction[] = [];
	let mutatedShapes: ShapeRecord[] = [];
	let deletedShapeIds: string[] = [];

	engine.onActionRecorded = (action) => recordedActions.push(action);
	engine.onShapesMutated = (shapes) => mutatedShapes.push(...shapes);
	engine.onShapesDeleted = (ids) => deletedShapeIds.push(...ids);

	const sA = createMockShape('shape_A', 'rectangle', 10, 10, 1);
	const sB = createMockShape('shape_B', 'rectangle', 50, 50, 2);
	const sC = createMockShape('shape_C', 'rectangle', 100, 100, 3);

	const initialMap = new Map<string, ShapeRecord>([
		['shape_A', sA],
		['shape_B', sB],
		['shape_C', sC]
	]);
	engine.setShapes(initialMap);

	// --- 3. Test Select All ---
	console.log('2. Testing selectAll()...');
	engine.selectAll();
	if (engine.selectedIds.length !== 3) {
		throw new Error(`Expected 3 selected shapes from selectAll, got ${engine.selectedIds.length}`);
	}
	if (
		!engine.selectedIds.includes('shape_A') ||
		!engine.selectedIds.includes('shape_B') ||
		!engine.selectedIds.includes('shape_C')
	) {
		throw new Error('selectAll did not include all shape IDs');
	}

	// --- 4. Test Copy and Paste ---
	console.log('3. Testing copySelected() and paste()...');
	recordedActions = [];
	mutatedShapes = [];
	engine.setSelectedIds(['shape_A', 'shape_B']);
	const copySuccess = engine.copySelected();
	if (!copySuccess || !engine.hasClipboard()) {
		throw new Error('copySelected failed or clipboard is empty');
	}
	if (engine.getClipboard().length !== 2) {
		throw new Error(`Expected 2 shapes in clipboard, got ${engine.getClipboard().length}`);
	}

	// Paste 1
	const pasted1 = engine.pasteShapes(engine.getClipboard());
	if (pasted1.length !== 2) {
		throw new Error('pasteShapes failed to return 2 new shapes');
	}
	if (pasted1[0].x !== sA.x + 20 || pasted1[0].y !== sA.y + 20) {
		throw new Error(`Expected pasted shape_A at (30, 30), got (${pasted1[0].x}, ${pasted1[0].y})`);
	}
	if (engine.selectedIds.length !== 2 || engine.selectedIds[0] !== pasted1[0].id) {
		throw new Error('pasteShapes should automatically select the newly pasted shapes');
	}

	// Check history action
	const lastAction = recordedActions[recordedActions.length - 1];
	if (!lastAction || lastAction.type !== 'batch_create' || lastAction.shapes.length !== 2) {
		throw new Error('pasteShapes must record a batch_create action in history');
	}

	// Paste 2 (cascading offset)
	const pasted2 = engine.pasteShapes(engine.getClipboard());
	if (pasted2[0].x !== sA.x + 40 || pasted2[0].y !== sA.y + 40) {
		throw new Error(
			`Sequential paste must cascade offset: expected (50, 50), got (${pasted2[0].x}, ${pasted2[0].y})`
		);
	}

	// --- 5. Test Duplicate ---
	console.log('4. Testing duplicateSelected()...');
	recordedActions = [];
	mutatedShapes = [];
	engine.setSelectedIds(['shape_C']);
	const duplicated = engine.duplicateSelected();
	if (duplicated.length !== 1) {
		throw new Error('duplicateSelected failed to return 1 shape');
	}
	if (duplicated[0].x !== sC.x + 20 || duplicated[0].y !== sC.y + 20) {
		throw new Error(
			`Expected duplicated shape_C offset by +20px, got (${duplicated[0].x}, ${duplicated[0].y})`
		);
	}
	if (engine.selectedIds[0] !== duplicated[0].id) {
		throw new Error('duplicateSelected should select the newly duplicated shape');
	}
	const dupAction = recordedActions[recordedActions.length - 1];
	if (!dupAction || dupAction.type !== 'batch_create') {
		throw new Error('duplicateSelected must record a batch_create action');
	}

	// --- 6. Test Cut ---
	console.log('5. Testing cutSelected()...');
	recordedActions = [];
	deletedShapeIds = [];
	engine.setSelectedIds([duplicated[0].id]);
	const cutSuccess = engine.cutSelected();
	if (!cutSuccess) {
		throw new Error('cutSelected returned false');
	}
	if (engine.getShape(duplicated[0].id)) {
		throw new Error('cutSelected should have removed the shape from canvas');
	}
	if (engine.getClipboard().length !== 1 || engine.getClipboard()[0].id !== duplicated[0].id) {
		throw new Error('cutSelected should populate clipboard with the cut shape');
	}

	// --- 7. Test Z-Index Layering: Bring to Front & Send to Back ---
	console.log('6. Testing bringToFront() and sendToBack()...');
	// Reset to known clean set
	const shape1 = createMockShape('z_1', 'rectangle', 0, 0, 10);
	const shape2 = createMockShape('z_2', 'rectangle', 0, 0, 20);
	const shape3 = createMockShape('z_3', 'rectangle', 0, 0, 30);
	engine.setShapes(
		new Map([
			['z_1', shape1],
			['z_2', shape2],
			['z_3', shape3]
		])
	);

	// Select z_1 and bring to front
	engine.setSelectedIds(['z_1']);
	recordedActions = [];
	const btfOk = engine.bringToFront();
	if (!btfOk) {
		throw new Error('bringToFront should succeed on bottom shape');
	}
	const z1After = engine.getShape('z_1')!;
	if (z1After.zIndex <= 30) {
		throw new Error(`bringToFront failed: expected zIndex > 30, got ${z1After.zIndex}`);
	}
	if (engine.bringToFront()) {
		throw new Error('bringToFront should return false when shape is already at front');
	}

	// Select z_1 and send to back
	const stbOk = engine.sendToBack();
	if (!stbOk) {
		throw new Error('sendToBack should succeed on top shape');
	}
	const z1Back = engine.getShape('z_1')!;
	const z2Current = engine.getShape('z_2')!;
	if (z1Back.zIndex >= z2Current.zIndex) {
		throw new Error(
			`sendToBack failed: expected zIndex < ${z2Current.zIndex}, got ${z1Back.zIndex}`
		);
	}
	if (engine.sendToBack()) {
		throw new Error('sendToBack should return false when shape is already at back');
	}

	// --- 8. Test Step Forward (bringForward) & Step Backward (sendBackward) ---
	console.log('7. Testing bringForward() and sendBackward()...');
	// Shapes in order: z_1 (10), z_2 (20), z_3 (30)
	engine.setShapes(
		new Map([
			['z_1', createMockShape('z_1', 'rectangle', 0, 0, 10)],
			['z_2', createMockShape('z_2', 'rectangle', 0, 0, 20)],
			['z_3', createMockShape('z_3', 'rectangle', 0, 0, 30)]
		])
	);

	// Step z_1 forward past z_2
	engine.setSelectedIds(['z_1']);
	const bfOk = engine.bringForward();
	if (!bfOk) {
		throw new Error('bringForward failed to swap z_1 with z_2');
	}
	const z1Step1 = engine.getShape('z_1')!;
	const z2Step1 = engine.getShape('z_2')!;
	if (z1Step1.zIndex <= z2Step1.zIndex) {
		throw new Error(
			`bringForward failed: expected z_1 (${z1Step1.zIndex}) > z_2 (${z2Step1.zIndex})`
		);
	}

	// Step z_1 backward past z_2
	const sbOk = engine.sendBackward();
	if (!sbOk) {
		throw new Error('sendBackward failed to swap z_1 back behind z_2');
	}
	const z1Step2 = engine.getShape('z_1')!;
	const z2Step2 = engine.getShape('z_2')!;
	if (z1Step2.zIndex >= z2Step2.zIndex) {
		throw new Error(
			`sendBackward failed: expected z_1 (${z1Step2.zIndex}) < z_2 (${z2Step2.zIndex})`
		);
	}

	// Trying to send backward from the bottom should be a no-op
	if (engine.sendBackward()) {
		throw new Error('sendBackward should return false when shape is already at the bottom');
	}

	console.log('PASSED: All Tier 1 Editing Ergonomics tests succeeded!\n');
}

runTier1Tests().catch((err) => {
	console.error('FAILED:', err);
	process.exit(1);
});
