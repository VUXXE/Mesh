<script lang="ts">
	import { goto } from '$app/navigation';
	import logo from '$lib/assets/logo.png';

	let joinRoomId = $state('');
	let errorMessage = $state('');
	let roomPassword = $state('');
	let passwordError = $state('');

	function generateRoomId(): string {
		const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
		let result = '';
		for (let i = 0; i < 6; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return `room-${result}`;
	}

	function createRoom() {
		passwordError = '';
		if (roomPassword && (roomPassword.length < 4 || roomPassword.length > 128)) {
			passwordError = 'Password must be 4-128 characters';
			return;
		}
		const newId = generateRoomId();
		if (roomPassword) {
			try {
				sessionStorage.setItem(`mesh_new_room_pw_${newId}`, roomPassword);
			} catch {
				// Ignore storage errors (private mode, etc.)
			}
		}
		goto(`/room/${newId}`);
	}

	function handleJoin(e: Event) {
		e.preventDefault();
		let trimmed = joinRoomId.trim();
		if (!trimmed) {
			errorMessage = 'Please enter a room code or link';
			return;
		}

		// Intelligently extract room code if full URL was pasted
		if (trimmed.includes('/room/')) {
			trimmed = trimmed.split('/room/').pop()?.split(/[?#/]/)[0] || trimmed;
		}

		if (!/^[a-zA-Z0-9_-]{3,64}$/.test(trimmed)) {
			errorMessage = 'Room ID must be 3-64 alphanumeric characters, underscores, or hyphens';
			return;
		}

		goto(`/room/${trimmed}`);
	}
</script>

<svelte:head>
	<title>Mesh: Serverless Real-Time Vector Whiteboard</title>
</svelte:head>

<main
	class="flex min-h-screen w-full flex-col items-center justify-center bg-(--surface-0) p-6 text-(--ink-1)"
>
	<div
		class="w-full max-w-md rounded-2xl border border-(--surface-2) bg-(--surface-1) p-8 shadow-2xl"
	>
		<!-- Brand & Logo -->
		<div class="mb-6 flex items-center gap-3">
			<div
				class="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-(--surface-2) shadow-md"
			>
				<img src={logo} alt="Mesh Logo" class="h-full w-full object-cover" />
			</div>
			<div>
				<h1 class="text-xl font-bold tracking-tight text-(--ink-1)">Mesh</h1>
				<p class="text-xs text-(--ink-2)">Real-time collaborative vector whiteboard</p>
			</div>
		</div>

		<!-- GitHub repo badges -->
		<div class="mb-6 flex flex-wrap items-center gap-1.5">
			<a
				href="https://github.com/VUXXE/Mesh"
				target="_blank"
				rel="noopener noreferrer"
				class="transition-opacity hover:opacity-80"
			>
				<img
					src="https://img.shields.io/github/stars/VUXXE/Mesh?style=flat-square&logo=github&logoColor=white&label=Stars"
					alt="GitHub stars"
					loading="lazy"
				/>
			</a>
			<a
				href="https://github.com/VUXXE/Mesh/fork"
				target="_blank"
				rel="noopener noreferrer"
				class="transition-opacity hover:opacity-80"
			>
				<img
					src="https://img.shields.io/github/forks/VUXXE/Mesh?style=flat-square&logo=github&logoColor=white"
					alt="GitHub forks"
					loading="lazy"
				/>
			</a>
			<a
				href="https://github.com/VUXXE/Mesh/issues"
				target="_blank"
				rel="noopener noreferrer"
				class="transition-opacity hover:opacity-80"
			>
				<img
					src="https://img.shields.io/github/issues/VUXXE/Mesh?style=flat-square&logo=github&logoColor=white"
					alt="GitHub issues"
					loading="lazy"
				/>
			</a>
			<a
				href="https://github.com/VUXXE/Mesh/blob/main/LICENSE"
				target="_blank"
				rel="noopener noreferrer"
				class="transition-opacity hover:opacity-80"
			>
				<img
					src="https://img.shields.io/github/license/VUXXE/Mesh?style=flat-square"
					alt="License"
					loading="lazy"
				/>
			</a>
			<img
				src="https://img.shields.io/github/last-commit/VUXXE/Mesh/main?style=flat-square&logo=github&logoColor=white"
				alt="Last commit"
				loading="lazy"
			/>
		</div>

		<!-- Action: Create Room -->
		<div class="space-y-4">
			<div class="space-y-2">
				<input
					type="password"
					bind:value={roomPassword}
					placeholder="Room password (optional)"
					autocomplete="new-password"
					class="w-full rounded-xl border border-(--surface-2) bg-(--surface-0) px-3.5 py-2.5 text-sm text-(--ink-1) placeholder-(--ink-3) transition-all focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] focus:outline-none"
				/>
				{#if passwordError}
					<p class="mt-1 text-xs text-rose-400">{passwordError}</p>
				{/if}
			</div>
			<button
				onclick={createRoom}
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6366f1] px-4 py-3 font-medium text-white shadow-sm transition-colors hover:bg-[#4f46e5] focus:ring-2 focus:ring-[#6366f1] focus:ring-offset-2 focus:ring-offset-(--surface-1) focus:outline-none"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="12" y1="5" x2="12" y2="19"></line>
					<line x1="5" y1="12" x2="19" y2="12"></line>
				</svg>
				<span>Create New Whiteboard</span>
			</button>

			<div class="my-4 flex items-center gap-3">
				<div class="h-px flex-1 bg-(--surface-2)"></div>
				<span class="font-mono text-xs text-(--ink-3) uppercase">or join existing</span>
				<div class="h-px flex-1 bg-(--surface-2)"></div>
			</div>

			<!-- Action: Join Existing Room -->
			<form onsubmit={handleJoin} class="space-y-2">
				<div class="flex items-center gap-2">
					<input
						type="text"
						bind:value={joinRoomId}
						placeholder="e.g. room-abc123 or paste link"
						class="flex-1 rounded-xl border border-(--surface-2) bg-(--surface-0) px-3.5 py-2.5 font-mono text-sm text-(--ink-1) placeholder-(--ink-3) transition-all focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] focus:outline-none"
					/>
					<button
						type="submit"
						class="rounded-xl bg-(--surface-2) px-4 py-2.5 text-sm font-medium text-(--ink-1) transition-colors hover:bg-(--surface-3) focus:outline-none"
					>
						Join
					</button>
				</div>

				{#if errorMessage}
					<p class="mt-1 text-xs text-rose-400">{errorMessage}</p>
				{/if}
			</form>
		</div>

		<!-- Specifications summary footer -->
		<div
			class="mt-8 flex items-center justify-between border-t border-(--surface-2) pt-6 text-[11px] text-(--ink-3)"
		>
			<span>Cloudflare Workers + SQLite</span>
			<span>Sub-16ms feedback</span>
		</div>
	</div>
</main>
