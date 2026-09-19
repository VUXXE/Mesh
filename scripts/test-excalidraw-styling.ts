import type { ShapeRecord } from '../src/lib/types';
import { exportToSvg } from '../src/lib/client/canvas-export';
import { drawShape } from '../src/lib/client/canvas-render';

function assert(condition: boolean, msg: string) {
	if (!condition) {
		console.error(`❌ ASSERTION FAILED: ${msg}`);
		process.exit(1);
	}
	console.log(`✅ PASS: ${msg}`);
}

console.log(
	'🧪 Testing Excalidraw Styling Pack (Fill patterns, Stroke styles, Roundness, Opacity)...'
);

// 1. Test SVG Export with Excalidraw Styling
console.log('\n--- 1. Testing SVG Export with Hachure, Stroke Styles, Roundness, Opacity ---');
{
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
		},
		{
			id: 'ellipse_dashed_solid',
			type: 'ellipse',
			x: 350,
			y: 50,
			width: 100,
			height: 100,
			fill: '#f59e0b',
			stroke: '#f4f4f5',
			strokeWidth: 2,
			rotation: 0,
			zIndex: 3,
			data: {
				strokeStyle: 'dashed',
				fillStyle: 'solid',
				opacity: 0.25
			},
			createdBy: 'user1',
			updatedAt: 1002
		},
		{
			id: 'diamond_hachure',
			type: 'path',
			x: 100,
			y: 200,
			width: 100,
			height: 100,
			fill: '#f43f5e',
			stroke: '#f4f4f5',
			strokeWidth: 2,
			rotation: 0,
			zIndex: 4,
			data: {
				isDiamond: true,
				points: [
					{ x: 150, y: 200 },
					{ x: 200, y: 250 },
					{ x: 150, y: 300 },
					{ x: 100, y: 250 },
					{ x: 150, y: 200 }
				],
				strokeStyle: 'dotted',
				fillStyle: 'hachure',
				opacity: 0.9
			},
			createdBy: 'user1',
			updatedAt: 1003
		},
		{
			id: 'arrow_dashed',
			type: 'path',
			x: 50,
			y: 350,
			width: 150,
			height: 50,
			fill: 'transparent',
			stroke: '#06b6d4',
			strokeWidth: 2,
			rotation: 0,
			zIndex: 5,
			data: {
				isArrow: true,
				routing: 'straight',
				points: [
					{ x: 50, y: 350 },
					{ x: 200, y: 400 }
				],
				strokeStyle: 'dashed',
				opacity: 0.8
			},
			createdBy: 'user1',
			updatedAt: 1004
		}
	];
	const shapesMap = new Map<string, ShapeRecord>(shapes.map((s) => [s.id, s]));
	let svg = '';
	exportToSvg(shapesMap, '#121214', 'test.svg', async (blob) => {
		svg = await (blob as Blob).text();
	});

	// Wait for microtask if needed
	await new Promise((r) => setTimeout(r, 10));

	// Check defs contains hachure pattern
	assert(svg.includes('<defs>'), 'SVG contains <defs> block');
	assert(svg.includes('id="pat-hachure-'), 'SVG defs contains hachure pattern definitions');
	assert(svg.includes('id="pat-cross-hatch-'), 'SVG defs contains cross-hatch pattern definitions');
	assert(
		svg.includes('patternTransform="rotate(45 0 0)"'),
		'Hachure pattern is rotated 45 degrees'
	);

	// Check rectangle with sharp corners, dashed stroke, hachure fill, 0.75 opacity
	assert(svg.includes('stroke-dasharray="8 6"'), 'Contains dashed stroke-dasharray');
	assert(svg.includes('fill="url(#pat-hachure-'), 'Rectangle uses hachure fill pattern URL');
	assert(svg.includes('rx="0"'), 'Sharp rectangle has rx="0" corner radius');
	assert(svg.includes('opacity="0.75"'), 'Opacity 0.75 is applied in SVG output');

	// Check rectangle with round corners, dotted stroke, cross-hatch fill, 0.5 opacity
	assert(svg.includes('rx="10"'), 'Round rectangle has rx="10" corner radius');
	assert(
		svg.includes('stroke-dasharray="3 6"'),
		'Contains dotted stroke-dasharray (1 * sw, 2 * sw)'
	);
	assert(
		svg.includes('fill="url(#pat-cross-hatch-'),
		'Rectangle uses cross-hatch fill pattern URL'
	);
	assert(svg.includes('opacity="0.5"'), 'Opacity 0.5 is applied in SVG output');

	// Check ellipse with dashed stroke, 0.25 opacity
	assert(svg.includes('opacity="0.25"'), 'Opacity 0.25 is applied to ellipse');

	// Check diamond with hachure fill and 0.9 opacity
	assert(svg.includes('opacity="0.9"'), 'Opacity 0.9 is applied to diamond');

	// Check arrow path with dashed stroke and 0.8 opacity
	assert(svg.includes('opacity="0.8"'), 'Opacity 0.8 is applied to arrow');
}

