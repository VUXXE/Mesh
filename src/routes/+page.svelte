<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import logo from '$lib/assets/logo.png';

	const REPO = 'VUXXE/Mesh';

	let joinRoomId = $state('');
	let errorMessage = $state('');
	let roomPassword = $state('');
	let passwordError = $state('');
	let starCount = $state<number | null>(null);

	function formatStars(n: number): string {
		if (n >= 1000) {
			const v = n / 1000;
			return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '')}k`;
		}
		return `${n}`;
	}

	onMount(() => {
		try {
			const cached = localStorage.getItem('mesh_gh_stars');
			const cachedAt = Number(localStorage.getItem('mesh_gh_stars_at') ?? 0);
			if (cached !== null && Date.now() - cachedAt < 3600000) {
				starCount = Number(cached);
				return;
			}
		} catch {
			// Ignore storage errors (private mode, etc.)
		}
		fetch(`https://api.github.com/repos/${REPO}`)
			.then((res) => (res.ok ? (res.json() as Promise<{ stargazers_count?: unknown }>) : null))
			.then((data) => {
				if (data && typeof data.stargazers_count === 'number') {
					starCount = data.stargazers_count;
					try {
						localStorage.setItem('mesh_gh_stars', String(starCount));
						localStorage.setItem('mesh_gh_stars_at', String(Date.now()));
					} catch {
						// Ignore storage errors (private mode, etc.)
					}
				}
			})
			.catch(() => {
				// Offline or rate-limited: pill still links to the repo
			});
	});

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
	class="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#121214] p-6 text-[#f4f4f5]"
>
	<a
		href="https://github.com/VUXXE/Mesh"
		target="_blank"
		rel="noopener noreferrer"
		class="fixed top-4 right-4 z-20 flex items-center gap-2 rounded-full border border-[#27272a] bg-[#18181b] py-1.5 pr-3.5 pl-3 shadow-lg backdrop-blur-md transition-all select-none hover:scale-105 hover:border-[#6366f1] focus:outline-none"
		title="Star Mesh on GitHub"
	>
		<svg class="h-4 w-4 text-[#f4f4f5]" viewBox="0 0 24 24" fill="currentColor">
			<path
				d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"
			/>
		</svg>
		<svg class="h-3.5 w-3.5 text-amber-300" viewBox="0 0 24 24" fill="currentColor">
			<path
				d="M12 2l2.94 6.26 6.86.8-5.07 4.7 1.35 6.74L12 17.27 5.92 20.5l1.35-6.74-5.07-4.7 6.86-.8L12 2z"
			/>
		</svg>
		{#if starCount !== null}
			<span class="text-xs font-semibold text-[#f4f4f5] tabular-nums">{formatStars(starCount)}</span
			>
		{:else}
			<span class="text-xs font-semibold text-[#a1a1aa]">Star</span>
		{/if}
	</a>
	<div class="w-full max-w-md rounded-2xl border border-[#27272a] bg-[#18181b] p-8 shadow-2xl">
		<!-- Brand & Logo -->
		<div class="mb-6 flex items-center gap-3">
			<div
				class="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#27272a] shadow-md"
			>
				<img src={logo} alt="Mesh Logo" class="h-full w-full object-cover" />
			</div>
			<div>
				<h1 class="text-xl font-bold tracking-tight text-[#f4f4f5]">Mesh</h1>
				<p class="text-xs text-[#a1a1aa]">Real-time collaborative vector whiteboard</p>
			</div>
		</div>

		<!-- GitHub repo badges -->
		<div class="mb-6 flex flex-wrap items-center gap-1.5">
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
					class="w-full rounded-xl border border-[#27272a] bg-[#121214] px-3.5 py-2.5 text-sm text-[#f4f4f5] placeholder-[#71717a] transition-all focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] focus:outline-none"
				/>
				{#if passwordError}
					<p class="mt-1 text-xs text-rose-400">{passwordError}</p>
				{/if}
			</div>
			<button
				onclick={createRoom}
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6366f1] px-4 py-3 font-medium text-white shadow-sm transition-colors hover:bg-[#4f46e5] focus:ring-2 focus:ring-[#6366f1] focus:ring-offset-2 focus:ring-offset-[#18181b] focus:outline-none"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="12" y1="5" x2="12" y2="19"></line>
					<line x1="5" y1="12" x2="19" y2="12"></line>
				</svg>
				<span>Create New Whiteboard</span>
			</button>

			<div class="my-4 flex items-center gap-3">
				<div class="h-px flex-1 bg-[#27272a]"></div>
				<span class="font-mono text-xs text-[#71717a] uppercase">or join existing</span>
				<div class="h-px flex-1 bg-[#27272a]"></div>
			</div>

			<!-- Action: Join Existing Room -->
			<form onsubmit={handleJoin} class="space-y-2">
				<div class="flex items-center gap-2">
					<input
						type="text"
						bind:value={joinRoomId}
						placeholder="e.g. room-abc123 or paste link"
						class="flex-1 rounded-xl border border-[#27272a] bg-[#121214] px-3.5 py-2.5 font-mono text-sm text-[#f4f4f5] placeholder-[#71717a] transition-all focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] focus:outline-none"
					/>
					<button
						type="submit"
						class="rounded-xl bg-[#27272a] px-4 py-2.5 text-sm font-medium text-[#f4f4f5] transition-colors hover:bg-[#3f3f46] focus:outline-none"
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
			class="mt-8 flex items-center justify-between border-t border-[#27272a] pt-6 text-[11px] text-[#71717a]"
		>
			<span>Cloudflare Workers + SQLite</span>
			<span>Sub-16ms feedback</span>
		</div>
	</div>
</main>
