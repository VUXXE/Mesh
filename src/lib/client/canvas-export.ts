import { getShapeBounds, type BoundingBox } from './math';
import { getFontFamilySvg } from './canvas-text';
import { drawShape } from './canvas-render';
import type { PathPoint, ShapeRecord } from '../types';

export function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export function triggerBrowserDownload(source: string | Blob, filename: string) {
	if (typeof document === 'undefined') return;

	const isBlob = typeof source !== 'string';
	const url = isBlob ? URL.createObjectURL(source) : source;
	const a = document.createElement('a');
	a.style.display = 'none';
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();

	setTimeout(() => {
		if (document.body.contains(a)) {
			document.body.removeChild(a);
		}
		if (isBlob) {
			URL.revokeObjectURL(url);
		}
	}, 300);
}

export function computeShapesBounds(shapes: Iterable<ShapeRecord>): BoundingBox | null {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	let count = 0;

	for (const shape of shapes) {
		const b = getShapeBounds(shape);
		if (b.minX < minX) minX = b.minX;
		if (b.minY < minY) minY = b.minY;
		if (b.maxX > maxX) maxX = b.maxX;
		if (b.maxY > maxY) maxY = b.maxY;
		count++;
	}

	if (count === 0) return null;

	return {
		minX,
		minY,
		maxX,
		maxY,
		width: Math.max(maxX - minX, 1),
		height: Math.max(maxY - minY, 1)
	};
}

export function exportToPng(
	shapes: Map<string, ShapeRecord>,
	themeCanvasBg: string,
	defaultStroke: string,
	filename = 'mesh-whiteboard.png',
	scale = 2,
	downloadFn: (source: string | Blob, filename: string) => void = triggerBrowserDownload
) {
	if (shapes.size === 0) {
		alert('Canvas is empty. Draw something before exporting.');
		return;
	}

	const bounds = computeShapesBounds(shapes.values());
	if (!bounds) return;

	const padding = 40;
	const w = Math.max(bounds.width + padding * 2, 100);
	const h = Math.max(bounds.height + padding * 2, 100);

	const offscreen = document.createElement('canvas');
	offscreen.width = Math.round(w * scale);
	offscreen.height = Math.round(h * scale);
	const offCtx = offscreen.getContext('2d');
	if (!offCtx) return;

	offCtx.scale(scale, scale);

	offCtx.fillStyle = themeCanvasBg;
	offCtx.fillRect(0, 0, w, h);

	offCtx.translate(-bounds.minX + padding, -bounds.minY + padding);

	const sorted = Array.from(shapes.values()).sort((a, b) => a.zIndex - b.zIndex);
	for (const shape of sorted) {
		drawShape(offCtx, shape, defaultStroke);
	}

	const dataUrl = offscreen.toDataURL('image/png');
	downloadFn(dataUrl, filename);
}

