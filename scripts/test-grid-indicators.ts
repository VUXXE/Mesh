import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('🧪 Testing Clear Grid Indicators in PresenceBar...');

const presenceBarPath = resolve(process.cwd(), 'src/lib/components/PresenceBar.svelte');
const code = readFileSync(presenceBarPath, 'utf-8');

// 1. Check for explicit text label in the top bar button
if (!code.includes("gridMode === 'dots' ? 'Dots' : gridMode === 'lines' ? 'Lines' : 'Grid Off'")) {
	throw new Error('FAIL: Top bar button does not contain explicit Grid Mode text label');
}
console.log('✅ PASS: Top bar button displays clear text label (Dots / Lines / Grid Off)');

// 2. Check for Snap indicator badge in the top bar button
if (!code.includes('{#if snapToGrid}') || !code.includes('Snap</span>')) {
	throw new Error('FAIL: Snap indicator badge missing on top bar button');
}
console.log('✅ PASS: Snap to Grid indicator badge displays on top bar button');

// 3. Check for Active badge in the dropdown menu
if (!code.includes('>Active</span>') && !code.includes('>Active</span')) {
	throw new Error('FAIL: Active mode badge missing in dropdown selector');
}
console.log('✅ PASS: Grid dropdown displays Active badge on currently selected mode');

// 4. Check for ON / OFF badge on Snap to Grid switch
if (!code.includes("{snapToGrid ? 'ON' : 'OFF'}")) {
	throw new Error('FAIL: ON / OFF status badge missing on Snap to Grid toggle');
}
console.log('✅ PASS: Snap to Grid toggle displays explicit ON / OFF text badge');

// 5. Check for real-time Grid HUD notification
if (
	!code.includes('gridHudMessage') ||
	!code.includes('Floating Real-Time Grid HUD Notification')
) {
	throw new Error('FAIL: Grid HUD toast notification missing');
}
console.log('✅ PASS: Real-time Floating Grid HUD toast notification implemented');

console.log('🎉 ALL GRID INDICATOR TESTS PASSED SUCCESSFULLY!');
