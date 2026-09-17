export const FONT_FAMILIES = {
	sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
	serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
	mono: '"JetBrains Mono", Menlo, Monaco, Consolas, "Courier New", monospace'
} as const;

export type FontFamilyKey = keyof typeof FONT_FAMILIES;

export const FONT_SIZES = [
	{ label: 'S', value: 14, title: 'Small (14px)' },
	{ label: 'M', value: 18, title: 'Medium (18px)' },
	{ label: 'L', value: 28, title: 'Large (28px)' },
	{ label: 'XL', value: 40, title: 'Extra Large (40px)' }
] as const;

export function getFontFamilyCss(family?: string): string {
	if (!family) return FONT_FAMILIES.sans;
	if (family in FONT_FAMILIES) return FONT_FAMILIES[family as FontFamilyKey];
	return family;
}

export function getFontFamilySvg(family?: string): string {
	const css = getFontFamilyCss(family);
	return css.replace(/"/g, "'");
}

export function calculateTextBounds(
	text: string,
	fontSize: number,
	fontFamily: string = 'sans',
	ctx?: CanvasRenderingContext2D | null
): { width: number; height: number } {
	if (!text) {
		return { width: 140, height: Math.max(Math.round(fontSize * 1.3), 32) };
	}
	const lines = text.split('\n');
	const fFamily = getFontFamilyCss(fontFamily);
	let maxWidth = 0;
	if (ctx) {
		ctx.save();
		ctx.font = `${fontSize}px ${fFamily}`;
		for (const line of lines) {
			const metrics = ctx.measureText(line);
			if (metrics.width > maxWidth) {
				maxWidth = metrics.width;
			}
		}
		ctx.restore();
	} else {
		const maxLineLength = Math.max(...lines.map((l) => l.length), 1);
		maxWidth = maxLineLength * (fontSize * 0.62);
	}
	const lineHeight = Math.round(fontSize * 1.3);
	return {
		width: Math.max(Math.ceil(maxWidth + 8), 40),
		height: Math.max(lines.length * lineHeight, 28)
	};
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const result: string[] = [];
	const rawLines = text.split('\n');

	for (const rawLine of rawLines) {
		if (rawLine === '') {
			result.push('');
			continue;
		}
		const words = rawLine.split(' ');
		let currentLine = '';

		for (let i = 0; i < words.length; i++) {
			const word = words[i];
			const testLine = currentLine ? `${currentLine} ${word}` : word;
			if (ctx.measureText(testLine).width > maxWidth && currentLine) {
				result.push(currentLine);
				currentLine = word;
			} else {
				currentLine = testLine;
			}

			if (ctx.measureText(currentLine).width > maxWidth) {
				let sub = '';
				for (const char of currentLine) {
					if (ctx.measureText(sub + char).width > maxWidth && sub) {
						result.push(sub);
						sub = char;
					} else {
						sub += char;
					}
				}
				currentLine = sub;
			}
		}
		if (currentLine) {
			result.push(currentLine);
		}
	}

	return result;
}