export function exportToSvg(
	shapes: Map<string, ShapeRecord>,
	themeCanvasBg: string,
	filename = 'mesh-whiteboard.svg',
	downloadFn: (source: string | Blob, filename: string) => void = triggerBrowserDownload
) {
	if (shapes.size === 0) {
		alert('Canvas is empty. Draw something before exporting.');
		return;
	}

	const bounds = computeShapesBounds(shapes.values());
	if (!bounds) return;

	const padding = 40;
	const w = Math.max(bounds.width + padding * 2, 100);
	const h = Math.max(bounds.height + padding * 2, 100);

	let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.minX - padding} ${bounds.minY - padding} ${w} ${h}" width="${w}" height="${h}">\n`;
	svgContent += `<rect x="${bounds.minX - padding}" y="${bounds.minY - padding}" width="${w}" height="${h}" fill="${themeCanvasBg}"/>\n`;

	const sorted = Array.from(shapes.values()).sort((a, b) => a.zIndex - b.zIndex);
	for (const shape of sorted) {
		if (shape.type === 'path') {
			const points: PathPoint[] = shape.data?.points ?? [];
			if (shape.data?.isDiamond && points.length >= 4) {
				const pts = points.map((p) => `${p.x},${p.y}`).join(' ');
				svgContent += `<polygon points="${pts}" fill="${shape.fill || 'none'}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" stroke-linejoin="round"/>\n`;

				const text = shape.data?.text || '';
				if (text) {
					const fSize = shape.data?.fontSize || 16;
					const fFamily = getFontFamilySvg(shape.data?.fontFamily || 'sans');
					const lines = text.split('\n');
					const cx = shape.x + shape.width / 2;
					const cy = shape.y + shape.height / 2;
					const lineHeight = fSize * 1.3;
					const totalH = lines.length * lineHeight;
					const startY = cy - totalH / 2 + fSize * 0.8;
					svgContent += `<text x="${cx}" y="${startY}" text-anchor="middle" font-family="${fFamily}" font-size="${fSize}" fill="${shape.stroke}">\n`;
					for (let i = 0; i < lines.length; i++) {
						const dy = i === 0 ? '0' : '1.3em';
						svgContent += `<tspan x="${cx}" dy="${dy}">${escapeXml(lines[i])}</tspan>\n`;
					}
					svgContent += `</text>\n`;
				}
			} else if (points.length >= 2) {
				const d = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
				svgContent += `<path d="${d}" fill="none" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>\n`;

				if (shape.data?.isArrow && points.length >= 2) {
					const p1 = points[points.length - 2];
					const p2 = points[points.length - 1];
					const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
					const headLength = Math.max((shape.strokeWidth || 2) * 4, 12);
					const arrowAngle = Math.PI / 6;
					const x1 = p2.x - headLength * Math.cos(angle - arrowAngle);
					const y1 = p2.y - headLength * Math.sin(angle - arrowAngle);
					const x2 = p2.x - headLength * Math.cos(angle + arrowAngle);
					const y2 = p2.y - headLength * Math.sin(angle + arrowAngle);
					svgContent += `<polygon points="${p2.x},${p2.y} ${x1},${y1} ${x2},${y2}" fill="${shape.stroke}"/>\n`;
				}
			}
		} else if (shape.type === 'rectangle') {
			const rx = Math.min(shape.x, shape.x + shape.width);
			const ry = Math.min(shape.y, shape.y + shape.height);
			const rw = Math.max(Math.abs(shape.width), 1);
			const rh = Math.max(Math.abs(shape.height), 1);
			svgContent += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="4" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}"/>\n`;

			const text = shape.data?.text || '';
			if (text) {
				const fSize = shape.data?.fontSize || 16;
				const fFamily = getFontFamilySvg(shape.data?.fontFamily || 'sans');
				const lines = text.split('\n');
				const cx = rx + rw / 2;
				const cy = ry + rh / 2;
				const lineHeight = fSize * 1.3;
				const totalH = lines.length * lineHeight;
				const startY = cy - totalH / 2 + fSize * 0.8;
				svgContent += `<text x="${cx}" y="${startY}" text-anchor="middle" font-family="${fFamily}" font-size="${fSize}" fill="${shape.stroke}">\n`;
				for (let i = 0; i < lines.length; i++) {
					const dy = i === 0 ? '0' : '1.3em';
					svgContent += `<tspan x="${cx}" dy="${dy}">${escapeXml(lines[i])}</tspan>\n`;
				}
				svgContent += `</text>\n`;
			}
		} else if (shape.type === 'ellipse') {
			const rx = Math.max(Math.abs(shape.width / 2), 1);
			const ry = Math.max(Math.abs(shape.height / 2), 1);
			const cx = shape.x + shape.width / 2;
			const cy = shape.y + shape.height / 2;
			svgContent += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}"/>\n`;

			const text = shape.data?.text || '';
			if (text) {
				const fSize = shape.data?.fontSize || 16;
				const fFamily = getFontFamilySvg(shape.data?.fontFamily || 'sans');
				const lines = text.split('\n');
				const lineHeight = fSize * 1.3;
				const totalH = lines.length * lineHeight;
				const startY = cy - totalH / 2 + fSize * 0.8;
				svgContent += `<text x="${cx}" y="${startY}" text-anchor="middle" font-family="${fFamily}" font-size="${fSize}" fill="${shape.stroke}">\n`;
				for (let i = 0; i < lines.length; i++) {
					const dy = i === 0 ? '0' : '1.3em';
					svgContent += `<tspan x="${cx}" dy="${dy}">${escapeXml(lines[i])}</tspan>\n`;
				}
				svgContent += `</text>\n`;
			}
		} else if (shape.type === 'text') {
			const text = shape.data?.text || '';
			const fSize = shape.data?.fontSize || 18;
			const fFamily = getFontFamilySvg(shape.data?.fontFamily || 'sans');
			const lines = text.split('\n');
			svgContent += `<text x="${shape.x}" y="${shape.y + fSize}" font-family="${fFamily}" font-size="${fSize}" fill="${shape.stroke}">\n`;
			for (let i = 0; i < lines.length; i++) {
				const dy = i === 0 ? '0' : '1.3em';
				svgContent += `<tspan x="${shape.x}" dy="${dy}">${escapeXml(lines[i])}</tspan>\n`;
			}
			svgContent += `</text>\n`;
		} else if (shape.type === 'sticky_note') {
			const text = shape.data?.text || '';
			const lines = text.split('\n');
			svgContent += `<g>\n`;
			svgContent += `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="6" fill="${shape.fill || '#fef08a'}" stroke="${shape.stroke || '#eab308'}" stroke-width="1"/>\n`;
			if (lines.length > 0 && lines.some((l: string) => l.length > 0)) {
				svgContent += `<text x="${shape.x + 12}" y="${shape.y + 24}" font-family="system-ui, sans-serif" font-size="14" fill="#18181b">\n`;
				for (let i = 0; i < lines.length; i++) {
					const dy = i === 0 ? '0' : '1.3em';
					svgContent += `<tspan x="${shape.x + 12}" dy="${dy}">${escapeXml(lines[i])}</tspan>\n`;
				}
				svgContent += `</text>\n`;
			}
			svgContent += `</g>\n`;
		}
	}

	svgContent += `</svg>`;

	const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
	downloadFn(blob, filename);
}

