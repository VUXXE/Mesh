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
	let isLight = $state(false);

	function toggleTheme() {
		isLight = !isLight;
		if (typeof document !== 'undefined') {
			document.documentElement.classList.toggle('light', isLight);
		}
		try {
			localStorage.setItem('mesh_theme', isLight ? 'light' : 'dark');
		} catch {
			// Ignore storage errors
		}
	}

	function formatStars(n: number): string {
		if (n >= 1000) {
			const v = n / 1000;
			return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '')}k`;
		}
		return `${n}`;
	}

	onMount(() => {
		if (typeof document !== 'undefined') {
			isLight = document.documentElement.classList.contains('light');
		}

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

<!-- Dot texture echoes the whiteboard canvas grid (product motif, not decoration) -->
<main
	class="landing-dots relative flex min-h-screen w-full flex-col items-center justify-center bg-(--surface-0) p-6 text-(--ink-1)"
>
	<!-- Top Left Back to Landing Link (Ghost Style) -->
	<a
		href="https://mesh.asy.web.id"
		class="fixed top-4 left-4 z-20 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-xs font-semibold text-(--ink-2) transition-all select-none hover:bg-(--surface-1) hover:text-(--ink-1) focus:outline-none"
		title="Back to Mesh Landing Page & Showcase"
	>
		<span>←</span>
		<span>mesh.asy.web.id</span>
	</a>

	<!-- Top Right Cluster: Theme Toggle & GitHub Star -->
	<div class="fixed top-4 right-4 z-20 flex items-center gap-2">
		<!-- Ghost Theme Toggle -->
		<button
			type="button"
			onclick={toggleTheme}
			aria-label="Toggle visual theme"
			class="group flex h-9 w-9 items-center justify-center rounded-lg text-(--ink-2) transition-all hover:bg-(--surface-1) hover:text-(--ink-1)"
		>
			{#if isLight}
				<svg
					class="h-4 w-4 transition-transform duration-300 group-hover:-rotate-12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
				</svg>
			{:else}
				<svg
					class="h-4 w-4 transition-transform duration-300 group-hover:rotate-45"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="5"></circle>
					<line x1="12" y1="1" x2="12" y2="3"></line>
					<line x1="12" y1="21" x2="12" y2="23"></line>
					<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
					<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
					<line x1="1" y1="12" x2="3" y2="12"></line>
					<line x1="21" y1="12" x2="23" y2="12"></line>
					<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
					<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
				</svg>
			{/if}
		</button>

		<a
			href="https://github.com/VUXXE/Mesh"
			target="_blank"
			rel="noopener noreferrer"
			class="flex items-center gap-2 rounded-full border border-(--surface-2) bg-(--surface-1) py-1.5 pr-3.5 pl-3 shadow-lg backdrop-blur-md transition-all select-none hover:scale-105 hover:border-[#6366f1] focus:outline-none"
			title="Star Mesh on GitHub"
		>
			<svg class="h-4 w-4 text-(--ink-1)" viewBox="0 0 24 24" fill="currentColor">
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
				<span class="text-xs font-semibold text-(--ink-1) tabular-nums">{formatStars(starCount)}</span>
			{:else}
				<span class="text-xs font-semibold text-(--ink-2)">Star</span>
			{/if}
		</a>
	</div>
	<div
		class="w-full max-w-md rounded-2xl border border-(--surface-2) bg-(--surface-1) p-8 shadow-2xl"
	>
		<!-- Brand -->
		<div class="mb-2 flex items-center gap-3">
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

		<p class="mb-5 text-sm leading-relaxed text-(--ink-2)">
			A fast, distraction-free whiteboard that lives on the edge. No accounts, no setup — create a
			room and start drawing together.
		</p>

		<!-- Honest capability ticks: everything listed is shipped -->
		<ul class="mb-6 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-(--ink-2)">
			<li class="flex items-center gap-1.5">
				<svg
					class="h-3.5 w-3.5 text-emerald-400"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<polyline points="20 6 9 17 4 12" />
				</svg>
				No sign-up
			</li>
			<li class="flex items-center gap-1.5">
				<svg
					class="h-3.5 w-3.5 text-emerald-400"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<polyline points="20 6 9 17 4 12" />
				</svg>
				Password-protected rooms
			</li>
			<li class="flex items-center gap-1.5">
				<svg
					class="h-3.5 w-3.5 text-emerald-400"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<polyline points="20 6 9 17 4 12" />
				</svg>
				Self-hostable with Docker
			</li>
		</ul>

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
				<span class="text-xs text-(--ink-3)">or join existing</span>
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

		<!-- Footer -->
		<div
			class="mt-8 flex items-center justify-between border-t border-(--surface-2) pt-6 text-[11px] text-(--ink-3)"
		>
			<img src="/made-by-white.svg" alt="Made by" class="madeby-dark h-5 w-auto" />
			<img src="/made-by-black.svg" alt="Made by" class="madeby-light h-5 w-auto" />
			<a
				href="https://github.com/VUXXE/Mesh"
				target="_blank"
				rel="noopener noreferrer"
				class="transition-colors hover:text-(--ink-1)">Open source (MIT)</a
			>
		</div>
	</div>
</main>

<style>
	.landing-dots {
		background-image: radial-gradient(circle, var(--grid-dot) 1px, transparent 1px);
		background-size: 28px 28px;
	}
	.madeby-light {
		display: none;
	}
	:global(html.light) .madeby-light {
		display: block;
	}
	:global(html.light) .madeby-dark {
		display: none;
	}
</style>
