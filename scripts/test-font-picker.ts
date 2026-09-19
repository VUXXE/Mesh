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
		createElement: (tag: string) => {
			if (tag === 'canvas') {
				return createMockCanvas();
			}
			return {
				click: () => {},
				style: {}
			};
		},
		body: {
			appendChild: () => {},
			removeChild: () => {}
		}
	};
}

if (typeof (globalThis as any).URL === 'undefined' || !(globalThis as any).URL.createObjectURL) {
	(globalThis as any).URL = {
		createObjectURL: () => 'blob:mock',
		revokeObjectURL: () => {}
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
		toDataURL: () => 'data:image/png;base64,mock'
	};
}

import {
	CanvasEngine,
	FONT_FAMILIES,
	FONT_SIZES,
	getFontFamilyCss,
	getFontFamilySvg
} from '../src/lib/client/canvas-engine';
import type { ShapeRecord } from '../src/lib/types';
import type { HistoryAction } from '../src/lib/client/history.svelte';

async function runTests() {
	console.log('--- Testing Font Family and Font Size Selection ---');

	// 1. Verify Font Families & Sizes Constants
	console.log('1. Checking constants & helper functions...');
	if (
		!FONT_FAMILIES.sans.includes('sans-serif') ||
		!FONT_FAMILIES.serif.includes('serif') ||
		!FONT_FAMILIES.mono.includes('monospace')
	) {
		throw new Error('FONT_FAMILIES missing standard font definitions');
	}

	const expectedSizes = [14, 18, 28, 40];
	const actualSizes = FONT_SIZES.map((s) => s.value);
	if (JSON.stringify(actualSizes) !== JSON.stringify(expectedSizes)) {
		throw new Error(`Expected font sizes ${expectedSizes}, got ${actualSizes}`);
	}

	if (getFontFamilyCss('mono') !== FONT_FAMILIES.mono) {
		throw new Error('getFontFamilyCss(mono) mismatch');
	}
	if (getFontFamilySvg('mono').includes('"')) {
		throw new Error('getFontFamilySvg should escape or replace double quotes');
	}

	// 2. Verify CanvasEngine Initialization
	console.log('2. Checking CanvasEngine initialization state...');
	const staticCanvas = createMockCanvas();
	const overlayCanvas = createMockCanvas();
	const engine = new CanvasEngine(staticCanvas, overlayCanvas);

	if (engine.fontFamily !== 'sans') {
		throw new Error(`Expected default fontFamily to be 'sans', got '${engine.fontFamily}'`);
	}
	if (engine.fontSize !== 18) {
		throw new Error(`Expected default fontSize to be 18, got ${engine.fontSize}`);
	}

	// 3. Testing Callbacks on setFontFamily and setFontSize
	console.log('3. Checking setFontFamily & setFontSize callbacks...');
	let changedFamily = '';
	let changedSize = 0;
	engine.onFontFamilyChanged = (family) => {
		changedFamily = family;
	};
	engine.onFontSizeChanged = (size) => {
		changedSize = size;
	};

	engine.setFontFamily('serif');
	if (engine.fontFamily !== 'serif' || changedFamily !== 'serif') {
		throw new Error('setFontFamily failed to update state or trigger callback');
	}

	engine.setFontSize(28);
	if (engine.fontSize !== 28 || changedSize !== 28) {
		throw new Error('setFontSize failed to update state or trigger callback');
	}

	// 4. Testing Text Shape Modification & History Recording
	console.log('4. Checking text shape mutation and history recording on font changes...');
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

	const shapesMap = new Map<string, ShapeRecord>();
	shapesMap.set(textShape.id, textShape);
	engine.setShapes(shapesMap);

	let recordedAction: HistoryAction | null = null;
	let mutatedShapes: ShapeRecord[] = [];

	engine.onActionRecorded = (action) => {
		recordedAction = action;
	};
	engine.onShapesMutated = (shapes) => {
		mutatedShapes = shapes;
	};

	// Select the text shape
	engine.setSelectedIds(['text_1']);

	// Selection should sync fontFamily and fontSize to shape's properties
	if (engine.fontFamily !== 'sans' || engine.fontSize !== 18) {
		throw new Error('Selection should synchronize engine font settings to text shape');
	}

	// Update font family to 'mono'
	engine.setFontFamily('mono');
	const updatedShape1 = engine.getShape('text_1');
	if (!updatedShape1 || updatedShape1.data?.fontFamily !== 'mono') {
		throw new Error('Selected text shape fontFamily was not updated');
	}
	if (!recordedAction || (recordedAction as any).type !== 'modify') {
		throw new Error('History action was not recorded on setFontFamily');
	}
	if (mutatedShapes.length === 0 || mutatedShapes[0].data?.fontFamily !== 'mono') {
		throw new Error('onShapesMutated was not triggered with updated shape');
	}

	// Update font size to 40 (XL)
	recordedAction = null;
	mutatedShapes = [];
	engine.setFontSize(40);
	const updatedShape2 = engine.getShape('text_1');
	if (!updatedShape2 || updatedShape2.data?.fontSize !== 40) {
		throw new Error('Selected text shape fontSize was not updated');
	}
	if (!recordedAction || (recordedAction as any).type !== 'modify') {
		throw new Error('History action was not recorded on setFontSize');
	}
	if (mutatedShapes.length === 0 || mutatedShapes[0].data?.fontSize !== 40) {
		throw new Error('onShapesMutated was not triggered with updated shape');
	}

	// 5. Test calculateTextBounds
	console.log('5. Checking calculateTextBounds...');
	const bounds = engine.calculateTextBounds('Line 1\nLine 2 is longer', 28, 'mono');
	if (bounds.width <= 0 || bounds.height <= 0) {
		throw new Error('calculateTextBounds returned invalid dimensions');
	}

	// 6. Test SVG export includes font-family and font-size
	console.log('6. Checking SVG export...');
	let downloadedBlob: Blob | null = null;
	(engine as any).triggerBrowserDownload = (dataOrBlob: any) => {
		if (dataOrBlob instanceof Blob) {
			downloadedBlob = dataOrBlob;
		}
	};

	engine.exportToSvg();
	if (!downloadedBlob) {
		throw new Error('exportToSvg did not trigger download');
	}

	// Read blob content
	const svgText = await (downloadedBlob as Blob).text();
	if (!svgText.includes('font-size="40"') || !svgText.includes('font-family=')) {
		throw new Error('Exported SVG missing correct font-size or font-family');
	}

	console.log('✓ All font picker and text shape tests PASSED successfully!');
}

runTests().catch((err) => {
	console.error('Test failed:', err);
	process.exit(1);
});
