import type { PathPoint, ShapeRecord, ShapeType } from '../types';
import { calculateOrthogonalPath, type AnchorSide } from './math';

export interface ParsedMermaidResult {
	shapes: ShapeRecord[];
	error?: string;
}

interface NodeDef {
	id: string;
	label: string;
	shapeType: 'rectangle' | 'ellipse' | 'diamond';
	x?: number;
	y?: number;
	width: number;
	height: number;
}

interface EdgeDef {
	sourceId: string;
	targetId: string;
	label?: string;
}

/**
 * Parses Mermaid flowchart syntax and converts it to positioned Mesh ShapeRecord objects.
 */
export function parseMermaidToShapes(
	code: string,
	centerWorld: { x: number; y: number } = { x: 0, y: 0 },
	startZIndex = 1
): ParsedMermaidResult {
	const lines = code
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && !l.startsWith('%%'));

	if (lines.length === 0) {
		return { shapes: [], error: 'Input code is empty' };
	}

	let direction: 'LR' | 'TD' = 'TD';
	const nodes = new Map<string, NodeDef>();
	const edges: EdgeDef[] = [];

	function parseNodeToken(token: string): {
		id: string;
		label?: string;
		shapeType?: NodeDef['shapeType'];
	} {
		const trimmed = token.trim();
		// Database: [(Database)]
		const dbMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\[\((.*?)\)\]$/);
		if (dbMatch) {
			return { id: dbMatch[1], label: dbMatch[2], shapeType: 'rectangle' };
		}
		// Diamond: {Decision?}
		const diamondMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\{(.*?)\}$/);
		if (diamondMatch) {
			return { id: diamondMatch[1], label: diamondMatch[2], shapeType: 'diamond' };
		}
		// Capsule / Pill / Circle: ([Text]) or ((Text))
		const capsuleMatch =
			trimmed.match(/^([a-zA-Z0-9_-]+)\(\((.*?)\)\)$/) ||
			trimmed.match(/^([a-zA-Z0-9_-]+)\(\[(.*?)\]\)$/);
		if (capsuleMatch) {
			return { id: capsuleMatch[1], label: capsuleMatch[2], shapeType: 'ellipse' };
		}
		// Rounded / Ellipse: (Text)
		const roundedMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\((.*?)\)$/);
		if (roundedMatch) {
			return { id: roundedMatch[1], label: roundedMatch[2], shapeType: 'ellipse' };
		}
		// Rectangle: [Text]
		const rectMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\[(.*?)\]$/);
		if (rectMatch) {
			return { id: rectMatch[1], label: rectMatch[2], shapeType: 'rectangle' };
		}
		// Bare ID
		const idMatch = trimmed.match(/^([a-zA-Z0-9_-]+)$/);
		if (idMatch) {
			return { id: idMatch[1] };
		}
		return { id: trimmed };
	}

	function ensureNode(token: string): string {
		const parsed = parseNodeToken(token);
		const id = parsed.id;
		if (!nodes.has(id)) {
			nodes.set(id, {
				id,
				label: parsed.label ?? id,
				shapeType: parsed.shapeType ?? 'rectangle',
				width: parsed.shapeType === 'diamond' ? 140 : 130,
				height: parsed.shapeType === 'diamond' ? 80 : 60
			});
		} else if (parsed.label || parsed.shapeType) {
			const existing = nodes.get(id)!;
			if (parsed.label) existing.label = parsed.label;
			if (parsed.shapeType) {
				existing.shapeType = parsed.shapeType;
				existing.width = parsed.shapeType === 'diamond' ? 140 : 130;
				existing.height = parsed.shapeType === 'diamond' ? 80 : 60;
			}
		}
		return id;
	}

	for (const line of lines) {
		// Header check
		const headerMatch = line.match(/^(?:flowchart|graph)\s+(TD|TB|LR|RL|BT)/i);
		if (headerMatch) {
			const dir = headerMatch[1].toUpperCase();
			direction = dir === 'LR' || dir === 'RL' ? 'LR' : 'TD';
			continue;
		}

		if (line.startsWith('subgraph') || line === 'end') {
			continue;
		}

		// Check for links (e.g. A --> B or A -->|label| B or A --- B)
		const arrowRegex = /(-->|---|-.->)(?:\|(.*?)\|)?/g;
		let match: RegExpExecArray | null;
		const splitIndices: { index: number; length: number; label?: string }[] = [];

		while ((match = arrowRegex.exec(line)) !== null) {
			splitIndices.push({
				index: match.index,
				length: match[0].length,
				label: match[2]
			});
		}

		if (splitIndices.length > 0) {
			let prevIndex = 0;
			const tokens: string[] = [];
			for (const s of splitIndices) {
				tokens.push(line.substring(prevIndex, s.index).trim());
				prevIndex = s.index + s.length;
			}
			tokens.push(line.substring(prevIndex).trim());

			for (let i = 0; i < splitIndices.length; i++) {
				const srcToken = tokens[i];
				const tgtToken = tokens[i + 1];
				if (srcToken && tgtToken) {
					const srcId = ensureNode(srcToken);
					const tgtId = ensureNode(tgtToken);
					edges.push({
						sourceId: srcId,
						targetId: tgtId,
						label: splitIndices[i].label
					});
				}
			}
		} else {
			// Single node line, e.g. A[Title]
			ensureNode(line);
		}
	}

	if (nodes.size === 0) {
		return { shapes: [], error: 'No valid nodes found in diagram code' };
	}

	// Layered Graph Ranking (DAG leveling via BFS)
	const inDegree = new Map<string, number>();
	const adj = new Map<string, string[]>();
	for (const id of nodes.keys()) {
		inDegree.set(id, 0);
		adj.set(id, []);
	}
	for (const edge of edges) {
		if (adj.has(edge.sourceId) && inDegree.has(edge.targetId)) {
			adj.get(edge.sourceId)!.push(edge.targetId);
			inDegree.set(edge.targetId, (inDegree.get(edge.targetId) ?? 0) + 1);
		}
	}

	const ranks = new Map<string, number>();
	const queue: string[] = [];
	for (const [id, deg] of inDegree.entries()) {
		if (deg === 0) {
			queue.push(id);
			ranks.set(id, 0);
		}
	}

	// Handle cyclic or disjoint graphs gracefully
	if (queue.length === 0) {
		const first = Array.from(nodes.keys())[0];
		queue.push(first);
		ranks.set(first, 0);
	}

	let visitedCount = 0;
	while (queue.length > 0) {
		const curr = queue.shift()!;
		visitedCount++;
		const currRank = ranks.get(curr) ?? 0;
		for (const next of adj.get(curr) ?? []) {
			const existingRank = ranks.get(next);
			if (existingRank === undefined || existingRank < currRank + 1) {
				ranks.set(next, currRank + 1);
				queue.push(next);
			}
		}
	}

	// Any unvisited nodes (disconnected components)
	for (const id of nodes.keys()) {
		if (!ranks.has(id)) {
			ranks.set(id, 0);
		}
	}

	// Group nodes by rank
	const rankGroups = new Map<number, string[]>();
	for (const [id, rank] of ranks.entries()) {
		if (!rankGroups.has(rank)) rankGroups.set(rank, []);
		rankGroups.get(rank)!.push(id);
	}

	const gapPrimary = 100;
	const gapSecondary = 60;

	// Calculate bounds
	const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b);
	let totalW = 0;
	let totalH = 0;

	const nodePositions = new Map<string, { x: number; y: number }>();

	if (direction === 'LR') {
		let curX = 0;
		for (const rank of sortedRanks) {
			const group = rankGroups.get(rank)!;
			const maxNodeW = Math.max(...group.map((id) => nodes.get(id)!.width));
			const groupTotalH =
				group.reduce((sum, id) => sum + nodes.get(id)!.height, 0) +
				(group.length - 1) * gapSecondary;

			let curY = -groupTotalH / 2;
			for (const id of group) {
				const n = nodes.get(id)!;
				nodePositions.set(id, { x: curX, y: curY });
				curY += n.height + gapSecondary;
			}
			curX += maxNodeW + gapPrimary;
			totalH = Math.max(totalH, groupTotalH);
		}
		totalW = curX - gapPrimary;
	} else {
		// TD (Top-Down)
		let curY = 0;
		for (const rank of sortedRanks) {
			const group = rankGroups.get(rank)!;
			const maxNodeH = Math.max(...group.map((id) => nodes.get(id)!.height));
			const groupTotalW =
				group.reduce((sum, id) => sum + nodes.get(id)!.width, 0) +
				(group.length - 1) * gapSecondary;

			let curX = -groupTotalW / 2;
			for (const id of group) {
				const n = nodes.get(id)!;
				nodePositions.set(id, { x: curX, y: curY });
				curX += n.width + gapSecondary;
			}
			curY += maxNodeH + gapPrimary;
			totalW = Math.max(totalW, groupTotalW);
		}
		totalH = curY - gapPrimary;
	}

	// Center shift
	const offsetX = Math.round(centerWorld.x - totalW / 2);
	const offsetY = Math.round(centerWorld.y - totalH / 2);

	const resultShapes: ShapeRecord[] = [];
	const now = Date.now();
	let currentZ = startZIndex;

	const createdNodeMap = new Map<string, ShapeRecord>();

	for (const [id, node] of nodes.entries()) {
		const pos = nodePositions.get(id) ?? { x: 0, y: 0 };
		const x = pos.x + offsetX;
		const y = pos.y + offsetY;
		const isDiamond = node.shapeType === 'diamond';

		let data: any = { text: node.label };
		if (isDiamond) {
			const points: PathPoint[] = [
				{ x: x + node.width / 2, y },
				{ x: x + node.width, y: y + node.height / 2 },
				{ x: x + node.width / 2, y: y + node.height },
				{ x, y: y + node.height / 2 },
				{ x: x + node.width / 2, y }
			];
			data = { isDiamond: true, points, text: node.label };
		}

		const shape: ShapeRecord = {
			id: 'mesh_' + Math.random().toString(36).substring(2, 9),
			type: (isDiamond ? 'path' : node.shapeType) as ShapeType,
			x,
			y,
			width: node.width,
			height: node.height,
			fill: isDiamond ? '#1e1b4b' : '#0f172a',
			stroke: isDiamond ? '#818cf8' : '#6366f1',
			strokeWidth: 2,
			rotation: 0,
			zIndex: currentZ++,
			data,
			createdBy: '',
			updatedAt: now
		};

		createdNodeMap.set(id, shape);
		resultShapes.push(shape);
	}

	// Create Arrow connectors
	for (const edge of edges) {
		const src = createdNodeMap.get(edge.sourceId);
		const tgt = createdNodeMap.get(edge.targetId);
		if (!src || !tgt) continue;

		const startSide: AnchorSide = direction === 'LR' ? 'right' : 'bottom';
		const endSide: AnchorSide = direction === 'LR' ? 'left' : 'top';

		const startPt =
			direction === 'LR'
				? { x: src.x + src.width, y: src.y + src.height / 2 }
				: { x: src.x + src.width / 2, y: src.y + src.height };
		const endPt =
			direction === 'LR'
				? { x: tgt.x, y: tgt.y + tgt.height / 2 }
				: { x: tgt.x + tgt.width / 2, y: tgt.y };

		const points = calculateOrthogonalPath(startPt, endPt, startSide, endSide);

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const p of points) {
			if (p.x < minX) minX = p.x;
			if (p.y < minY) minY = p.y;
			if (p.x > maxX) maxX = p.x;
			if (p.y > maxY) maxY = p.y;
		}

		const arrowShape: ShapeRecord = {
			id: 'mesh_' + Math.random().toString(36).substring(2, 9),
			type: 'path',
			x: minX,
			y: minY,
			width: Math.max(maxX - minX, 10),
			height: Math.max(maxY - minY, 10),
			fill: 'transparent',
			stroke: '#94a3b8',
			strokeWidth: 2,
			rotation: 0,
			zIndex: currentZ++,
			data: {
				isArrow: true,
				routing: 'orthogonal',
				points,
				startAnchor: { shapeId: src.id, side: startSide },
				endAnchor: { shapeId: tgt.id, side: endSide }
			},
			createdBy: '',
			updatedAt: now
		};

		resultShapes.push(arrowShape);
	}

	return { shapes: resultShapes };
}
