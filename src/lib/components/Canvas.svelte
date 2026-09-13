<script lang="ts">
	import { onMount } from 'svelte';
	import { CanvasEngine, type ViewportState } from '$lib/client/canvas-engine';
	import type { PeerPresence, ShapeRecord } from '$lib/types';
	import type { HistoryAction } from '$lib/client/history.svelte';

	interface Props {
		shapes: Map<string, ShapeRecord>;
		peers: PeerPresence[];
		onShapesMutated: (shapes: ShapeRecord[]) => void;
		onShapesDeleted: (ids: string[]) => void;
		onCursorMoved: (pos: { x: number; y: number } | null) => void;
		onSelectionChanged: (selectedIds: string[]) => void;
		onActionRecorded?: (action: HistoryAction) => void;
		engine: CanvasEngine | null;
	}

	let {
		shapes,
		peers,
		onShapesMutated,
		onShapesDeleted,
		onCursorMoved,
		onSelectionChanged,
		onActionRecorded,
		engine = $bindable(null)
	}: Props = $props();

	let staticCanvas: HTMLCanvasElement;
	let overlayCanvas: HTMLCanvasElement;
	let viewport = $state<ViewportState>({ panX: 0, panY: 0, zoom: 1 });

	onMount(() => {
		const createdEngine = new CanvasEngine(staticCanvas, overlayCanvas);
		createdEngine.onShapesMutated = onShapesMutated;
		createdEngine.onShapesDeleted = onShapesDeleted;
		createdEngine.onCursorMoved = onCursorMoved;
		createdEngine.onSelectionChanged = onSelectionChanged;
		createdEngine.onActionRecorded = onActionRecorded;
		createdEngine.onViewportChanged = (vp) => {
			viewport = { ...vp };
		};

		engine = createdEngine;

		const handleResize = () => {
			createdEngine.resize();
		};
		window.addEventListener('resize', handleResize);

		const preventTouchZoom = (e: TouchEvent) => {
			if (e.touches.length > 1) {
				e.preventDefault();
			}
		};
		overlayCanvas.addEventListener('touchstart', preventTouchZoom, { passive: false });
		overlayCanvas.addEventListener('touchmove', preventTouchZoom, { passive: false });

		return () => {
			window.removeEventListener('resize', handleResize);
			overlayCanvas.removeEventListener('touchstart', preventTouchZoom);
			overlayCanvas.removeEventListener('touchmove', preventTouchZoom);
		};
	});

	$effect(() => {
		if (engine) {
			engine.setShapes(shapes);
		}
	});

	$effect(() => {
		if (engine) {
			engine.setPeers(peers);
		}
	});

	function handlePointerDown(e: PointerEvent) {
		overlayCanvas.setPointerCapture(e.pointerId);
		engine?.handlePointerDown(e);
	}

	function handlePointerMove(e: PointerEvent) {
		engine?.handlePointerMove(e);
	}

	function handlePointerUp(e: PointerEvent) {
		try {
			overlayCanvas.releasePointerCapture(e.pointerId);
		} catch {
			// Ignore if not captured
		}
		engine?.handlePointerUp(e);
	}

	function handleWheel(e: WheelEvent) {
		engine?.handleWheel(e);
	}

	function resetZoom() {
		engine?.resetZoom();
	}
</script>

<div class="relative h-full w-full touch-none overflow-hidden bg-[#121214] select-none">
	<!-- Static Committed Buffer Canvas -->
	<canvas bind:this={staticCanvas} class="pointer-events-none absolute inset-0"></canvas>

	<!-- Interactive 60fps Overlay Canvas -->
	<canvas
		bind:this={overlayCanvas}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
		onwheel={handleWheel}
		class="absolute inset-0 cursor-crosshair active:cursor-grabbing"
	></canvas>

	<!-- Empty Canvas Guidance (DESIGN.md §5, §6) -->
	{#if shapes.size === 0}
		<div class="pointer-events-none absolute inset-0 flex items-center justify-center select-none">
			<div
				class="rounded-lg border border-[#27272a] bg-[#18181b]/80 px-4 py-2.5 text-center shadow-lg backdrop-blur-sm"
			>
				<p class="text-sm font-medium text-[#f4f4f5]">Canvas is ready</p>
				<p class="mt-0.5 text-xs text-[#a1a1aa]">
					Press P to draw, R for rectangle, or S for sticky note
				</p>
			</div>
		</div>
	{/if}

	<!-- Zoom Display Pill (DESIGN.md §4 numbers monospace) -->
	<div
		class="absolute bottom-4 left-4 z-10 flex items-center gap-1.5 rounded-md border border-[#27272a] bg-[#18181b] px-2.5 py-1 text-xs text-[#a1a1aa] shadow-md"
	>
		<span class="font-mono text-[#f4f4f5] tabular-nums">{Math.round(viewport.zoom * 100)}%</span>
		{#if viewport.zoom !== 1 || viewport.panX !== 0 || viewport.panY !== 0}
			<button
				onclick={resetZoom}
				class="ml-1 text-[11px] text-[#6366f1] transition-colors hover:text-[#818cf8] focus:outline-none"
				title="Reset to 100%"
			>
				Reset
			</button>
		{/if}
	</div>
</div>
