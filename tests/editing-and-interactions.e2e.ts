// Ported from:
// - scripts/test-tier1-editing.ts
// - scripts/test-history.ts
// - scripts/test-native-paste.ts
// - scripts/test-font-picker.ts
// - scripts/test-keyboard-shortcuts.ts

import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import {
	CanvasEngine,
	cloneAndOffsetShape,
	FONT_FAMILIES,
	FONT_SIZES,
	getFontFamilyCss,
	getFontFamilySvg
} from '../src/lib/client/canvas-engine';
import { HistoryManager, type HistoryAction } from '../src/lib/client/history.svelte';
import { SHORTCUT_GROUPS } from '../src/lib/client/shortcuts';
import type { ShapeRecord } from '../src/lib/types';

// Polyfills for CanvasEngine in Node runner
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
		},
		documentElement: {
			classList: {
				contains: () => false
			}
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
		arc: () => {},
		font: '',
		fillStyle: '',
		strokeStyle: '',
		lineWidth: 1,
		textBaseline: 'alphabetic'
	};

	return {
		width: 1920,
		height: 1080,
		style: {},
		getContext: () => mockCtx,
		toDataURL: () => 'data:image/png;base64,mock',
		setPointerCapture: () => {},
		releasePointerCapture: () => {}
	};
}

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

test('Tier 1 Editing Ergonomics: Clone, Select All, Copy/Paste, Duplicate, Cut, Z-Index', async () => {
	// 1. cloneAndOffsetShape
	const rect1 = createMockShape('rect_1', 'rectangle', 50, 60, 2);
	const clonedRect = cloneAndOffsetShape(rect1, 20, 30, 'cloned_1', 10, 5000);
	expect(clonedRect.id).toBe('cloned_1');
	expect(clonedRect.x).toBe(70);
	expect(clonedRect.y).toBe(90);
	expect(clonedRect.zIndex).toBe(10);
	expect(clonedRect.updatedAt).toBe(5000);

	const path1 = createMockShape('path_1', 'path', 100, 100, 3);
	const clonedPath = cloneAndOffsetShape(path1, 25, 35, 'cloned_path', 11, 5001);
	expect(clonedPath.x).toBe(125);
	expect(clonedPath.y).toBe(135);
	const points = clonedPath.data?.points;
	expect(points).toBeDefined();
	expect(points![0].x).toBe(125);
	expect(points![0].y).toBe(135);
	expect(points![1].x).toBe(175);
	expect(points![1].y).toBe(185);

	// 2. Setup CanvasEngine
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

	engine.setShapes(
		new Map<string, ShapeRecord>([
			['shape_A', sA],
			['shape_B', sB],
			['shape_C', sC]
		])
	);

	// 3. Select All
	engine.selectAll();
	expect(engine.selectedIds.length).toBe(3);
	expect(engine.selectedIds).toContain('shape_A');
	expect(engine.selectedIds).toContain('shape_B');
	expect(engine.selectedIds).toContain('shape_C');

	// 4. Copy and Paste
	recordedActions = [];
	engine.setSelectedIds(['shape_A', 'shape_B']);
	const copySuccess = engine.copySelected();
	expect(copySuccess).toBe(true);
	expect(engine.hasClipboard()).toBe(true);
	expect(engine.getClipboard().length).toBe(2);

	const pasted1 = engine.pasteShapes(engine.getClipboard());
	expect(pasted1.length).toBe(2);
	expect(pasted1[0].x).toBe(sA.x + 20);
	expect(pasted1[0].y).toBe(sA.y + 20);
	expect(engine.selectedIds).toContain(pasted1[0].id);

	const lastAction = recordedActions[recordedActions.length - 1];
	expect(lastAction?.type).toBe('batch_create');

	// Cascading offset on second paste
	const pasted2 = engine.pasteShapes(engine.getClipboard());
	expect(pasted2[0].x).toBe(sA.x + 40);
	expect(pasted2[0].y).toBe(sA.y + 40);

	// 5. Duplicate
	recordedActions = [];
	engine.setSelectedIds(['shape_C']);
	const duplicated = engine.duplicateSelected();
	expect(duplicated.length).toBe(1);
	expect(duplicated[0].x).toBe(sC.x + 20);
	expect(duplicated[0].y).toBe(sC.y + 20);
	expect(engine.selectedIds[0]).toBe(duplicated[0].id);
	expect(recordedActions[recordedActions.length - 1]?.type).toBe('batch_create');

	// 6. Cut
	engine.setSelectedIds([duplicated[0].id]);
	const cutSuccess = engine.cutSelected();
	expect(cutSuccess).toBe(true);
	expect(engine.getShape(duplicated[0].id)).toBeUndefined();
	expect(engine.getClipboard().length).toBe(1);

	// 7. Z-Index Layering: bringToFront & sendToBack
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

	engine.setSelectedIds(['z_1']);
	expect(engine.bringToFront()).toBe(true);
	expect(engine.getShape('z_1')!.zIndex).toBeGreaterThan(30);
	expect(engine.bringToFront()).toBe(false);

	expect(engine.sendToBack()).toBe(true);
	expect(engine.getShape('z_1')!.zIndex).toBeLessThan(engine.getShape('z_2')!.zIndex);
	expect(engine.sendToBack()).toBe(false);

	// 8. Step Forward & Step Backward
	engine.setShapes(
		new Map([
			['z_1', createMockShape('z_1', 'rectangle', 0, 0, 10)],
			['z_2', createMockShape('z_2', 'rectangle', 0, 0, 20)],
			['z_3', createMockShape('z_3', 'rectangle', 0, 0, 30)]
		])
	);
	engine.setSelectedIds(['z_1']);
	expect(engine.bringForward()).toBe(true);
	expect(engine.getShape('z_1')!.zIndex).toBeGreaterThan(engine.getShape('z_2')!.zIndex);

	expect(engine.sendBackward()).toBe(true);
	expect(engine.getShape('z_1')!.zIndex).toBeLessThan(engine.getShape('z_2')!.zIndex);
	expect(engine.sendBackward()).toBe(false);
});

