import { CanvasEngine } from '../src/lib/client/canvas-engine';
import { SHORTCUT_GROUPS } from '../src/lib/client/shortcuts';
import type { HistoryAction } from '../src/lib/client/history.svelte';
import type { ShapeRecord } from '../src/lib/types';
import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('🧪 Testing Keyboard Shortcuts & Canvas Viewport/Nudge Methods...\n');

// Mock 2D context for headless Canvas testing
class MockCanvasRenderingContext2D {
	calls: string[] = [];
	font = '';
	fillStyle = '';
	strokeStyle = '';
	lineWidth = 1;

	save() {
		this.calls.push('save');
	}
	restore() {
		this.calls.push('restore');
	}
	beginPath() {
		this.calls.push('beginPath');
	}
	closePath() {
		this.calls.push('closePath');
	}
	moveTo(x: number, y: number) {
		this.calls.push(`moveTo(${x},${y})`);
	}
	lineTo(x: number, y: number) {
		this.calls.push(`lineTo(${x},${y})`);
	}
	stroke() {
		this.calls.push('stroke');
	}
	fill() {
		this.calls.push('fill');
	}
	rect(x: number, y: number, w: number, h: number) {
		this.calls.push(`rect(${x},${y},${w},${h})`);
	}
	roundRect() {}
	ellipse() {}
	fillRect() {}
	strokeRect() {}
	fillText() {}
	measureText(_text: string) {
		return { width: 10 } as TextMetrics;
	}
	clip() {}
	clearRect() {
		this.calls.push('clearRect');
	}
	translate(x: number, y: number) {
		this.calls.push(`translate(${x},${y})`);
	}
	scale(x: number, y: number) {
		this.calls.push(`scale(${x},${y})`);
	}
	setLineDash() {}
	arc() {}
}

class MockHTMLCanvasElement {
	width = 1920;
	height = 1080;
	style = { cursor: '' };
	private ctx = new MockCanvasRenderingContext2D();

	getContext(contextId: string): RenderingContext | null {
		if (contextId === '2d') {
			return this.ctx as unknown as CanvasRenderingContext2D;
		}
		return null;
	}
}

// Polyfill window/document for headless run
const globalObj = globalThis as unknown as {
	window?: {
		innerWidth: number;
		innerHeight: number;
		devicePixelRatio: number;
		addEventListener: () => void;
		removeEventListener: () => void;
	};
	document?: {
		documentElement: { classList: { contains: () => boolean } };
	};
};

if (typeof globalObj.window === 'undefined') {
	globalObj.window = {
		innerWidth: 1920,
		innerHeight: 1080,
		devicePixelRatio: 1,
		addEventListener: () => {},
		removeEventListener: () => {}
	};
}
if (typeof globalObj.document === 'undefined') {
	globalObj.document = {
		documentElement: { classList: { contains: () => false } }
	};
}

// 1. Test Shortcuts Catalog Structure
console.log('1. Testing Shortcuts Catalog (SHORTCUT_GROUPS)...');
{
	if (!SHORTCUT_GROUPS || SHORTCUT_GROUPS.length === 0) {
		throw new Error('SHORTCUT_GROUPS is empty or undefined');
	}

	const requiredCategories = [
		'Tools',
		'Canvas & Viewport',
		'Selection & History',
		'Arrangement',
		'Editing'
	];
	for (const cat of requiredCategories) {
		const found = SHORTCUT_GROUPS.find((g) => g.name === cat);
		if (!found) {
			throw new Error(`Missing expected shortcut category: "${cat}"`);
		}
		if (found.items.length === 0) {
			throw new Error(`Category "${cat}" has no items`);
		}
	}

	// Verify key shortcuts are listed in the catalog
	const allItems = SHORTCUT_GROUPS.flatMap((g) => g.items);
	const expectedShortcutLabels = [
		'Select',
		'Pan',
		'Zoom In',
		'Zoom Out',
		'Reset Zoom',
		'Nudge',
		'Large Nudge'
	];
	for (const label of expectedShortcutLabels) {
		const item = allItems.find((i) => i.label.toLowerCase().includes(label.toLowerCase()));
		if (!item) {
			throw new Error(`Expected shortcut with label containing "${label}" not found`);
		}
	}

	console.log(
		`  ✓ Found ${SHORTCUT_GROUPS.length} categories and ${allItems.length} registered shortcuts.`
	);
}

