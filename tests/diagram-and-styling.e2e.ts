// Ported from:
// - scripts/test-tier2-diagramming.ts
// - scripts/test-diagram-mode.ts
// - scripts/test-excalidraw-styling.ts
// - scripts/test-grid-indicators.ts
// - scripts/test-grid-mode.ts
// - scripts/test-profile-editing.ts

import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	findNearestAnchor,
	getShapeAnchors,
	hitTestShape,
	calculateOrthogonalPath,
	calculateSnapAndGuides,
	getQuickAddButtons
} from '../src/lib/client/math';
import { parseMermaidToShapes } from '../src/lib/client/mermaid-parser';
import { exportToSvg } from '../src/lib/client/canvas-export';
import { drawShape, renderGrid } from '../src/lib/client/canvas-render';
import { CanvasEngine } from '../src/lib/client/canvas-engine';
import { HistoryManager } from '../src/lib/client/history.svelte';
import type { ShapeRecord } from '../src/lib/types';

// Polyfill environment for CanvasEngine in Node runner
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

test('Tier 2 Diagramming: Diamond Hit-Testing, Cardinal Anchors, Smart Connectors, and Undo/Redo', async () => {
	// 1. Diamond polygon hit-testing
	const diamond = createDiamondShape('diamond_1', 100, 100, 100, 100);
	expect(hitTestShape({ x: 150, y: 150 }, diamond)).toBe(true);
	expect(hitTestShape({ x: 105, y: 105 }, diamond)).toBe(false);
	expect(hitTestShape({ x: 50, y: 50 }, diamond)).toBe(false);

	// 2. getShapeAnchors
	const rect = createRectShape('rect_1', 300, 100, 100, 80);
	const rectAnchors = getShapeAnchors(rect);
	expect(rectAnchors.length).toBe(4);

	const topA = rectAnchors.find((a) => a.side === 'top')!;
	const rightA = rectAnchors.find((a) => a.side === 'right')!;
	const bottomA = rectAnchors.find((a) => a.side === 'bottom')!;
	const leftA = rectAnchors.find((a) => a.side === 'left')!;

	expect(topA.x).toBe(350);
	expect(topA.y).toBe(100);
	expect(rightA.x).toBe(400);
	expect(rightA.y).toBe(140);
	expect(bottomA.x).toBe(350);
	expect(bottomA.y).toBe(180);
	expect(leftA.x).toBe(300);
	expect(leftA.y).toBe(140);

	// 3. findNearestAnchor
	const shapes = [rect, diamond];
	const nearestRight = findNearestAnchor({ x: 405, y: 142 }, shapes, undefined, 20);
	expect(nearestRight?.shapeId).toBe('rect_1');
	expect(nearestRight?.side).toBe('right');

	const tooFar = findNearestAnchor({ x: 500, y: 500 }, shapes, undefined, 20);
	expect(tooFar).toBeNull();

	// 4. SVG export with Diamond and Centered Text
	let svgBlob: Blob | null = null;
	exportToSvg(new Map(shapes.map((s) => [s.id, s])), '#09090b', 'test.svg', (content) => {
		svgBlob = content as Blob;
	});
	const svgOutput = await svgBlob!.text();
	expect(svgOutput).toContain('<polygon points=');
	expect(svgOutput).toContain('Decision?');
	expect(svgOutput).toContain('Process A');
	expect(svgOutput).toContain('text-anchor="middle"');

	// 5. Smart Connectors in CanvasEngine
	const staticCanvas = createMockCanvas();
	const overlayCanvas = createMockCanvas();
	const engine = new CanvasEngine(staticCanvas, overlayCanvas);

	const shapeA = createDiamondShape('diamond_a', 100, 100, 100, 100);
	const shapeB = createRectShape('rect_b', 300, 100, 100, 80);
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

	const history = new HistoryManager();
	engine.onActionRecorded = (action) => history.push(action);
	engine.setShapes(
		new Map<string, ShapeRecord>([
			['diamond_a', shapeA],
			['rect_b', shapeB],
			['arrow_1', arrow]
		])
	);

	engine.setSelectedIds(['diamond_a']);
	engine.handlePointerDown({ clientX: 150, clientY: 150, pointerId: 1, shiftKey: false } as any);
	engine.handlePointerMove({ clientX: 200, clientY: 180, pointerId: 1 } as any);

	const updatedA = engine.getShape('diamond_a')!;
	expect(updatedA.x).toBe(150);
	expect(updatedA.y).toBe(130);

	const updatedArrow = engine.getShape('arrow_1')!;
	expect(updatedArrow.data?.points?.[0].x).toBe(250);
	expect(updatedArrow.data?.points?.[0].y).toBe(180);
	expect(updatedArrow.data?.points?.[1].x).toBe(300);
	expect(updatedArrow.data?.points?.[1].y).toBe(140);

	engine.handlePointerUp({ clientX: 200, clientY: 180, pointerId: 1 } as any);

	// 6. Undo/Redo connected drag
	const applyUpsert = (s: ShapeRecord[]) => {
		for (const item of s) engine.updateShape(item);
	};
	const applyDelete = (ids: string[]) => {
		for (const id of ids) engine.deleteShapeById(id);
	};
	const applyClear = () => {};

	history.undo(applyUpsert, applyDelete, applyClear);
	expect(engine.getShape('diamond_a')?.x).toBe(100);
	expect(engine.getShape('diamond_a')?.y).toBe(100);
	expect(engine.getShape('arrow_1')?.data?.points?.[0].x).toBe(200);
	expect(engine.getShape('arrow_1')?.data?.points?.[0].y).toBe(150);

	history.redo(applyUpsert, applyDelete, applyClear);
	expect(engine.getShape('diamond_a')?.x).toBe(150);
	expect(engine.getShape('arrow_1')?.data?.points?.[0].x).toBe(250);
});

