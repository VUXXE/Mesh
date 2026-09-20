<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import Canvas from '$lib/components/Canvas.svelte';
	import MermaidModal from '$lib/components/MermaidModal.svelte';
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
	let authPassword = $state('');
	let passwordClaimed = false;
	let isMermaidModalOpen = $state(false);
	const history = new HistoryManager();

	function getViewportCenter(): { x: number; y: number } {
		if (!engine) return { x: 0, y: 0 };
		const w = typeof window !== 'undefined' ? window.innerWidth : 1920;
		const h = typeof window !== 'undefined' ? window.innerHeight : 1080;
		return {
			x: Math.round((w / 2 - engine.viewport.panX) / engine.viewport.zoom),
			y: Math.round((h / 2 - engine.viewport.panY) / engine.viewport.zoom)
		};
	}

	onMount(() => {
		if (!isValidRoomId) return;

		socket = new RoomSocket(roomId);

		const handleKeyDown = (e: KeyboardEvent) => {
			// Don't capture when typing in text inputs or modals
			const target = e.target as HTMLElement;
			if (
				target &&
				(target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
			) {
				return;
			}

			const isMod = e.ctrlKey || e.metaKey;

			if (isMod && (e.key === 'z' || e.key === 'Z')) {
				e.preventDefault();
				if (e.shiftKey) {
					handleRedo();
				} else {
					handleUndo();
				}
				return;
			}

			if (isMod && (e.key === 'y' || e.key === 'Y')) {
				e.preventDefault();
				handleRedo();
				return;
			}

			if (isMod && (e.key === 'c' || e.key === 'C')) {
				e.preventDefault();
				engine?.copySelected();
				return;
			}

			if (isMod && (e.key === 'x' || e.key === 'X')) {
				e.preventDefault();
				engine?.cutSelected();
				return;
			}

			if (isMod && (e.key === 'v' || e.key === 'V')) {
				// Allow native browser 'paste' event to fire naturally!
				// Native 'paste' event provides direct, synchronous, popup-free clipboard access.
				return;
			}

			if (isMod && (e.key === 'd' || e.key === 'D')) {
				e.preventDefault();
				engine?.duplicateSelected();
				return;
			}

			if (isMod && (e.key === 'a' || e.key === 'A')) {
				e.preventDefault();
				engine?.selectAll();
				return;
			}

			if (isMod && (e.key === 'm' || e.key === 'M')) {
				e.preventDefault();
				isMermaidModalOpen = true;
				return;
			}

			if (isMod && e.key === ']') {
				e.preventDefault();
				engine?.bringToFront();
				return;
			}

			if (isMod && e.key === '[') {
				e.preventDefault();
				engine?.sendToBack();
				return;
			}

			if (isMod && (e.key === "'" || e.key === '"')) {
				e.preventDefault();
				if (engine) {
					if (engine.gridMode === 'none') {
						engine.setGridMode('dots');
						engine.setSnapToGrid(true);
					} else {
						engine.toggleSnapToGrid();
					}
				}
				return;
			}

			if (!isMod && !e.altKey) {
				if (e.key === ']') {
					e.preventDefault();
					engine?.bringForward();
					return;
				}
				if (e.key === '[') {
					e.preventDefault();
					engine?.sendBackward();
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
				} else if (e.key === 'd' || e.key === 'D') {
					engine?.setTool('diamond');
				} else if (e.key === 'e' || e.key === 'E') {
					engine?.setTool('ellipse');
				} else if (e.key === 't' || e.key === 'T') {
					engine?.setTool('text');
				} else if (e.key === 's' || e.key === 'S') {
					engine?.setTool('sticky_note');
				} else if (e.key === 'm' || e.key === 'M') {
					isMermaidModalOpen = true;
				} else if (e.key === 'Delete' || e.key === 'Backspace') {
					engine?.deleteSelected();
				} else if (e.key === 'Escape') {
					engine?.setTool('select');
				} else if (e.key === 'Enter') {
					if (selectedIds.length === 1) {
						const shape = engine?.getShape(selectedIds[0]);
						if (
							shape &&
							(shape.type === 'sticky_note' ||
								shape.type === 'text' ||
								shape.type === 'rectangle' ||
								shape.type === 'ellipse' ||
								(shape.type === 'path' && shape.data?.isDiamond))
						) {
							e.preventDefault();
							engine?.startTextEdit(shape);
						}
					}
				}
			}
		};

		const handlePaste = (e: ClipboardEvent) => {
			const target = e.target as HTMLElement;
			if (
				target &&
				(target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
			) {
				return;
			}
			const text = e.clipboardData?.getData('text/plain');
			if (text) {
				try {
					const parsed = JSON.parse(text);
					if (
						parsed &&
						parsed.type === 'mesh/shapes' &&
						Array.isArray(parsed.shapes) &&
						parsed.shapes.length > 0
					) {
						e.preventDefault();
						engine?.pasteShapes(parsed.shapes);
						return;
					}
				} catch {
					// Not valid mesh JSON
				}

				if (text.trim()) {
					e.preventDefault();
					engine?.pastePlainText(text);
					return;
				}
			}
			if (engine?.hasClipboard()) {
				e.preventDefault();
				engine.pasteShapes(engine.getClipboard());
			}
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				socket?.sendPresence(null, selectedIds);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('paste', handlePaste);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('paste', handlePaste);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
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

	function handleUpdateUserColor(color: string) {
		socket?.setUserColor(color);
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

	// Claim a password stashed by the landing page and set it once connected
	$effect(() => {
		if (passwordClaimed || !socket || socket.status !== 'connected') return;
		let pending: string | null = null;
		try {
			pending = sessionStorage.getItem(`mesh_new_room_pw_${roomId}`);
			if (pending) sessionStorage.removeItem(`mesh_new_room_pw_${roomId}`);
		} catch {
			// Ignore storage errors (private mode, etc.)
		}
		passwordClaimed = true;
		if (pending) socket.setRoomPassword(pending);
	});

	function handleAuthSubmit(e: Event) {
		e.preventDefault();
		socket?.authenticate(authPassword);
	}
</script>

<svelte:head>
	<title>Mesh: Room {roomId}</title>
</svelte:head>

{#if !isValidRoomId}
	<div
		class="flex h-screen w-full flex-col items-center justify-center bg-(--surface-0) p-6 text-(--ink-1)"
	>
		<div
			class="max-w-sm rounded-2xl border border-(--surface-2) bg-(--surface-1) p-6 text-center shadow-xl"
		>
			<div
				class="mx-auto mb-4 h-12 w-12 overflow-hidden rounded-xl border border-(--surface-2) shadow-md"
			>
				<img src={logo} alt="Mesh Logo" class="h-full w-full object-cover" />
			</div>
			<p class="mb-2 font-semibold text-rose-400">Invalid Room ID</p>
			<p class="mb-4 text-xs text-(--ink-2)">
				Room IDs must consist of 3-64 alphanumeric characters, underscores, or hyphens.
			</p>
			<a
				href="/"
				class="inline-block rounded-lg bg-(--surface-2) px-4 py-2 text-xs font-medium transition-colors hover:bg-(--surface-3)"
			>
				Back to Home
			</a>
		</div>
	</div>
{:else if socket}
	<div class="relative h-screen w-screen overflow-hidden bg-(--surface-0)">
		<!-- Top Left Brand / Return Home -->
		<a
			href="/"
			class="group fixed top-4 left-4 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-(--surface-2) bg-(--surface-1)/90 shadow-lg backdrop-blur-md transition-all select-none hover:border-(--surface-3) hover:bg-(--surface-2) focus:outline-none"
			title="Back to Mesh Home"
			aria-label="Back to Mesh Home"
		>
			<img
				src={logo}
				alt="Mesh Logo"
				class="h-5.5 w-5.5 rounded-md object-cover shadow-sm transition-transform group-hover:scale-105"
			/>
		</a>

		<!-- Top Presence & Room Header -->
		<PresenceBar
			{roomId}
			status={socket.status}
			currentUser={socket.currentUser}
			peers={socket.peers}
			locked={socket.authRequired}
			{engine}
			onUpdateUserName={handleUpdateUserName}
			onUpdateUserColor={handleUpdateUserColor}
		/>

		<!-- Reconnecting Notification Banner -->
		{#if socket.status === 'reconnecting'}
			<div
				class="fixed top-4 left-1/2 z-30 flex h-9 -translate-x-1/2 items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/15 px-3.5 text-xs text-amber-300 shadow-lg backdrop-blur-md"
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
			onOpenMermaid={() => (isMermaidModalOpen = true)}
		/>

		<!-- Bottom-Right Radar Minimap -->
		<MiniMap {engine} shapes={socket.shapes} />

		<!-- Mermaid Flowchart Generator Modal -->
		<MermaidModal
			isOpen={isMermaidModalOpen}
			onClose={() => (isMermaidModalOpen = false)}
			onInsertShapes={(newShapes) => {
				engine?.insertBatchShapes(newShapes);
			}}
			viewportCenter={getViewportCenter()}
			startZIndex={engine?.getNextZIndex() ?? 1}
		/>

		<!-- Password Gate -->
		{#if socket.authRequired && !socket.authed}
			<div
				class="fixed inset-0 z-40 flex items-center justify-center bg-(--surface-0)/80 p-6 backdrop-blur-sm"
			>
				<div
					class="w-full max-w-sm rounded-2xl border border-(--surface-2) bg-(--surface-1) p-6 text-center shadow-2xl"
				>
					<div
						class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-(--surface-2) bg-(--surface-0)"
					>
						<svg
							class="h-5 w-5 text-(--ink-2)"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<rect x="3" y="11" width="18" height="11" rx="2" />
							<path d="M7 11V7a5 5 0 0 1 10 0v4" />
						</svg>
					</div>
					<p class="mb-1 font-semibold text-(--ink-1)">This room is locked</p>
					<p class="mb-4 text-xs text-(--ink-2)">Enter the room password to join.</p>
					<form onsubmit={handleAuthSubmit} class="space-y-2">
						<input
							type="password"
							bind:value={authPassword}
							placeholder="Room password"
							autocomplete="current-password"
							class="w-full rounded-xl border border-(--surface-2) bg-(--surface-0) px-3.5 py-2.5 text-sm text-(--ink-1) placeholder-(--ink-3) transition-all focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] focus:outline-none"
						/>
						{#if socket.authError}
							<p class="text-xs text-rose-400">{socket.authError}</p>
						{/if}
						<button
							type="submit"
							class="w-full rounded-xl bg-[#6366f1] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4f46e5] focus:outline-none"
						>
							Unlock Room
						</button>
					</form>
				</div>
			</div>
		{/if}
	</div>
{/if}
