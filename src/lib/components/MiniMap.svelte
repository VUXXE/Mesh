<script lang="ts">
	import { getShapeBounds } from '$lib/client/math';
	import type { CanvasEngine } from '$lib/client/canvas-engine';
	import type { ShapeRecord } from '$lib/types';

	interface Props {
		engine: CanvasEngine | null;
		shapes: Map<string, ShapeRecord>;
	}

	let { engine, shapes }: Props = $props();

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let isCollapsed = $state(false);

	const MM_WIDTH = 180;
	const MM_HEIGHT = 110;

	$effect(() => {
		if (canvasEl && shapes && !isCollapsed) {
			drawMinimap();
		}
	});

	function drawMinimap() {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		ctx.clearRect(0, 0, MM_WIDTH, MM_HEIGHT);

		if (shapes.size === 0) return;

		// Calculate total bounding box of all shapes
		let minX = -1000;
		let minY = -1000;
		let maxX = 1000;
		let maxY = 1000;

		for (const shape of shapes.values()) {
			const b = getShapeBounds(shape);
			if (b.minX < minX) minX = b.minX;
			if (b.minY < minY) minY = b.minY;
			if (b.maxX > maxX) maxX = b.maxX;
			if (b.maxY > maxY) maxY = b.maxY;
		}

		// Also include viewport
		if (engine) {
			const vp = engine.viewport;
			const vpLeft = -vp.panX / vp.zoom;
			const vpTop = -vp.panY / vp.zoom;
			const vpRight = vpLeft + window.innerWidth / vp.zoom;
			const vpBottom = vpTop + window.innerHeight / vp.zoom;

			if (vpLeft < minX) minX = vpLeft;
			if (vpTop < minY) minY = vpTop;
			if (vpRight > maxX) maxX = vpRight;
			if (vpBottom > maxY) maxY = vpBottom;
		}

		const totalW = Math.max(maxX - minX, 100);
		const totalH = Math.max(maxY - minY, 100);

		const scaleX = MM_WIDTH / totalW;
		const scaleY = MM_HEIGHT / totalH;
		const scale = Math.min(scaleX, scaleY) * 0.9;

		const offsetX = (MM_WIDTH - totalW * scale) / 2 - minX * scale;
		const offsetY = (MM_HEIGHT - totalH * scale) / 2 - minY * scale;

		// Draw shapes
		ctx.fillStyle = '#71717a'; // zinc-500
		for (const shape of shapes.values()) {
			const b = getShapeBounds(shape);
			const x = b.minX * scale + offsetX;
			const y = b.minY * scale + offsetY;
			const w = Math.max(b.width * scale, 2);
			const h = Math.max(b.height * scale, 2);
			ctx.fillRect(x, y, w, h);
		}

		// Draw viewport indicator
		if (engine) {
			const vp = engine.viewport;
			const vpX = (-vp.panX / vp.zoom) * scale + offsetX;
			const vpY = (-vp.panY / vp.zoom) * scale + offsetY;
			const vpW = (window.innerWidth / vp.zoom) * scale;
			const vpH = (window.innerHeight / vp.zoom) * scale;

			ctx.strokeStyle = '#6366f1'; // electric indigo
			ctx.lineWidth = 1.5;
			ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
			ctx.fillRect(vpX, vpY, vpW, vpH);
			ctx.strokeRect(vpX, vpY, vpW, vpH);
		}
	}

	function handleMinimapClick(e: MouseEvent) {
		if (!engine || !canvasEl || shapes.size === 0) return;
		const rect = canvasEl.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const clickY = e.clientY - rect.top;

		let minX = -1000;
		let minY = -1000;
		let maxX = 1000;
		let maxY = 1000;

		for (const shape of shapes.values()) {
			const b = getShapeBounds(shape);
			if (b.minX < minX) minX = b.minX;
			if (b.minY < minY) minY = b.minY;
			if (b.maxX > maxX) maxX = b.maxX;
			if (b.maxY > maxY) maxY = b.maxY;
		}

		const totalW = Math.max(maxX - minX, 100);
		const totalH = Math.max(maxY - minY, 100);
		const scale = Math.min(MM_WIDTH / totalW, MM_HEIGHT / totalH) * 0.9;
		const offsetX = (MM_WIDTH - totalW * scale) / 2 - minX * scale;
		const offsetY = (MM_HEIGHT - totalH * scale) / 2 - minY * scale;

		const targetWorldX = (clickX - offsetX) / scale;
		const targetWorldY = (clickY - offsetY) / scale;

		engine.viewport.panX = window.innerWidth / 2 - targetWorldX * engine.viewport.zoom;
		engine.viewport.panY = window.innerHeight / 2 - targetWorldY * engine.viewport.zoom;
		engine.renderBuffer();
		engine.renderOverlay();
		drawMinimap();
	}
</script>

<div class="fixed right-4 bottom-6 z-20 select-none">
	{#if isCollapsed}
		<button
			onclick={() => (isCollapsed = false)}
			class="rounded-lg border border-[#27272a] bg-[#18181b] p-2 text-[#a1a1aa] shadow-lg transition-colors hover:text-[#f4f4f5] focus:outline-none"
			title="Expand Minimap"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
			</svg>
		</button>
	{:else}
		<div
			class="relative rounded-xl border border-[#27272a] bg-[#18181b] p-2 shadow-2xl backdrop-blur-md"
		>
			<div class="flex items-center justify-between px-0.5 pb-1.5">
				<span class="text-[11px] font-medium text-[#a1a1aa]">Radar</span>
				<button
					onclick={() => (isCollapsed = true)}
					class="text-xs text-[#a1a1aa] hover:text-[#f4f4f5] focus:outline-none"
					title="Minimize"
				>
					×
				</button>
			</div>

			<canvas
				bind:this={canvasEl}
				width={MM_WIDTH}
				height={MM_HEIGHT}
				onclick={handleMinimapClick}
				class="cursor-pointer rounded-lg border border-[#27272a] bg-[#121214]"
			></canvas>
		</div>
	{/if}
</div>
