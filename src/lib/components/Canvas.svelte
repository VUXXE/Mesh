<script lang="ts">
	import { onMount } from 'svelte';
	import { CanvasEngine, getFontFamilyCss, type ViewportState } from '$lib/client/canvas-engine';
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
	let activeTool = $state<string>('select');

	let editingShape = $state<ShapeRecord | null>(null);
	let editText = $state('');
	let editTextarea = $state<HTMLTextAreaElement | null>(null);

	const editBox = $derived.by(() => {
		if (!editingShape) return null;
		const isSticky = editingShape.type === 'sticky_note';
		const x = viewport.panX + editingShape.x * viewport.zoom;
		const y = viewport.panY + editingShape.y * viewport.zoom;
		let width = editingShape.width * viewport.zoom;
		let height = editingShape.height * viewport.zoom;
		const fontSize = isSticky
			? Math.max(14 * viewport.zoom, 10)
			: Math.max((editingShape.data?.fontSize || 18) * viewport.zoom, 12);
		const fontFamily = isSticky
			? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
			: getFontFamilyCss(editingShape.data?.fontFamily || 'sans');
		const padding = isSticky ? Math.max(12 * viewport.zoom, 8) : 6;

		if (!isSticky) {
			const lines = editText.split('\n');
			const maxLineLength = Math.max(...lines.map((l) => l.length), 1);
			const computedWidth = (maxLineLength + 2) * fontSize * 0.65;
			width = Math.max(width, computedWidth, 140 * viewport.zoom);
			height = Math.max(height, lines.length * fontSize * 1.4 + 12, 36 * viewport.zoom);
		}

		return {
			x,
			y,
			width,
			height,
			fontSize,
			fontFamily,
			padding,
			isSticky,
			color: isSticky ? '#18181b' : editingShape.stroke || '#f4f4f5',
			bg: isSticky ? '#fef08a' : 'rgba(24, 24, 27, 0.9)',
			borderColor: isSticky ? '#eab308' : '#6366f1'
		};
	});

	const canvasCursor = $derived.by(() => {
		if (editingShape) return 'cursor-default';
		switch (activeTool) {
			case 'select':
				return 'cursor-default';
			case 'pan':
				return 'cursor-grab active:cursor-grabbing';
			case 'text':
				return 'cursor-text';
			case 'sticky_note':
				return 'cursor-pointer';
			default:
				return 'cursor-crosshair';
		}
	});

	$effect(() => {
		if (editingShape && editTextarea) {
			requestAnimationFrame(() => {
				editTextarea?.focus();
				editTextarea?.select();
			});
		}
	});

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
		createdEngine.onStartTextEdit = (shape) => {
			editingShape = shape;
			editText = shape.data?.text || '';
		};
		createdEngine.onEndTextEdit = () => {
			editingShape = null;
		};
		createdEngine.onTextShapeStyleChanged = (shape) => {
			if (editingShape && editingShape.id === shape.id) {
				editingShape = shape;
			}
		};
		createdEngine.addToolChangedListener((t) => {
			activeTool = t;
		});

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

	function commitEdit() {
		if (!editingShape || !engine) return;

		const shapeId = editingShape.id;
		const currentShape = engine.getShape(shapeId);
		const shapeType = editingShape.type;
		const trimmed = editText.trim();

		// Clean up empty text shape
		if (shapeType === 'text' && trimmed === '') {
			if (currentShape) {
				engine.deleteShapeById(shapeId);
			}
			editingShape = null;
			engine.endTextEdit();
			engine.setTool('select');
			return;
		}

		if (currentShape) {
			const beforeShape = {
				...currentShape,
				data: currentShape.data ? { ...currentShape.data } : undefined
			};
			const updated: ShapeRecord = {
				...currentShape,
				data: {
					...currentShape.data,
					text: editText
				},
				updatedAt: Date.now()
			};

			// Auto expand sticky note height if text has many lines
			if (shapeType === 'sticky_note') {
				const lines = editText.split('\n');
				const minH = Math.max(updated.height, lines.length * 20 + 32);
				updated.height = minH;
			} else if (shapeType === 'text') {
				const fSize = updated.data?.fontSize || 18;
				const fFamily = updated.data?.fontFamily || 'sans';
				const bounds = engine.calculateTextBounds(editText, fSize, fFamily);
				updated.width = bounds.width;
				updated.height = bounds.height;
			}

			engine.updateShape(updated);
			onShapesMutated([updated]);
			onActionRecorded?.({
				type: 'modify',
				before: [beforeShape],
				after: [updated]
			});
		}

		editingShape = null;
		engine.endTextEdit();
		engine.setTool('select');
	}

	function handleTextareaKeyDown(e: KeyboardEvent) {
		e.stopPropagation();

		if (e.key === 'Escape') {
			e.preventDefault();
			commitEdit();
			return;
		}

		if (editBox?.isSticky) {
			if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				commitEdit();
			}
		} else {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				commitEdit();
			}
		}
	}

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

	function handlePointerLeave() {
		engine?.handlePointerLeave();
	}

	function handleDblClick(e: MouseEvent) {
		engine?.handleDblClick(e);
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
		onpointerleave={handlePointerLeave}
		ondblclick={handleDblClick}
		onwheel={handleWheel}
		class="absolute inset-0 {canvasCursor}"
	></canvas>

	<!-- Inline Text Editing Overlay for Sticky Notes & Text Shapes -->
	{#if editBox}
		<textarea
			bind:this={editTextarea}
			bind:value={editText}
			onkeydown={handleTextareaKeyDown}
			onblur={commitEdit}
			onpointerdown={(e) => e.stopPropagation()}
			onpointerup={(e) => e.stopPropagation()}
			onclick={(e) => e.stopPropagation()}
			placeholder={editBox.isSticky ? 'Type a note...' : 'Type text...'}
			style="position: absolute; left: {editBox.x}px; top: {editBox.y}px; width: {Math.max(
				editBox.width,
				editBox.isSticky ? 80 : 140
			)}px; height: {Math.max(
				editBox.height,
				editBox.isSticky ? 80 : 32
			)}px; font-size: {editBox.fontSize}px; padding: {editBox.padding}px; color: {editBox.color}; caret-color: {editBox.isSticky
				? '#18181b'
				: '#6366f1'}; background: {editBox.bg}; border: 1px solid {editBox.borderColor}; border-radius: {editBox.isSticky
				? '6px'
				: '4px'}; line-height: 1.3; font-family: {editBox.fontFamily}; resize: none; z-index: 30; outline: none; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);"
			class="overflow-auto select-text"></textarea>
	{/if}

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
