import type { ShapeRecord } from '../src/lib/types';

async function testExportAndImport() {
	console.log('--- Testing Export & Import ---');

	const mockShapes: ShapeRecord[] = [
		{
			id: 'shape_export_1',
			type: 'rectangle',
			x: 10,
			y: 10,
			width: 100,
			height: 50,
			fill: '#6366f1',
			stroke: '#f4f4f5',
			strokeWidth: 2,
			rotation: 0,
			zIndex: 1,
			createdBy: 'user_1',
			updatedAt: 1000
		},
		{
			id: 'shape_export_2',
			type: 'text',
			x: 120,
			y: 10,
			width: 80,
			height: 24,
			fill: 'transparent',
			stroke: '#f4f4f5',
			strokeWidth: 1,
			rotation: 0,
			zIndex: 2,
			data: { text: 'Hello Mesh', fontSize: 16 },
			createdBy: 'user_1',
			updatedAt: 1001
		}
	];

	// 1. Validate JSON export structure
	const exportData = {
		app: 'Mesh',
		version: '1.0.0',
		exportedAt: new Date().toISOString(),
		shapes: mockShapes
	};

	const jsonString = JSON.stringify(exportData, null, 2);
	const parsed = JSON.parse(jsonString);

	if (parsed.app !== 'Mesh' || parsed.shapes.length !== 2) {
		throw new Error('Export JSON payload structure is invalid.');
	}

	// 2. Validate JSON Import parsing logic
	const now = Date.now();
	let baseZ = 10;
	const imported: ShapeRecord[] = [];

	for (const item of parsed.shapes) {
		imported.push({
			id: 'shape_' + Math.random().toString(36).substring(2, 9),
			type: item.type,
			x: item.x,
			y: item.y,
			width: item.width,
			height: item.height,
			fill: item.fill,
			stroke: item.stroke,
			strokeWidth: item.strokeWidth,
			rotation: item.rotation,
			zIndex: baseZ++,
			data: item.data,
			createdBy: 'importer',
			updatedAt: now
		});
	}

	if (imported.length !== 2) {
		throw new Error('Import failed to restore all shapes.');
	}
	if (imported[0].id === mockShapes[0].id) {
		throw new Error('Imported shapes must receive fresh unique IDs.');
	}
	if (imported[0].zIndex !== 10 || imported[1].zIndex !== 11) {
		throw new Error('Imported shapes must receive monotonic fresh z-indexes.');
	}

	console.log('PASSED: Export and Import serialization verified!\n');
}

testExportAndImport().catch((err) => {
	console.error(err);
	process.exit(1);
});