test('History Manager: Undo/Redo for Create, Modify, Delete, and Batch Operations', async () => {
	const history = new HistoryManager();
	expect(history.canUndo).toBe(false);
	expect(history.canRedo).toBe(false);

	const localShapes = new Map<string, ShapeRecord>();
	const upsert = (shapes: ShapeRecord[]) => {
		for (const s of shapes) localShapes.set(s.id, s);
	};
	const del = (ids: string[]) => {
		for (const id of ids) localShapes.delete(id);
	};
	const clear = () => localShapes.clear();

	// 1. Create and Undo/Redo
	const s1 = createMockShape('shape_1', 'rectangle', 10, 20);
	upsert([s1]);
	history.push({ type: 'create', shape: s1 });
	expect(history.canUndo).toBe(true);
	expect(history.canRedo).toBe(false);

	history.undo(upsert, del, clear);
	expect(localShapes.has('shape_1')).toBe(false);
	expect(history.canRedo).toBe(true);

	history.redo(upsert, del, clear);
	expect(localShapes.has('shape_1')).toBe(true);

	// 2. Modify and Undo/Redo
	const s1Modified = { ...s1, x: 200, y: 300, updatedAt: 2000 };
	upsert([s1Modified]);
	history.push({ type: 'modify', before: [s1], after: [s1Modified] });

	history.undo(upsert, del, clear);
	const restoredBefore = localShapes.get('shape_1');
	expect(restoredBefore?.x).toBe(10);
	expect(restoredBefore?.y).toBe(20);
	expect(restoredBefore!.updatedAt).toBeGreaterThan(2000);

	history.redo(upsert, del, clear);
	const restoredAfter = localShapes.get('shape_1');
	expect(restoredAfter?.x).toBe(200);
	expect(restoredAfter?.y).toBe(300);

	// 3. Delete and Undo/Redo
	del(['shape_1']);
	history.push({ type: 'delete', shapes: [s1Modified] });

	history.undo(upsert, del, clear);
	expect(localShapes.has('shape_1')).toBe(true);

	history.redo(upsert, del, clear);
	expect(localShapes.has('shape_1')).toBe(false);

	// 4. Batch Create and Undo/Redo
	const s2 = createMockShape('shape_2', 'rectangle', 50, 50);
	const s3 = createMockShape('shape_3', 'rectangle', 80, 80);
	upsert([s2, s3]);
	history.push({ type: 'batch_create', shapes: [s2, s3] });

	history.undo(upsert, del, clear);
	expect(localShapes.has('shape_2')).toBe(false);
	expect(localShapes.has('shape_3')).toBe(false);

	history.redo(upsert, del, clear);
	expect(localShapes.has('shape_2')).toBe(true);
	expect(localShapes.has('shape_3')).toBe(true);
	expect(localShapes.get('shape_2')!.updatedAt).toBeGreaterThan(s2.updatedAt);
});

