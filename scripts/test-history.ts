// Polyfill Svelte 5 $state rune for standalone test execution
if (typeof (globalThis as any).$state === 'undefined') {
	(globalThis as any).$state = (init: any) => init;
}

import { HistoryManager } from '../src/lib/client/history.svelte';
import type { ShapeRecord } from '../src/lib/types';

function createMockShape(id: string, x = 10, y = 20): ShapeRecord {
	return {
		id,
		type: 'rectangle',
		x,
		y,
		width: 100,
		height: 80,
		fill: 'transparent',
		stroke: '#f4f4f5',
		strokeWidth: 2,
		rotation: 0,
		zIndex: 1,
		createdBy: 'user_1',
		updatedAt: 1000
	};
}

async function runHistoryTests() {
	console.log('--- Testing HistoryManager ---');
	const history = new HistoryManager();

	if (history.canUndo || history.canRedo) {
		throw new Error('Initial history state should not have undo or redo available.');
	}

	let localShapes = new Map<string, ShapeRecord>();

	const upsert = (shapes: ShapeRecord[]) => {
		for (const s of shapes) {
			localShapes.set(s.id, s);
		}
	};
	const del = (ids: string[]) => {
		for (const id of ids) {
			localShapes.delete(id);
		}
	};
	const clear = () => {
		localShapes.clear();
	};

	// 1. Test Shape Creation and Undo/Redo
	const s1 = createMockShape('shape_1');
	upsert([s1]);
	history.push({ type: 'create', shape: s1 });

	if (!history.canUndo || history.canRedo) {
		throw new Error('After shape creation, canUndo should be true and canRedo false');
	}

	// Undo creation
	history.undo(upsert, del, clear);
	if (localShapes.has('shape_1')) {
		throw new Error('Shape 1 should be removed after undoing creation');
	}
	if (!history.canRedo || history.canUndo) {
		throw new Error('After undoing creation, canRedo should be true and canUndo false');
	}

	// Redo creation
	history.redo(upsert, del, clear);
	if (!localShapes.has('shape_1')) {
		throw new Error('Shape 1 should be restored after redoing creation');
	}

	// 2. Test Shape Modification and Undo/Redo
	const s1Modified = { ...s1, x: 200, y: 300, updatedAt: 2000 };
	upsert([s1Modified]);
	history.push({ type: 'modify', before: [s1], after: [s1Modified] });

	// Undo modification
	history.undo(upsert, del, clear);
	const restoredBefore = localShapes.get('shape_1');
	if (!restoredBefore || restoredBefore.x !== 10 || restoredBefore.y !== 20) {
		throw new Error('Shape 1 position was not reverted on undo modification');
	}
	if (restoredBefore.updatedAt <= 2000) {
		throw new Error('Undo must increment updatedAt timestamp for LWW replication');
	}

	// Redo modification
	history.redo(upsert, del, clear);
	const restoredAfter = localShapes.get('shape_1');
	if (!restoredAfter || restoredAfter.x !== 200 || restoredAfter.y !== 300) {
		throw new Error('Shape 1 position was not re-applied on redo modification');
	}

	// 3. Test Shape Deletion and Undo/Redo
	del(['shape_1']);
	history.push({ type: 'delete', shapes: [s1Modified] });

	// Undo deletion
	history.undo(upsert, del, clear);
	if (!localShapes.has('shape_1')) {
		throw new Error('Shape 1 should be restored after undoing deletion');
	}

	// Redo deletion
	history.redo(upsert, del, clear);
	if (localShapes.has('shape_1')) {
		throw new Error('Shape 1 should be deleted after redoing deletion');
	}

	// 4. Test Batch Create (Paste / Duplicate) and Undo/Redo
	const s2 = createMockShape('shape_2', 50, 50);
	const s3 = createMockShape('shape_3', 80, 80);
	upsert([s2, s3]);
	history.push({ type: 'batch_create', shapes: [s2, s3] });

	// Undo batch_create
	history.undo(upsert, del, clear);
	if (localShapes.has('shape_2') || localShapes.has('shape_3')) {
		throw new Error('Batch created shapes should be deleted after undo');
	}

	// Redo batch_create
	history.redo(upsert, del, clear);
	if (!localShapes.has('shape_2') || !localShapes.has('shape_3')) {
		throw new Error('Batch created shapes should be restored after redo');
	}
	if (localShapes.get('shape_2')!.updatedAt <= s2.updatedAt) {
		throw new Error('Redo batch_create must assign fresh updatedAt timestamps');
	}

	console.log('PASSED: All HistoryManager unit tests succeeded!\n');
}

runHistoryTests().catch((err) => {
	console.error(err);
	process.exit(1);
});