test('Diagram Mode: Orthogonal Paths, Guides, Quick-Add, and Mermaid Parser', async () => {
	// 1. Orthogonal Path Calculation
	const start = { x: 100, y: 100 };
	const end = { x: 300, y: 200 };
	const path1 = calculateOrthogonalPath(start, end, 'right', 'left');

	expect(path1.length).toBeGreaterThanOrEqual(4);
	expect(path1[0].x).toBe(100);
	expect(path1[0].y).toBe(100);
	expect(path1[path1.length - 1].x).toBe(300);
	expect(path1[path1.length - 1].y).toBe(200);

	for (let i = 0; i < path1.length - 1; i++) {
		const isHorizontal = path1[i].y === path1[i + 1].y && path1[i].x !== path1[i + 1].x;
		const isVertical = path1[i].x === path1[i + 1].x && path1[i].y !== path1[i + 1].y;
		expect(isHorizontal || isVertical).toBe(true);
	}

	// 2. Alignment Guides & Snapping
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

	const draggedNearLeft = { minX: 203, minY: 400, maxX: 303, maxY: 460, width: 100, height: 60 };
	const resultLeft = calculateSnapAndGuides(
		draggedNearLeft,
		shapesMap.values(),
		new Set(['dragged_id']),
		6
	);
	expect(resultLeft.dx).toBe(-3);
	expect(resultLeft.guides.some((g) => g.type === 'vertical' && g.pos === 200)).toBe(true);

	// 3. Quick-Add Buttons Placement
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
	expect(buttons.length).toBe(4);
	const rightBtn = buttons.find((b) => b.side === 'right');
	expect(rightBtn?.x).toBe(100 + 120 + 24);
	expect(rightBtn?.y).toBe(100 + 40);

	// 4. Mermaid Flowchart Parser
	const mermaidCode = `
flowchart LR
    Client[Web Client] --> Gateway[API Gateway]
    Gateway --> Auth{Token Valid?}
    Auth -->|Yes| Service([Worker Service])
    Auth -->|No| Reject[401 Error]
    Service --> DB[(Database)]
`;
	const result = parseMermaidToShapes(mermaidCode, { x: 500, y: 500 }, 10);
	expect(result.error).toBeUndefined();
	expect(result.shapes.length).toBeGreaterThan(0);

	const nodes = result.shapes.filter((s) => s.data?.text && !s.data?.isArrow);
	const arrows = result.shapes.filter((s) => s.data?.isArrow);
	expect(nodes.length).toBe(6);
	expect(arrows.length).toBe(5);

	const diamondNode = nodes.find((n) => n.data?.text === 'Token Valid?');
	expect(diamondNode?.type).toBe('path');
	expect(diamondNode?.data?.isDiamond).toBe(true);

	const serviceEllipse = nodes.find((n) => n.data?.text === 'Worker Service');
	expect(serviceEllipse?.type).toBe('ellipse');

	const emptyResult = parseMermaidToShapes('   \n  %% comment only \n');
	expect(emptyResult.error).toBeDefined();
});

