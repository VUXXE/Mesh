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
	let authPassword = $state('');
	let passwordClaimed = false;
	const history = new HistoryManager();

	let copiedCode = $state(false);
	let copiedLink = $state(false);

	function copyRoomCode() {
		if (typeof window === 'undefined') return;
		navigator.clipboard.writeText(roomId);
		copiedCode = true;
		setTimeout(() => (copiedCode = false), 2000);
	}

	function copyRoomLink() {
		if (typeof window === 'undefined') return;
		navigator.clipboard.writeText(window.location.href);
		copiedLink = true;
		setTimeout(() => (copiedLink = false), 2000);
	}

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
			} else if (e.key === 'Enter') {
				if (selectedIds.length === 1) {
					const shape = engine?.getShape(selectedIds[0]);
					if (shape && (shape.type === 'sticky_note' || shape.type === 'text')) {
						e.preventDefault();
						engine?.startTextEdit(shape);
					}
				}
			}
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				socket?.sendPresence(null, selectedIds);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
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
		<!-- Top Left Bar: Brand, Room Code & Share Action -->
		<div
			class="fixed top-4 left-4 z-20 flex h-9 items-center rounded-lg border border-(--surface-2) bg-(--surface-1)/90 px-2 shadow-sm backdrop-blur-md transition-colors select-none sm:px-2.5"
		>
			<!-- Home / Brand -->
			<a
				href="/"
				class="group flex items-center gap-2 rounded px-1.5 py-1 text-xs font-semibold tracking-tight text-(--ink-1) transition-colors hover:bg-(--surface-2)"
				title="Back to Mesh Home"
			>
				<img
					src={logo}
					alt="Mesh Logo"
					class="h-4.5 w-4.5 rounded object-cover shadow-xs transition-transform group-hover:scale-105"
				/>
				<span class="hidden font-bold sm:inline">Mesh</span>
			</a>

			<div class="mx-1.5 h-3.5 w-px bg-(--surface-2)"></div>

			<!-- Room ID with Click-to-copy Code -->
			<button
				type="button"
				onclick={copyRoomCode}
				class="flex items-center gap-1.5 rounded px-2 py-1 font-mono text-xs text-(--ink-2) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1)"
				title="Click to copy room code ({roomId})"
			>
				{#if socket.authRequired}
					<svg
						class="h-3 w-3 text-amber-400"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<rect x="3" y="11" width="18" height="11" rx="2" />
						<path d="M7 11V7a5 5 0 0 1 10 0v4" />
					</svg>
				{/if}
				<span>{roomId}</span>
				{#if copiedCode}
					<span class="font-sans text-[10px] font-bold text-emerald-400">Copied!</span>
				{:else}
					<svg
						class="h-3 w-3 text-(--ink-3)"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
						<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
					</svg>
				{/if}
			</button>

			<div class="mx-1.5 h-3.5 w-px bg-(--surface-2)"></div>

			<!-- Copy Invite Link / Share CTA -->
			<button
				type="button"
				onclick={copyRoomLink}
				class="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all {copiedLink
					? 'bg-emerald-500/20 text-emerald-400'
					: 'bg-(--ink-1) text-(--surface-0) hover:bg-(--ink-1)/90'}"
				title="Copy shareable invite link"
			>
				{#if copiedLink}
					<svg
						class="h-3 w-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<polyline points="20 6 9 17 4 12"></polyline>
					</svg>
					<span>Link Copied!</span>
				{:else}
					<svg
						class="h-3 w-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
						<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
					</svg>
					<span class="hidden sm:inline">Share</span>
				{/if}
			</button>
		</div>

		<!-- Top Presence & Room Header -->
		<PresenceBar
			status={socket.status}
			currentUser={socket.currentUser}
			peers={socket.peers}
			{engine}
			onUpdateUserName={handleUpdateUserName}
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
		/>

		<!-- Bottom-Right Radar Minimap -->
		<MiniMap {engine} shapes={socket.shapes} />

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
