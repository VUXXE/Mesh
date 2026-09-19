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
		translate: () => {}
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

import { CanvasEngine } from '../src/lib/client/canvas-engine';
import type { ShapeRecord } from '../src/lib/types';

async function runNativePasteTests() {
	console.log('=== Running Native Paste Tests ===\n');

	const staticCanvas = createMockCanvas();
	const overlayCanvas = createMockCanvas();
	const engine = new CanvasEngine(staticCanvas, overlayCanvas);

	// 1. Test engine.paste() with in-memory clipboard (must not call readText)
	console.log('1. Testing engine.paste() prioritizes in-memory clipboard without readText...');
	let readTextCalled = false;
	(globalThis as any).navigator = {
		clipboard: {
			readText: async () => {
				readTextCalled = true;
				return '';
			},
			writeText: async () => {}
		}
	};

	const s1: ShapeRecord = {
		id: 'rect_test',
		type: 'rectangle',
		x: 100,
		y: 100,
		width: 80,
		height: 60,
		fill: 'transparent',
		stroke: '#ffffff',
		strokeWidth: 2,
		rotation: 0,
		zIndex: 1,
		createdBy: 'user',
		updatedAt: 1000
	};
	engine.setShapes(new Map([['rect_test', s1]]));
	engine.setSelectedIds(['rect_test']);
	engine.copySelected();

	const pasted = await engine.paste();
	if (readTextCalled) {
		throw new Error(
			'engine.paste() should NOT call navigator.clipboard.readText() when in-memory clipboard has items!'
		);
	}
	if (pasted.length !== 1 || pasted[0].id === 'rect_test') {
		throw new Error('engine.paste() failed to paste in-memory shape');
	}
	console.log(
		'  ✓ In-memory clipboard used immediately without triggering browser permission popup\n'
	);

	// 2. Test pastePlainText
	console.log('2. Testing pastePlainText for external copied text...');
	const plainText = 'Architecture Plan\n1. Database\n2. WebSocket';
	const textShape = engine.pastePlainText(plainText);

	if (!textShape) throw new Error('pastePlainText should create a shape');
	if (textShape.type !== 'text') throw new Error(`Expected type 'text', got ${textShape.type}`);
	if (textShape.data?.text !== plainText) {
		throw new Error(`Text shape data.text mismatch: ${textShape.data?.text}`);
	}
	if (!engine.selectedIds.includes(textShape.id)) {
		throw new Error('pastePlainText should select the newly created shape');
	}
	console.log('  ✓ Plain text pasted as native text shape centered on canvas\n');

	// 3. Test whitespace-only plain text returns null
	const emptyTextShape = engine.pastePlainText('   \n  ');
	if (emptyTextShape !== null) {
		throw new Error('Whitespace-only text should not create a shape');
	}
	console.log('  ✓ Empty/whitespace plain text ignored gracefully\n');

	console.log('=== All Native Paste Tests Passed! ===\n');
}

runNativePasteTests().catch((err) => {
	console.error('Test failed:', err);
	process.exit(1);
});
