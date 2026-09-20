import { renderGrid } from '../src/lib/client/canvas-render';
import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('🧪 Testing Grid Mode and Light Mode Contrast...');

// 1. Test renderGrid with Mock Canvas Context
class MockGridCanvasContext {
	calls: { method: string; args: any[] }[] = [];
	fillStyle: string = '';
	strokeStyle: string = '';
	lineWidth: number = 0;

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

// Test 1: Light mode dots contrast
{
	const ctx = new MockGridCanvasContext();
	renderGrid(ctx as any, 0, 0, 1, true, 800, 600, 'dots');

	if (ctx.fillStyle !== '#a1a1aa') {
		console.error(`❌ FAIL: Expected light mode dot fillStyle to be #a1a1aa, got ${ctx.fillStyle}`);
		process.exit(1);
	}
	const rectCalls = ctx.calls.filter((c) => c.method === 'fillRect');
	if (rectCalls.length === 0) {
		console.error('❌ FAIL: Expected fillRect calls for dots grid');
		process.exit(1);
	}
	console.log(
		`✅ PASS: Light mode dot fillStyle is high-contrast #a1a1aa (drew ${rectCalls.length} dots)`
	);
}

// Test 2: Dark mode dots
{
	const ctx = new MockGridCanvasContext();
	renderGrid(ctx as any, 0, 0, 1, false, 800, 600, 'dots');

	if (ctx.fillStyle !== '#2e2e33') {
		console.error(`❌ FAIL: Expected dark mode dot fillStyle to be #2e2e33, got ${ctx.fillStyle}`);
		process.exit(1);
	}
	console.log('✅ PASS: Dark mode dot fillStyle is #2e2e33');
}

// Test 3: Lines / Graph Paper mode
{
	const ctx = new MockGridCanvasContext();
	renderGrid(ctx as any, 0, 0, 1, true, 800, 600, 'lines');

	const moveToCalls = ctx.calls.filter((c) => c.method === 'moveTo');
	const lineToCalls = ctx.calls.filter((c) => c.method === 'lineTo');
	const strokeCalls = ctx.calls.filter((c) => c.method === 'stroke');

	if (moveToCalls.length === 0 || lineToCalls.length === 0 || strokeCalls.length === 0) {
		console.error('❌ FAIL: Expected line grid to stroke horizontal and vertical lines');
		process.exit(1);
	}
	console.log(`✅ PASS: Lines grid drew ${moveToCalls.length} grid lines with stroke()`);
}

// Test 4: None mode
{
	const ctx = new MockGridCanvasContext();
	renderGrid(ctx as any, 0, 0, 1, true, 800, 600, 'none');

	if (ctx.calls.length > 0) {
		console.error('❌ FAIL: Expected none mode to draw zero canvas elements');
		process.exit(1);
	}
	console.log('✅ PASS: None mode renders nothing');
}

// Test 5: Check layout.css variable --grid-dot in light mode
{
	const css = readFileSync(resolve(__dirname, '../src/routes/layout.css'), 'utf-8');
	const lightBlock = css.split('html.light')[1]?.split('}')[0] ?? '';
	if (!lightBlock.includes('--grid-dot: #a1a1aa')) {
		console.error('❌ FAIL: layout.css html.light does not have --grid-dot: #a1a1aa');
		process.exit(1);
	}
	console.log('✅ PASS: layout.css html.light has --grid-dot: #a1a1aa');
}

// Test 6: Check Toolbar.svelte for swatch borders
{
	const toolbar = readFileSync(resolve(__dirname, '../src/lib/components/Toolbar.svelte'), 'utf-8');
	if (!toolbar.includes('border-black/40') || !toolbar.includes('dark:border-white/30')) {
		console.error('❌ FAIL: Toolbar.svelte does not include high-contrast border on swatches');
		process.exit(1);
	}
	console.log(
		'✅ PASS: Toolbar.svelte contains high-contrast border-black/40 and dark:border-white/30 on swatches'
	);
}

console.log('🎉 ALL GRID MODE AND CONTRAST TESTS PASSED SUCCESSFULLY!');
