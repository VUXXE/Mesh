<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import Canvas from '$lib/components/Canvas.svelte';
	import MiniMap from '$lib/components/MiniMap.svelte';
	import PresenceBar from '$lib/components/PresenceBar.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import logo from '$lib/assets/logo.png';
	import { CanvasEngine } from '$lib/client/canvas-engine';
	import { RoomSocket } from '$lib/client/websocket.svelte';
	import { HistoryManager, type HistoryAction } from '$lib/client/history.svelte';
	import type { ShapeRecord } from '$lib/types';

	const roomId = page.params.id ?? '';
	const isValidRoomId = /^[a-zA-Z0-9_-]{3,64}$/.test(roomId);

	let socket = $state<RoomSocket | null>(null);
	let engine = $state<CanvasEngine | null>(null);
	let selectedIds = $state<string[]>([]);
	const history = new HistoryManager();

	onMount(() => {
		if (!isValidRoomId) return;

		socket = new RoomSocket(roomId);

		const handleKeyDown = (e: KeyboardEvent) => {
			// Don't capture when typing in text inputs or modals
			const target = e.target as HTMLElement;
			if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
				return;
			}

			if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
				e.preventDefault();
				if (e.shiftKey) {
					handleRedo();
				} else {
					handleUndo();
				}
				return;
			}

			if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
				e.preventDefault();
				handleRedo();
				return;
			}

			if (e.key === 'v' || e.key === 'V') {
				engine?.setTool('select');
			} else if (e.key === 'p' || e.key === 'P') {
				engine?.setTool('pen');
			} else if (e.key === 'l' || e.key === 'L') {
				engine?.setTool('line');
			} else if (e.key === 'a' || e.key === 'A') {
				engine?.setTool('arrow');
			} else if (e.key === 'r' || e.key === 'R') {
				engine?.setTool('rectangle');
			} else if (e.key === 'e' || e.key === 'E') {
				engine?.setTool('ellipse');
			} else if (e.key === 't' || e.key === 'T') {
				engine?.setTool('text');
			} else if (e.key === 's' || e.key === 'S') {
				engine?.setTool('sticky_note');
			} else if (e.key === 'Delete' || e.key === 'Backspace') {
				engine?.deleteSelected();
			} else if (e.key === 'Escape') {
				engine?.setTool('select');
			}
		};

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			socket?.destroy();
		};
	});

	onDestroy(() => {
		socket?.destroy();
	});

	function handleShapesMutated(shapes: ShapeRecord[]) {
		socket?.upsertShapes(shapes);
	}

	function handleShapesDeleted(ids: string[]) {
		socket?.deleteShapes(ids);
	}

	function handleCursorMoved(pos: { x: number; y: number } | null) {
		socket?.sendPresence(pos, selectedIds);
	}

	function handleSelectionChanged(ids: string[]) {
		selectedIds = ids;
		socket?.sendPresence(null, ids);
	}

	function handleUpdateUserName(name: string) {
		socket?.setUserName(name);
	}

	function handleActionRecorded(action: HistoryAction) {
		history.push(action);
	}

	function handleUndo() {
		if (!socket) return;
		history.undo(
			(shapes) => socket!.upsertShapes(shapes),
			(ids) => socket!.deleteShapes(ids),
			() => socket!.clearCanvas()
		);
	}

	function handleRedo() {
		if (!socket) return;
		history.redo(
			(shapes) => socket!.upsertShapes(shapes),
			(ids) => socket!.deleteShapes(ids),
			() => socket!.clearCanvas()
		);
	}

	function handleClearCanvas() {
		if (confirm('Clear all drawings on this whiteboard?')) {
			const all = Array.from(socket?.shapes.values() ?? []).map((s) => ({ ...s }));
			if (all.length > 0) {
				history.push({ type: 'clear', shapes: all });
			}
			socket?.clearCanvas();
		}
	}
</script>

<svelte:head>
	<title>Mesh: Room {roomId}</title>
</svelte:head>

{#if !isValidRoomId}
	<div
		class="flex h-screen w-full flex-col items-center justify-center bg-[#121214] p-6 text-[#f4f4f5]"
	>
		<div
			class="max-w-sm rounded-2xl border border-[#27272a] bg-[#18181b] p-6 text-center shadow-xl"
		>
			<div
				class="mx-auto mb-4 h-12 w-12 overflow-hidden rounded-xl border border-[#27272a] shadow-md"
			>
				<img src={logo} alt="Mesh Logo" class="h-full w-full object-cover" />
			</div>
			<p class="mb-2 font-semibold text-rose-400">Invalid Room ID</p>
			<p class="mb-4 text-xs text-[#a1a1aa]">
				Room IDs must consist of 3-64 alphanumeric characters, underscores, or hyphens.
			</p>
			<a
				href="/"
				class="inline-block rounded-lg bg-[#27272a] px-4 py-2 text-xs font-medium transition-colors hover:bg-[#3f3f46]"
			>
				Back to Home
			</a>
		</div>
	</div>
{:else if socket}
	<div class="relative h-screen w-screen overflow-hidden bg-[#121214]">
		<!-- Top Left Brand / Return Home -->
		<a
			href="/"
			class="group fixed top-4 left-4 z-20 flex items-center gap-2 rounded-lg border border-[#27272a] bg-[#18181b]/90 px-2.5 py-1.5 shadow-lg backdrop-blur-md transition-colors select-none hover:border-[#3f3f46] hover:bg-[#27272a]"
			title="Back to Mesh Home"
		>
			<img
				src={logo}
				alt="Mesh Logo"
				class="h-5 w-5 rounded-md object-cover shadow-sm transition-transform group-hover:scale-105"
			/>
			<span class="text-xs font-semibold tracking-tight text-[#f4f4f5]">Mesh</span>
		</a>

		<!-- Top Presence & Room Header -->
		<PresenceBar
			{roomId}
			status={socket.status}
			currentUser={socket.currentUser}
			peers={socket.peers}
			onUpdateUserName={handleUpdateUserName}
		/>

		<!-- Reconnecting Notification Banner -->
		{#if socket.status === 'reconnecting'}
			<div
				class="fixed top-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/15 px-3.5 py-1.5 text-xs text-amber-300 shadow-lg backdrop-blur-md"
			>
				<span class="h-2 w-2 animate-ping rounded-full bg-amber-400"></span>
				<span>Connection lost. Reconnecting with exponential backoff...</span>
			</div>
		{/if}

		<!-- Dual Layer Vector Canvas -->
		<Canvas
			shapes={socket.shapes}
			peers={socket.peers}
			onShapesMutated={handleShapesMutated}
			onShapesDeleted={handleShapesDeleted}
			onCursorMoved={handleCursorMoved}
			onSelectionChanged={handleSelectionChanged}
			onActionRecorded={handleActionRecorded}
			bind:engine
		/>

		<!-- Bottom Floating Toolbar -->
		<Toolbar
			{engine}
			selectedCount={selectedIds.length}
			canUndo={history.canUndo}
			canRedo={history.canRedo}
			onUndo={handleUndo}
			onRedo={handleRedo}
			onClearCanvas={handleClearCanvas}
		/>

		<!-- Bottom-Right Radar Minimap -->
		<MiniMap {engine} shapes={socket.shapes} />
	</div>
{/if}