test('Excalidraw Styling Pack: SVG Hachure Patterns, Canvas 2D Rendering, and Schema Conformance', async () => {
	// 1. SVG Export with Hachure, Stroke Styles, Roundness, Opacity
	const shapes: ShapeRecord[] = [
		{
			id: 'rect_sharp_dashed_hachure',
			type: 'rectangle',
			x: 50,
			y: 50,
			width: 100,
			height: 80,
			fill: '#6366f1',
			stroke: '#f4f4f5',
			strokeWidth: 2,
			rotation: 0,
			zIndex: 1,
			data: {
				strokeStyle: 'dashed',
				fillStyle: 'hachure',
				roundness: 'sharp',
				opacity: 0.75
			},
			createdBy: 'user1',
			updatedAt: 1000
		},
		{
			id: 'rect_round_dotted_crosshatch',
			type: 'rectangle',
			x: 200,
			y: 50,
			width: 120,
			height: 90,
			fill: '#10b981',
			stroke: '#f4f4f5',
			strokeWidth: 3,
			rotation: 0,
			zIndex: 2,
			data: {
				strokeStyle: 'dotted',
				fillStyle: 'cross-hatch',
				roundness: 'round',
				opacity: 0.5
			},
			createdBy: 'user1',
			updatedAt: 1001
		}
	];

	const svg = await new Promise<string>((resolve) => {
		exportToSvg(new Map(shapes.map((s) => [s.id, s])), '#121214', 'test.svg', async (blob) => {
			resolve(await (blob as Blob).text());
		});
	});

	expect(svg).toContain('<defs>');
	expect(svg).toContain('id="pat-hachure-');
	expect(svg).toContain('id="pat-cross-hatch-');
	expect(svg).toContain('patternTransform="rotate(45 0 0)"');
	expect(svg).toContain('stroke-dasharray="8 6"');
	expect(svg).toContain('rx="0"');
	expect(svg).toContain('opacity="0.75"');
	expect(svg).toContain('rx="10"');
	expect(svg).toContain('opacity="0.5"');

	// 2. Canvas 2D Rendering with Mock Context
	let lineDashSet: number[] = [];
	let globalAlpha = 1;
	let roundRectRadius = -1;
	let clipCalled = false;
	let linesDrawn = 0;
	let capturedStrokeDash: number[] = [];
	let capturedAlpha = 1;

	const dashStack: number[][] = [];
	const alphaStack: number[] = [];

	const mockCtx = {
		save: () => {
			dashStack.push([...lineDashSet]);
			alphaStack.push(globalAlpha);
		},
		restore: () => {
			if (dashStack.length > 0) lineDashSet = dashStack.pop()!;
			if (alphaStack.length > 0) globalAlpha = alphaStack.pop()!;
		},
		beginPath: () => {},
		closePath: () => {},
		stroke: () => {
			capturedStrokeDash = [...lineDashSet];
			capturedAlpha = globalAlpha;
		},
		fill: () => {},
		clip: () => {
			clipCalled = true;
		},
		moveTo: () => {},
		lineTo: () => {
			linesDrawn++;
		},
		rect: () => {},
		ellipse: () => {},
		roundRect: (_x: number, _y: number, _w: number, _h: number, radii: number) => {
			roundRectRadius = radii;
		},
		setLineDash: (segments: number[]) => {
			lineDashSet = segments;
		},
		getLineDash: () => lineDashSet,
		set globalAlpha(val: number) {
			globalAlpha = val;
		},
		get globalAlpha() {
			return globalAlpha;
		},
		strokeStyle: '',
		fillStyle: '',
		lineWidth: 1,
		lineCap: '',
		lineJoin: '',
		font: '',
		textAlign: '',
		textBaseline: '',
		fillText: () => {}
	} as unknown as CanvasRenderingContext2D;

	drawShape(mockCtx, shapes[0], '#ffffff');
	expect(capturedAlpha).toBe(0.75);
	expect(capturedStrokeDash).toEqual([8, 6]);
	expect(roundRectRadius).toBe(0);

	// Round with hachure fill
	drawShape(mockCtx, shapes[1], '#ffffff');
	expect(roundRectRadius).toBe(10);
	expect(clipCalled).toBe(true);
	expect(linesDrawn).toBeGreaterThan(0);

	// 3. Schema JSON Roundtrip
	const serialized = JSON.stringify(shapes[0]);
	const parsed = JSON.parse(serialized);
	expect(parsed.data.strokeStyle).toBe('dashed');
	expect(parsed.data.fillStyle).toBe('hachure');
	expect(parsed.data.roundness).toBe('sharp');
	expect(parsed.data.opacity).toBe(0.75);
});