// 2. Test CanvasEngine Zoom Methods
console.log('\n2. Testing CanvasEngine Zooming (zoomIn, zoomOut, resetZoom)...');
{
	const staticCanvas = new MockHTMLCanvasElement() as unknown as HTMLCanvasElement;
	const overlayCanvas = new MockHTMLCanvasElement() as unknown as HTMLCanvasElement;
	const engine = new CanvasEngine(staticCanvas, overlayCanvas);

	// Initial zoom
	if (engine.viewport.zoom !== 1) {
		throw new Error(`Expected initial zoom to be 1, got ${engine.viewport.zoom}`);
	}

	// Zoom In
	let viewportNotified = false;
	engine.addViewportListener(() => {
		viewportNotified = true;
	});

	engine.zoomIn();
	if (Math.abs(engine.viewport.zoom - 1.2) > 0.001) {
		throw new Error(`Expected zoom to be 1.2 after zoomIn(), got ${engine.viewport.zoom}`);
	}
	if (!viewportNotified) {
		throw new Error('Viewport change listener was not called after zoomIn()');
	}

	// Zoom Out
	engine.zoomOut();
	if (Math.abs(engine.viewport.zoom - 1.0) > 0.001) {
		throw new Error(`Expected zoom to return to 1.0 after zoomOut(), got ${engine.viewport.zoom}`);
	}

	// Zoom clamp max: 5.0
	for (let i = 0; i < 20; i++) engine.zoomIn();
	if (engine.viewport.zoom > 5.0) {
		throw new Error(`Zoom exceeded maximum clamp 5.0: ${engine.viewport.zoom}`);
	}

	// Zoom clamp min: 0.1
	for (let i = 0; i < 40; i++) engine.zoomOut();
	if (engine.viewport.zoom < 0.1) {
		throw new Error(`Zoom fell below minimum clamp 0.1: ${engine.viewport.zoom}`);
	}

	// Reset Zoom
	engine.viewport.panX = 250;
	engine.viewport.panY = -120;
	engine.resetZoom();
	if (engine.viewport.zoom !== 1 || engine.viewport.panX !== 0 || engine.viewport.panY !== 0) {
		throw new Error(`resetZoom() failed to reset viewport: ${JSON.stringify(engine.viewport)}`);
	}

	console.log('  ✓ zoomIn, zoomOut, min/max clamping, and resetZoom verified.');
}

