import {
	FONT_FAMILIES,
	FONT_SIZES,
	getFontFamilyCss,
	getFontFamilySvg,
	calculateTextBounds,
	wrapText
} from '../src/lib/client/canvas-text';
import {
	drawArrowHead,
	drawPeerCursor,
	drawShape,
	renderGrid
} from '../src/lib/client/canvas-render';
import {
	escapeXml,
	computeShapesBounds,
	exportToSvg,
	exportToJson,
	importFromJson
} from '../src/lib/client/canvas-export';
import type { ShapeRecord, PeerPresence } from '../src/lib/types';

function createMockCtx(): any {
	const calls: string[] = [];
	return {
		calls,
		save: () => calls.push('save'),
		restore: () => calls.push('restore'),
		beginPath: () => calls.push('beginPath'),
		closePath: () => calls.push('closePath'),
		moveTo: (x: number, y: number) => calls.push(`moveTo(${x},${y})`),
		lineTo: (x: number, y: number) => calls.push(`lineTo(${x},${y})`),
		stroke: () => calls.push('stroke'),
		fill: () => calls.push('fill'),
		rect: (x: number, y: number, w: number, h: number) => calls.push(`rect(${x},${y},${w},${h})`),
		roundRect: (x: number, y: number, w: number, h: number, r: number) =>
			calls.push(`roundRect(${x},${y},${w},${h},${r})`),
		ellipse: () => calls.push('ellipse'),
		fillRect: (x: number, y: number, w: number, h: number) =>
			calls.push(`fillRect(${x},${y},${w},${h})`),
		strokeRect: (x: number, y: number, w: number, h: number) =>
			calls.push(`strokeRect(${x},${y},${w},${h})`),
		fillText: (text: string, x: number, y: number) => calls.push(`fillText("${text}",${x},${y})`),
		measureText: (text: string) => ({ width: text.length * 8 }),
		clip: () => calls.push('clip'),
		font: '',
		fillStyle: '',
		strokeStyle: '',
		lineWidth: 1,
		lineCap: 'butt',
		lineJoin: 'miter',
		textBaseline: 'alphabetic'
	};
}

async function runCanvasModuleTests() {
	console.log('=== Running Canvas Modularization Unit Tests ===');

	// 1. canvas-text tests
	console.log('1. Testing canvas-text...');
	if (!getFontFamilyCss('mono').includes('JetBrains Mono')) {
		throw new Error('getFontFamilyCss mono lookup failed');
	}
	if (!getFontFamilySvg('mono').includes("'JetBrains Mono'")) {
		throw new Error('getFontFamilySvg single-quote replacement failed');
	}

	const bounds = calculateTextBounds('Hello\nWorld!', 18, 'sans');
	if (bounds.width <= 0 || bounds.height <= 0) {
		throw new Error('calculateTextBounds returned invalid bounds');
	}

	const mockCtx = createMockCtx();
	const wrapped = wrapText(mockCtx, 'The quick brown fox jumps over the lazy dog', 80);
	if (wrapped.length <= 1) {
		throw new Error(
			`wrapText failed to break long line into multiple lines: ${JSON.stringify(wrapped)}`
		);
	}
	console.log('   ✓ canvas-text verified');

	// 2. canvas-render tests
	console.log('2. Testing canvas-render...');
	const renderCtx = createMockCtx();
	drawArrowHead(renderCtx, 0, 0, 100, 100, '#6366f1', 2);
	if (!renderCtx.calls.includes('fill') || !renderCtx.calls.includes('beginPath')) {
		throw new Error('drawArrowHead did not execute expected canvas commands');
	}

	const testShapes: ShapeRecord[] = [
		{
			id: 's1',
			type: 'rectangle',
			x: 10,
			y: 10,
			width: 100,
			height: 50,
			fill: '#ffffff',
			stroke: '#000000',
			strokeWidth: 2,
			rotation: 0,
			zIndex: 1,
			createdBy: 'u1',
			updatedAt: Date.now()
		},
		{
			id: 's2',
			type: 'sticky_note',
			x: 150,
			y: 50,
			width: 100,
			height: 100,
			fill: '#fef08a',
			stroke: '#eab308',
			strokeWidth: 1,
			rotation: 0,
			zIndex: 2,
			data: { text: 'Note content' },
			createdBy: 'u1',
			updatedAt: Date.now()
		}
	];

	for (const s of testShapes) {
		drawShape(renderCtx, s, '#ffffff');
	}

	const testPeer: PeerPresence = {
		userId: 'peer_1',
		name: 'Alice',
		color: '#10b981',
		cursor: { x: 50, y: 80 },
		selectedIds: []
	};
	drawPeerCursor(renderCtx, testPeer);

	renderGrid(renderCtx, 0, 0, 1, false, 800, 600);
	console.log('   ✓ canvas-render verified');

	// 3. canvas-export tests
	console.log('3. Testing canvas-export...');
	if (escapeXml('<hello & "world">') !== '&lt;hello &amp; &quot;world&quot;&gt;') {
		throw new Error('escapeXml failed escaping XML entities');
	}

	const shapesMap = new Map<string, ShapeRecord>();
	testShapes.forEach((s) => shapesMap.set(s.id, s));

	const computedBounds = computeShapesBounds(shapesMap.values());
	if (!computedBounds || computedBounds.minX !== 10 || computedBounds.maxX !== 250) {
		throw new Error(`computeShapesBounds failed: ${JSON.stringify(computedBounds)}`);
	}

	let exportedSvg = '';
	exportToSvg(shapesMap, '#121214', 'test.svg', (source) => {
		if (source instanceof Blob) {
			// Read synchronously or store
			source.text().then((txt) => {
				exportedSvg = txt;
			});
		}
	});

	await new Promise((r) => setTimeout(r, 50));
	if (!exportedSvg.includes('<svg') || !exportedSvg.includes('Note content')) {
		throw new Error('exportToSvg did not produce expected SVG text');
	}

	let exportedJson = '';
	exportToJson(shapesMap, 'test.json', (source) => {
		if (source instanceof Blob) {
			source.text().then((txt) => {
				exportedJson = txt;
			});
		}
	});

	await new Promise((r) => setTimeout(r, 50));
	if (!exportedJson.includes('"app": "Mesh"') || !exportedJson.includes('sticky_note')) {
		throw new Error('exportToJson did not produce valid JSON');
	}

	const imported = importFromJson(exportedJson, 10, '#ffffff');
	if (!imported || imported.length !== 2 || imported[0].zIndex !== 10) {
		throw new Error('importFromJson failed to parse exported shapes properly');
	}
	console.log('   ✓ canvas-export verified');

	console.log('=== All Canvas Modularization Unit Tests PASSED! ===');
}

runCanvasModuleTests().catch((err) => {
	console.error('Test failed:', err);
	process.exit(1);
});