test('Grid Indicators and Settings Static Verification', async () => {
	const presenceBarPath = resolve(process.cwd(), 'src/lib/components/PresenceBar.svelte');
	const code = readFileSync(presenceBarPath, 'utf-8');

	expect(code).toContain(
		"gridMode === 'dots' ? 'Dots' : gridMode === 'lines' ? 'Lines' : 'Grid Off'"
	);
	expect(code).toContain('{#if snapToGrid}');
	expect(code).toContain('Snap</span>');
	expect(code).toMatch(/>Active\s*<\/span/);
	expect(code).toContain("{snapToGrid ? 'ON' : 'OFF'}");
	expect(code).toContain('gridHudMessage');
});

test('Grid Mode Rendering and Light Mode High-Contrast Contrast', async () => {
	class MockGridCanvasContext {
		calls: { method: string; args: any[] }[] = [];
		fillStyle = '';
		strokeStyle = '';
		lineWidth = 0;
		save() {
			this.calls.push({ method: 'save', args: [] });
		}
		restore() {
			this.calls.push({ method: 'restore', args: [] });
		}
		fillRect(x: number, y: number, w: number, h: number) {
			this.calls.push({ method: 'fillRect', args: [x, y, w, h] });
		}
		beginPath() {
			this.calls.push({ method: 'beginPath', args: [] });
		}
		moveTo(x: number, y: number) {
			this.calls.push({ method: 'moveTo', args: [x, y] });
		}
		lineTo(x: number, y: number) {
			this.calls.push({ method: 'lineTo', args: [x, y] });
		}
		stroke() {
			this.calls.push({ method: 'stroke', args: [] });
		}
	}

	// 1. Light mode dots contrast
	const ctxLight = new MockGridCanvasContext();
	renderGrid(ctxLight as any, 0, 0, 1, true, 800, 600, 'dots');
	expect(ctxLight.fillStyle).toBe('#a1a1aa');
	expect(ctxLight.calls.some((c) => c.method === 'fillRect')).toBe(true);

	// 2. Dark mode dots
	const ctxDark = new MockGridCanvasContext();
	renderGrid(ctxDark as any, 0, 0, 1, false, 800, 600, 'dots');
	expect(ctxDark.fillStyle).toBe('#2e2e33');

	// 3. Lines mode
	const ctxLines = new MockGridCanvasContext();
	renderGrid(ctxLines as any, 0, 0, 1, true, 800, 600, 'lines');
	expect(ctxLines.calls.some((c) => c.method === 'moveTo')).toBe(true);
	expect(ctxLines.calls.some((c) => c.method === 'stroke')).toBe(true);

	// 4. None mode
	const ctxNone = new MockGridCanvasContext();
	renderGrid(ctxNone as any, 0, 0, 1, true, 800, 600, 'none');
	expect(ctxNone.calls.length).toBe(0);

	// 5. Check layout.css and Toolbar.svelte
	const css = readFileSync(resolve(process.cwd(), 'src/routes/layout.css'), 'utf-8');
	expect(css).toContain('--grid-dot: #a1a1aa');

	const toolbar = readFileSync(
		resolve(process.cwd(), 'src/lib/components/Toolbar.svelte'),
		'utf-8'
	);
	expect(toolbar).toContain('border-black/40');
	expect(toolbar).toContain('dark:border-white/30');
});

test('Profile Editing: Presence Palette, Initials Preview, and Name Storage', async () => {
	const presenceBarPath = resolve(process.cwd(), 'src/lib/components/PresenceBar.svelte');
	const presenceBarCode = readFileSync(presenceBarPath, 'utf-8');

	expect(presenceBarCode).toContain('showProfileMenu');

	const expectedColors = [
		'#f87171',
		'#fb923c',
		'#facc15',
		'#4ade80',
		'#22d3ee',
		'#818cf8',
		'#c084fc',
		'#f472b6'
	];
	for (const color of expectedColors) {
		expect(presenceBarCode).toContain(color);
	}

	expect(presenceBarCode).toContain('Live cursor & presence');
	expect(presenceBarCode).toContain('profile-name-input');
	expect(presenceBarCode).toContain('onUpdateUserColor');

	const roomPagePath = resolve(process.cwd(), 'src/routes/room/[id]/+page.svelte');
	const roomPageCode = readFileSync(roomPagePath, 'utf-8');
	expect(roomPageCode).toContain('socket?.setUserColor(color)');
});

test('Diagram Mode & Presence Bar in Browser UI', async ({ browser }) => {
	const room = `room-diag-${Date.now()}`;
	await browser.goto(`/room/${room}`);

	const homeLink = browser.locator('a[aria-label="Back to Mesh Home"]');
	await expect(homeLink).toBeVisible({ timeout: 10000 });

	// Presence bar rendered with grid settings button
	const gridBtn = browser.locator('button[aria-label="Grid settings"]');
	await expect(gridBtn).toBeVisible({ timeout: 10000 });
});
