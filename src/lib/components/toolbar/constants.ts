import { FONT_FAMILIES } from '$lib/client/canvas-engine';
import type { ToolMode } from '$lib/client/canvas-engine';
import type { FillStyle } from '$lib/types';

export const FONT_FAMILY_OPTIONS = [
	{ label: 'Sans', value: 'sans', css: FONT_FAMILIES.sans },
	{ label: 'Serif', value: 'serif', css: FONT_FAMILIES.serif },
	{ label: 'Mono', value: 'mono', css: FONT_FAMILIES.mono }
];

export const STROKE_COLORS = [
	{ label: 'White', value: '#ffffff' },
	{ label: 'Dark Zinc', value: '#27272a' },
	{ label: 'Slate Gray', value: '#64748b' },
	{ label: 'Light Zinc', value: '#d4d4d8' },
	{ label: 'Crimson Red', value: '#e03131' },
	{ label: 'Coral Rose', value: '#f43f5e' },
	{ label: 'Barbie Pink', value: '#ec4899' },
	{ label: 'Royal Purple', value: '#9c36b5' },
	{ label: 'Indigo Accent', value: '#6366f1' },
	{ label: 'Vivid Blue', value: '#1971c2' },
	{ label: 'Sky Blue', value: '#0ea5e9' },
	{ label: 'Teal Green', value: '#0c8599' },
	{ label: 'Mint Emerald', value: '#099268' },
	{ label: 'Forest Green', value: '#2f9e44' },
	{ label: 'Lime Olive', value: '#66a80f' },
	{ label: 'Sun Yellow', value: '#f08c00' },
	{ label: 'Warm Orange', value: '#e8590c' }
];

export const PRIMARY_STROKE_COLORS = STROKE_COLORS.slice(0, 8);
export const MORE_STROKE_COLORS = STROKE_COLORS.slice(8);

export const FILL_COLORS = [
	{ label: 'None', value: 'transparent' },
	{ label: 'Pure White', value: '#ffffff' },
	{ label: 'Light Zinc', value: '#f4f4f5' },
	{ label: 'Dark Charcoal', value: '#27272a' },
	{ label: 'Pastel Red', value: '#ffc9c9' },
	{ label: 'Pastel Indigo', value: '#d0bfff' },
	{ label: 'Pastel Blue', value: '#a5d8ff' },
	{ label: 'Pastel Emerald', value: '#b2f2bb' },
	{ label: 'Vivid Red', value: '#e03131' },
	{ label: 'Pastel Pink', value: '#fcc2d7' },
	{ label: 'Pastel Purple', value: '#eebefa' },
	{ label: 'Pastel Sky', value: '#cffafe' },
	{ label: 'Pastel Teal', value: '#96f2d7' },
	{ label: 'Pastel Lime', value: '#d8f5a2' },
	{ label: 'Pastel Yellow', value: '#ffec99' },
	{ label: 'Pastel Orange', value: '#ffd8a8' },
	{ label: 'Vivid Amber', value: '#f08c00' }
];

export const PRIMARY_FILL_COLORS = FILL_COLORS.slice(0, 8);
export const MORE_FILL_COLORS = FILL_COLORS.slice(8);

export const FILL_STYLES: { label: string; value: FillStyle }[] = [
	{ label: 'Solid', value: 'solid' },
	{ label: 'Hachure', value: 'hachure' },
	{ label: 'Cross', value: 'cross-hatch' }
];

export const OPACITY_PRESETS = [
	{ label: '25%', value: 0.25 },
	{ label: '50%', value: 0.5 },
	{ label: '75%', value: 0.75 },
	{ label: '100%', value: 1 }
];

export const STROKE_WIDTHS = [
	{ label: 'Thin', value: 2, barHeight: 2 },
	{ label: 'Medium', value: 4, barHeight: 3.5 },
	{ label: 'Bold', value: 8, barHeight: 5.5 }
];

export function getToolDisplayName(tool: ToolMode): string {
	switch (tool) {
		case 'select':
			return 'Select';
		case 'pen':
			return 'Draw';
		case 'line':
			return 'Line';
		case 'arrow':
			return 'Arrow';
		case 'rectangle':
			return 'Rectangle';
		case 'diamond':
			return 'Diamond';
		case 'ellipse':
			return 'Ellipse';
		case 'text':
			return 'Text';
		case 'sticky_note':
			return 'Sticky Note';
		case 'pan':
			return 'Hand / Pan';
		default:
			return 'Tool';
	}
}
