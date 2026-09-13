import type { ShapeRecord } from '../types';

export type HistoryAction =
	| { type: 'create'; shape: ShapeRecord }
	| { type: 'modify'; before: ShapeRecord[]; after: ShapeRecord[] }
	| { type: 'delete'; shapes: ShapeRecord[] }
	| { type: 'clear'; shapes: ShapeRecord[] };

export class HistoryManager {
	private undoStack: HistoryAction[] = [];
	private redoStack: HistoryAction[] = [];
	private maxHistory = 50;

	canUndo = $state(false);
	canRedo = $state(false);

	private updateState() {
		this.canUndo = this.undoStack.length > 0;
		this.canRedo = this.redoStack.length > 0;
	}

	push(action: HistoryAction) {
		this.undoStack.push(action);
		if (this.undoStack.length > this.maxHistory) {
			this.undoStack.shift();
		}
		// Clear redo stack on any new user action
		this.redoStack = [];
		this.updateState();
	}

	undo(
		upsertFn: (shapes: ShapeRecord[]) => void,
		deleteFn: (ids: string[]) => void,
		clearFn: () => void
	) {
		const action = this.undoStack.pop();
		if (!action) return;

		const now = Date.now();
		switch (action.type) {
			case 'create':
				deleteFn([action.shape.id]);
				break;
			case 'modify':
				upsertFn(
					action.before.map((s, idx) => ({
						...s,
						updatedAt: now + idx
					}))
				);
				break;
			case 'delete':
				upsertFn(
					action.shapes.map((s, idx) => ({
						...s,
						updatedAt: now + idx
					}))
				);
				break;
			case 'clear':
				upsertFn(
					action.shapes.map((s, idx) => ({
						...s,
						updatedAt: now + idx
					}))
				);
				break;
		}

		this.redoStack.push(action);
		this.updateState();
	}

	redo(
		upsertFn: (shapes: ShapeRecord[]) => void,
		deleteFn: (ids: string[]) => void,
		clearFn: () => void
	) {
		const action = this.redoStack.pop();
		if (!action) return;

		const now = Date.now();
		switch (action.type) {
			case 'create':
				upsertFn([{ ...action.shape, updatedAt: now }]);
				break;
			case 'modify':
				upsertFn(
					action.after.map((s, idx) => ({
						...s,
						updatedAt: now + idx
					}))
				);
				break;
			case 'delete':
				deleteFn(action.shapes.map((s) => s.id));
				break;
			case 'clear':
				clearFn();
				break;
		}

		this.undoStack.push(action);
		this.updateState();
	}

	clear() {
		this.undoStack = [];
		this.redoStack = [];
		this.updateState();
	}
}