// 3. Test CanvasEngine Nudge Precision Method
console.log('\n3. Testing CanvasEngine Nudging (nudgeSelected)...');
{
	const staticCanvas = new MockHTMLCanvasElement() as unknown as HTMLCanvasElement;
	const overlayCanvas = new MockHTMLCanvasElement() as unknown as HTMLCanvasElement;
	const engine = new CanvasEngine(staticCanvas, overlayCanvas);

	const rectShape: ShapeRecord = {
		id: 'rect_1',
		type: 'rectangle',
		x: 100,
		y: 200,
		width: 150,
		height: 80,
		fill: 'transparent',
		stroke: '#ffffff',
		strokeWidth: 2,
		rotation: 0,
		zIndex: 1,
		createdBy: 'test',
		updatedAt: 100
	};

	const pathShape: ShapeRecord = {
		id: 'path_1',
		type: 'path',
		x: 50,
		y: 60,
		width: 40,
		height: 40,
		fill: 'transparent',
		stroke: '#ffffff',
		strokeWidth: 2,
		rotation: 0,
		zIndex: 2,
		createdBy: 'test',
		updatedAt: 100,
		data: {
			points: [
				{ x: 50, y: 60, pressure: 0.5 },
				{ x: 70, y: 80, pressure: 0.5 },
				{ x: 90, y: 100, pressure: 0.5 }
			]
		}
	};

	engine.setShape(rectShape.id, rectShape);
	engine.setShape(pathShape.id, pathShape);

	let mutatedRecords: ShapeRecord[] = [];
	engine.onShapesMutated = (shapes) => {
		mutatedRecords = shapes;
	};

	let recordedAction: HistoryAction | null = null;
	engine.onActionRecorded = (action) => {
		recordedAction = action;
	};

	// 3a. Nudge with nothing selected -> should be no-op
	engine.nudgeSelected(5, 5);
	if (mutatedRecords.length !== 0 || recordedAction !== null) {
		throw new Error('nudgeSelected with empty selection should be a no-op');
	}

	// 3b. Nudge with rect selected by 1px
	engine.setSelectedIds(['rect_1']);
	engine.nudgeSelected(1, -2);

	const updatedRect = engine.getShape('rect_1');
	if (!updatedRect || updatedRect.x !== 101 || updatedRect.y !== 198) {
		throw new Error(
			`Expected rect position (101, 198), got (${updatedRect?.x}, ${updatedRect?.y})`
		);
	}
	if (mutatedRecords.length !== 1 || mutatedRecords[0].id !== 'rect_1') {
		throw new Error('onShapesMutated was not called with updated rect');
	}
	if (!recordedAction || recordedAction.type !== 'modify') {
		throw new Error('History action modify was not recorded for nudge');
	}
	if (recordedAction.before[0].x !== 100 || recordedAction.after[0].x !== 101) {
		throw new Error('Recorded history before/after states do not match nudge deltas');
	}

	// 3c. Nudge path shape (verifying points offset)
	engine.setSelectedIds(['path_1']);
	engine.nudgeSelected(10, 10);

	const updatedPath = engine.getShape('path_1');
	if (!updatedPath || updatedPath.x !== 60 || updatedPath.y !== 70) {
		throw new Error(`Expected path position (60, 70), got (${updatedPath?.x}, ${updatedPath?.y})`);
	}
	const firstPoint = updatedPath.data?.points?.[0];
	if (!firstPoint || firstPoint.x !== 60 || firstPoint.y !== 70) {
		throw new Error(
			`Expected first path point to be (60, 70), got (${firstPoint?.x}, ${firstPoint?.y})`
		);
	}

	console.log('  ✓ nudgeSelected moves shapes, offsets path points, and records undo history.');
}

// 4. Test Key Handler Mappings in +page.svelte Source
console.log('\n4. Verifying Shortcut Event Handlers in +page.svelte...');
{
	const pageContent = readFileSync(
		resolve(__dirname, '../src/routes/room/[id]/+page.svelte'),
		'utf-8'
	);

	const expectedPatterns = [
		{
			name: 'Zoom In (+)',
			pattern: /isMod\s*&&\s*\(e\.key\s*===\s*'='\s*\|\|\s*e\.key\s*===\s*'\+'\)/
		},
		{
			name: 'Zoom Out (-)',
			pattern: /isMod\s*&&\s*\(e\.key\s*===\s*'-'\s*\|\|\s*e\.key\s*===\s*'_'\)/
		},
		{ name: 'Reset Zoom (0)', pattern: /isMod\s*&&\s*e\.key\s*===\s*'0'/ },
		{
			name: 'Shortcuts modal (?)',
			pattern: /e\.key\s*===\s*'\?'\s*\|\|\s*\(isMod\s*&&\s*e\.key\s*===\s*'\/'\)/
		},
		{
			name: 'Prevent Ctrl+S',
			pattern: /isMod\s*&&\s*\(e\.key\s*===\s*'s'\s*\|\|\s*e\.key\s*===\s*'S'\)/
		},
		{ name: 'Arrow key nudging', pattern: /nudgeSelected\(dx,\s*dy\)/ },
		{ name: 'Pan tool (H)', pattern: /e\.key\s*===\s*'h'\s*\|\|\s*e\.key\s*===\s*'H'/ },
		{ name: 'Number tools 1-9 & 0', pattern: /e\.key\s*===\s*'1'/ },
		{ name: 'Escape to deselect', pattern: /engine\?\.setSelectedIds\(\[\]\)/ },
		{ name: 'ShortcutsModal integration', pattern: /<ShortcutsModal/ }
	];

	for (const { name, pattern } of expectedPatterns) {
		if (!pattern.test(pageContent)) {
			throw new Error(`Missing expected pattern for "${name}" in +page.svelte`);
		}
	}

	console.log(
		`  ✓ All ${expectedPatterns.length} required handler patterns verified in +page.svelte.`
	);
}

console.log('\n🎉 ALL KEYBOARD SHORTCUTS TESTS PASSED!\n');