test('Native Clipboard & Plain Text Paste Handling', async () => {
	const staticCanvas = createMockCanvas();
	const overlayCanvas = createMockCanvas();
	const engine = new CanvasEngine(staticCanvas, overlayCanvas);

	// 1. In-memory clipboard priority
	let readTextCalled = false;
	try {
		Object.defineProperty(globalThis.navigator, 'clipboard', {
			value: {
				readText: async () => {
					readTextCalled = true;
					return '';
				},
				writeText: async () => {}
			},
			configurable: true,
			writable: true
		});
	} catch {
		// Ignore if navigator is frozen
	}

	const s1 = createMockShape('rect_test', 'rectangle', 100, 100);
	engine.setShapes(new Map([['rect_test', s1]]));
	engine.setSelectedIds(['rect_test']);
	engine.copySelected();

	const pasted = await engine.paste();
	expect(readTextCalled).toBe(false);
	expect(pasted.length).toBe(1);
	expect(pasted[0].id).not.toBe('rect_test');

	// 2. pastePlainText creates text shape
	const plainText = 'Architecture Plan\n1. Database\n2. WebSocket';
	const textShape = engine.pastePlainText(plainText);
	expect(textShape).toBeDefined();
	expect(textShape?.type).toBe('text');
	expect(textShape?.data?.text).toBe(plainText);
	expect(engine.selectedIds).toContain(textShape?.id);

	// 3. Whitespace-only returns null
	const emptyShape = engine.pastePlainText('   \n  ');
	expect(emptyShape).toBeNull();
});

test('Font Family and Font Size Customization and Text Bounds', async () => {
	// 1. Constants
	expect(FONT_FAMILIES.sans).toContain('sans-serif');
	expect(FONT_FAMILIES.serif).toContain('serif');
	expect(FONT_FAMILIES.mono).toContain('monospace');

	const expectedSizes = [14, 18, 28, 40];
	expect(FONT_SIZES.map((s) => s.value)).toEqual(expectedSizes);
	expect(getFontFamilyCss('mono')).toBe(FONT_FAMILIES.mono);
	expect(getFontFamilySvg('mono')).not.toContain('"');

	// 2. Engine defaults & callbacks
	const staticCanvas = createMockCanvas();
	const overlayCanvas = createMockCanvas();
	const engine = new CanvasEngine(staticCanvas, overlayCanvas);

	expect(engine.fontFamily).toBe('sans');
	expect(engine.fontSize).toBe(18);

	let changedFamily = '';
	let changedSize = 0;
	engine.onFontFamilyChanged = (f) => {
		changedFamily = f;
	};
	engine.onFontSizeChanged = (s) => {
		changedSize = s;
	};

	engine.setFontFamily('serif');
	expect(engine.fontFamily).toBe('serif');
	expect(changedFamily).toBe('serif');

	engine.setFontSize(28);
	expect(engine.fontSize).toBe(28);
	expect(changedSize).toBe(28);

	// 3. Text shape selection & mutation
	const textShape: ShapeRecord = {
		id: 'text_1',
		type: 'text',
		x: 100,
		y: 100,
		width: 140,
		height: 32,
		fill: 'transparent',
		stroke: '#f4f4f5',
		strokeWidth: 1,
		rotation: 0,
		zIndex: 1,
		data: { text: 'Hello World', fontSize: 18, fontFamily: 'sans' },
		createdBy: 'user_1',
		updatedAt: 1000
	};
	engine.setShapes(new Map([['text_1', textShape]]));

	let recordedAction: any = null;
	let mutatedShapes: ShapeRecord[] = [];
	engine.onActionRecorded = (a) => {
		recordedAction = a;
	};
	engine.onShapesMutated = (s) => {
		mutatedShapes = s;
	};

	engine.setSelectedIds(['text_1']);
	engine.setFontFamily('mono');
	expect(engine.getShape('text_1')?.data?.fontFamily).toBe('mono');
	expect(recordedAction?.type).toBe('modify');
	expect(mutatedShapes[0]?.data?.fontFamily).toBe('mono');

	engine.setFontSize(40);
	expect(engine.getShape('text_1')?.data?.fontSize).toBe(40);

	// 4. calculateTextBounds
	const bounds = engine.calculateTextBounds('Line 1\nLine 2 is longer', 28, 'mono');
	expect(bounds.width).toBeGreaterThan(0);
	expect(bounds.height).toBeGreaterThan(0);
});

