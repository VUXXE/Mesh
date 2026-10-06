export interface ShortcutItem {
	label: string;
	keys: string[];
	description?: string;
}

export interface ShortcutGroup {
	name: string;
	items: ShortcutItem[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
	{
		name: 'Tools',
		items: [
			{
				label: 'Select tool',
				keys: ['V', '1'],
				description: 'Switch to selection and transform tool'
			},
			{
				label: 'Pan / Hand tool',
				keys: ['H', '0'],
				description: 'Switch to hand tool for panning'
			},
			{
				label: 'Rectangle tool',
				keys: ['R', '2'],
				description: 'Draw rectangles or rounded boxes'
			},
			{ label: 'Diamond tool', keys: ['D', '3'], description: 'Draw decision diamond shapes' },
			{ label: 'Ellipse tool', keys: ['E', '4'], description: 'Draw ellipses and circles' },
			{
				label: 'Arrow tool',
				keys: ['A', '5'],
				description: 'Draw connectors and directional arrows'
			},
			{ label: 'Line tool', keys: ['L', '6'], description: 'Draw straight or orthogonal lines' },
			{ label: 'Pen tool', keys: ['P', '7'], description: 'Freehand sketching and drawing' },
			{ label: 'Text tool', keys: ['T', '8'], description: 'Insert single or multi-line text' },
			{ label: 'Sticky Note tool', keys: ['S', '9'], description: 'Place sticky notes with text' }
		]
	},
	{
		name: 'Canvas & Viewport',
		items: [
			{
				label: 'Pan Canvas',
				keys: ['Space', 'Drag'],
				description: 'Hold Space and drag mouse to pan'
			},
			{ label: 'Zoom In', keys: ['Ctrl / ⌘', '+'], description: 'Zoom in toward canvas center' },
			{ label: 'Zoom Out', keys: ['Ctrl / ⌘', '-'], description: 'Zoom out from canvas center' },
			{
				label: 'Reset Zoom',
				keys: ['Ctrl / ⌘', '0'],
				description: 'Reset zoom to 100% and pan to origin'
			},
			{
				label: 'Toggle Grid',
				keys: ['Ctrl / ⌘', "'"],
				description: 'Cycle through grid display styles'
			},
			{
				label: 'Toggle Snap to Grid',
				keys: ['Ctrl / ⌘', 'Shift', "'"],
				description: 'Toggle shape grid snapping'
			},
			{
				label: 'Keyboard Shortcuts',
				keys: ['?'],
				description: 'Open this keyboard shortcuts reference'
			},
			{
				label: 'Keyboard Shortcuts (alt)',
				keys: ['Ctrl / ⌘', '/'],
				description: 'Open shortcuts cheat sheet'
			}
		]
	},
	{
		name: 'Selection & History',
		items: [
			{ label: 'Undo', keys: ['Ctrl / ⌘', 'Z'], description: 'Undo last change' },
			{ label: 'Redo', keys: ['Ctrl / ⌘', 'Shift', 'Z'], description: 'Redo reverted change' },
			{ label: 'Redo (alt)', keys: ['Ctrl / ⌘', 'Y'], description: 'Redo reverted change' },
			{ label: 'Select All', keys: ['Ctrl / ⌘', 'A'], description: 'Select all shapes on canvas' },
			{
				label: 'Duplicate',
				keys: ['Ctrl / ⌘', 'D'],
				description: 'Duplicate selected shapes with offset'
			},
			{ label: 'Copy', keys: ['Ctrl / ⌘', 'C'], description: 'Copy selected shapes to clipboard' },
			{ label: 'Cut', keys: ['Ctrl / ⌘', 'X'], description: 'Cut selected shapes to clipboard' },
			{ label: 'Paste', keys: ['Ctrl / ⌘', 'V'], description: 'Paste shapes from clipboard' },
			{ label: 'Delete', keys: ['Delete'], description: 'Delete selected shapes' },
			{ label: 'Delete (alt)', keys: ['Backspace'], description: 'Delete selected shapes' },
			{ label: 'Deselect', keys: ['Esc'], description: 'Clear active shape selection' },
			{ label: 'Nudge', keys: ['Arrow Keys'], description: 'Move selected shapes by 1px' },
			{
				label: 'Large Nudge',
				keys: ['Shift', 'Arrow Keys'],
				description: 'Move selected shapes by 10px'
			}
		]
	},
	{
		name: 'Arrangement',
		items: [
			{
				label: 'Bring Forward',
				keys: [']'],
				description: 'Move selected shapes one layer forward'
			},
			{
				label: 'Send Backward',
				keys: ['['],
				description: 'Move selected shapes one layer backward'
			},
			{
				label: 'Bring to Front',
				keys: ['Ctrl / ⌘', ']'],
				description: 'Move selected shapes to front'
			},
			{
				label: 'Send to Back',
				keys: ['Ctrl / ⌘', '['],
				description: 'Move selected shapes to back'
			}
		]
	},
	{
		name: 'Editing',
		items: [
			{
				label: 'Edit Text / Label',
				keys: ['Enter'],
				description: 'Open text editor on selected shape'
			},
			{
				label: 'Edit Text (mouse)',
				keys: ['Double Click'],
				description: 'Double click shape to edit text'
			},
			{
				label: 'Commit Text Edit',
				keys: ['Ctrl / ⌘', 'Enter'],
				description: 'Save edits and close inline text editor'
			},
			{
				label: 'Cancel / Finish Text Edit',
				keys: ['Esc'],
				description: 'Exit text editor or deselect'
			}
		]
	}
];