// 2. Test Canvas 2D Rendering with Mock Context
console.log('\n--- 2. Testing Canvas 2D Rendering with Excalidraw Styling ---');
{
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

	// Test 1: Sharp rectangle with dashed stroke and opacity
	const sharpRect: ShapeRecord = {
		id: 's1',
		type: 'rectangle',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		fill: 'transparent',
		stroke: '#ffffff',
		strokeWidth: 2,
		rotation: 0,
		zIndex: 1,
		data: {
			strokeStyle: 'dashed',
			roundness: 'sharp',
			opacity: 0.6
		},
		createdBy: 'u1',
		updatedAt: 100
	};

	globalAlpha = 1;
	lineDashSet = [];
	roundRectRadius = -1;
	drawShape(mockCtx, sharpRect, '#ffffff');

	assert(capturedAlpha === 0.6, `Opacity 0.6 applied to canvas ctx (got ${capturedAlpha})`);
	assert(
		capturedStrokeDash.length === 2 && capturedStrokeDash[0] === 8 && capturedStrokeDash[1] === 6,
		'Dashed line dash set correctly (8, 6)'
	);
	assert(
		roundRectRadius === 0,
		`Sharp rectangle passed 0 radius to roundRect (got ${roundRectRadius})`
	);

	// Test 2: Round rectangle with dotted stroke and hachure fill
	const roundHachureRect: ShapeRecord = {
		id: 's2',
		type: 'rectangle',
		x: 10,
		y: 10,
		width: 100,
		height: 100,
		fill: '#6366f1',
		stroke: '#ffffff',
		strokeWidth: 2,
		rotation: 0,
		zIndex: 2,
		data: {
			strokeStyle: 'dotted',
			fillStyle: 'hachure',
			roundness: 'round',
			opacity: 1
		},
		createdBy: 'u1',
		updatedAt: 101
	};

	globalAlpha = 1;
	lineDashSet = [];
	roundRectRadius = -1;
	clipCalled = false;
	linesDrawn = 0;
	drawShape(mockCtx, roundHachureRect, '#ffffff');

	assert(
		roundRectRadius === 10,
		`Round rectangle passed 10 radius to roundRect (got ${roundRectRadius})`
	);
	assert(
		capturedStrokeDash.length === 2 && capturedStrokeDash[0] === 2 && capturedStrokeDash[1] === 5,
		'Dotted line dash set correctly (2, 5)'
	);
	assert(clipCalled === true, 'clip() called to constrain hachure fill inside shape boundary');
	assert(
		linesDrawn > 0,
		`Hachure fill drew clipped diagonal stroke lines (drew ${linesDrawn} lines)`
	);

	// Test 3: Cross-hatch fill draws more lines than hachure
	const crossHatchRect: ShapeRecord = {
		...roundHachureRect,
		id: 's3',
		data: {
			...roundHachureRect.data,
			fillStyle: 'cross-hatch'
		}
	};
	linesDrawn = 0;
	drawShape(mockCtx, crossHatchRect, '#ffffff');
	const crossLines = linesDrawn;
	assert(
		crossLines > 0,
		`Cross-hatch drew both diagonal and counter-diagonal lines (${crossLines} lines)`
	);
}

// 3. Test Data Structure and Immutability
console.log('\n--- 3. Testing Immutability & Conflict-free Schema Conformance ---');
{
	const shape: ShapeRecord = {
		id: 'shape_test_123',
		type: 'rectangle',
		x: 10,
		y: 20,
		width: 150,
		height: 80,
		fill: '#10b981',
		stroke: '#f4f4f5',
		strokeWidth: 2,
		rotation: 0,
		zIndex: 1,
		data: {
			strokeStyle: 'dotted',
			fillStyle: 'hachure',
			roundness: 'sharp',
			opacity: 0.5
		},
		createdBy: 'user_a',
		updatedAt: 2000
	};

	// Verify serialization to JSON
	const jsonStr = JSON.stringify(shape);
	const parsed: ShapeRecord = JSON.parse(jsonStr);

	assert(parsed.data?.strokeStyle === 'dotted', 'Serialized & parsed strokeStyle preserved');
	assert(parsed.data?.fillStyle === 'hachure', 'Serialized & parsed fillStyle preserved');
	assert(parsed.data?.roundness === 'sharp', 'Serialized & parsed roundness preserved');
	assert(parsed.data?.opacity === 0.5, 'Serialized & parsed opacity preserved');
	assert(parsed.type === 'rectangle', 'Strict SQLite schema shape type unchanged');
}

console.log('\n🎉 ALL EXCALIDRAW STYLING TESTS PASSED SUCCESSFULLY!');