test('Keyboard Shortcuts: Catalog, Viewport Zoom, and Shape Nudging', async () => {
	// 1. Shortcut groups catalog
	expect(SHORTCUT_GROUPS.length).toBeGreaterThan(0);
	const categories = SHORTCUT_GROUPS.map((g) => g.name);
	expect(categories).toContain('Tools');
	expect(categories).toContain('Canvas & Viewport');
	expect(categories).toContain('Selection & History');
	expect(categories).toContain('Arrangement');
	expect(categories).toContain('Editing');

	// 2. Viewport zoom methods
	const staticCanvas = createMockCanvas();
	const overlayCanvas = createMockCanvas();
	const engine = new CanvasEngine(staticCanvas, overlayCanvas);

	expect(engine.viewport.zoom).toBe(1);

	let viewportNotified = false;
	engine.addViewportListener(() => {
		viewportNotified = true;
	});

	engine.zoomIn();
	expect(Math.abs(engine.viewport.zoom - 1.2)).toBeLessThan(0.001);
	expect(viewportNotified).toBe(true);

	engine.zoomOut();
	expect(Math.abs(engine.viewport.zoom - 1.0)).toBeLessThan(0.001);

	// Clamping
	for (let i = 0; i < 20; i++) engine.zoomIn();
	expect(engine.viewport.zoom).toBeLessThanOrEqual(5.0);

	for (let i = 0; i < 40; i++) engine.zoomOut();
	expect(engine.viewport.zoom).toBeGreaterThanOrEqual(0.1);

	engine.resetZoom();
	expect(engine.viewport.zoom).toBe(1);
	expect(engine.viewport.panX).toBe(0);
	expect(engine.viewport.panY).toBe(0);

	// 3. Nudging precision
	const rectShape = createMockShape('rect_1', 'rectangle', 100, 200);
	engine.setShapes(new Map([['rect_1', rectShape]]));

	let recordedAction: any = null;
	engine.onActionRecorded = (a) => {
		recordedAction = a;
	};

	engine.setSelectedIds(['rect_1']);
	engine.nudgeSelected(1, -2);

	const updated = engine.getShape('rect_1');
	expect(updated?.x).toBe(101);
	expect(updated?.y).toBe(198);
	expect(recordedAction?.type).toBe('modify');
});

test('Keyboard Shortcuts Modal in Browser UI', async ({ browser }) => {
	const room = `room-shortcuts-${Date.now()}`;
	await browser.goto(`/room/${room}`);

	const homeLink = browser.locator('a[aria-label="Back to Mesh Home"]');
	await expect(homeLink).toBeVisible({ timeout: 10000 });

	// Press '?' to toggle shortcuts modal
	await browser.keyboard.press('?');

	const modal = browser.locator('[role="dialog"]');
	await expect(modal).toBeVisible({ timeout: 5000 });

	// Press Escape to close
	await browser.keyboard.press('Escape');
	await expect(modal).not.toBeVisible();
});