export function exportToJson(
	shapes: Map<string, ShapeRecord>,
	filename = 'mesh-whiteboard.json',
	downloadFn: (source: string | Blob, filename: string) => void = triggerBrowserDownload
) {
	if (shapes.size === 0) {
		alert('Canvas is empty. Draw something before exporting.');
		return;
	}

	const exportData = {
		app: 'Mesh',
		version: '1.0.0',
		exportedAt: new Date().toISOString(),
		shapes: Array.from(shapes.values())
	};

	const blob = new Blob([JSON.stringify(exportData, null, 2)], {
		type: 'application/json;charset=utf-8'
	});
	downloadFn(blob, filename);
}

export function importFromJson(
	jsonString: string,
	baseZIndex: number,
	defaultStroke: string
): ShapeRecord[] | null {
	try {
		const parsed = JSON.parse(jsonString);
		const rawShapes = Array.isArray(parsed) ? parsed : parsed.shapes;
		if (!Array.isArray(rawShapes) || rawShapes.length === 0) {
			alert('No valid shapes found in JSON file.');
			return null;
		}

		const now = Date.now();
		let baseZ = baseZIndex;
		const importedShapes: ShapeRecord[] = [];

		for (const item of rawShapes) {
			if (!item.type || typeof item.x !== 'number' || typeof item.y !== 'number') {
				continue;
			}
			const shape: ShapeRecord = {
				id: 'shape_' + Math.random().toString(36).substring(2, 9),
				type: item.type,
				x: item.x,
				y: item.y,
				width: item.width || 50,
				height: item.height || 50,
				fill: item.fill || 'transparent',
				stroke: item.stroke || defaultStroke,
				strokeWidth: item.strokeWidth || 2,
				rotation: item.rotation || 0,
				zIndex: baseZ++,
				data: item.data,
				createdBy: '',
				updatedAt: now
			};
			importedShapes.push(shape);
		}

		return importedShapes.length > 0 ? importedShapes : null;
	} catch {
		alert('Invalid JSON file format.');
		return null;
	}
}
