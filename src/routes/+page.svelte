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
	let activeTab = $state<'docker' | 'bun' | 'deploy'>('docker');
	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout> | null = null;

	// Simulated remote cursor animation state
	let hananCursor = $state({ x: 185, y: 110 });
	let mayaCursor = $state({ x: 395, y: 220 });

	function formatStars(n: number): string {
		if (n >= 1000) {
			const v = n / 1000;
			return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '')}k`;
		}
		return `${n}`;
	}

	function toggleTheme() {
		if (typeof document !== 'undefined') {
			isLight = document.documentElement.classList.toggle('light');
			try {
				localStorage.setItem('mesh_theme', isLight ? 'light' : 'dark');
			} catch {
				// Ignore storage errors
			}
		}
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
			// Ignore storage errors
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
						// Ignore storage errors
					}
				}
			})
			.catch(() => {
				// Offline or rate-limited
			});

		// Animate remote cursors softly on preview
		let angle = 0;
		const interval = setInterval(() => {
			angle += 0.04;
			hananCursor = {
				x: 185 + Math.cos(angle) * 24,
				y: 110 + Math.sin(angle * 1.5) * 16
			};
			mayaCursor = {
				x: 395 + Math.sin(angle * 0.8) * 20,
				y: 220 + Math.cos(angle * 1.2) * 14
			};
		}, 50);

		return () => clearInterval(interval);
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
				// Ignore storage errors
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

		if (trimmed.includes('/room/')) {
			trimmed = trimmed.split('/room/').pop()?.split(/[?#/]/)[0] || trimmed;
		}

		if (!/^[a-zA-Z0-9_-]{3,64}$/.test(trimmed)) {
			errorMessage = 'Room ID must be 3-64 alphanumeric characters, underscores, or hyphens';
			return;
		}

		goto(`/room/${trimmed}`);
	}

	const snippets = {
		docker: `git clone https://github.com/VUXXE/Mesh.git\ncd Mesh\ndocker compose up -d`,
		bun: `git clone https://github.com/VUXXE/Mesh.git\ncd Mesh\nbun install\nbun start`,
		deploy: `git clone https://github.com/VUXXE/Mesh.git\ncd Mesh\nbun install\nbun run deploy`
	};

	function copyCode(text: string) {
		if (navigator?.clipboard) {
			navigator.clipboard.writeText(text);
			copied = true;
			if (copyTimeout) clearTimeout(copyTimeout);
			copyTimeout = setTimeout(() => {
				copied = false;
			}, 2000);
		}
	}
</script>

<svelte:head>
	<title>Mesh: Serverless Real-Time Vector Whiteboard</title>
	<meta
		name="description"
		content="Fast, distraction-free collaborative vector whiteboard on Cloudflare Workers and Svelte 5. Sub-16ms drawing feedback, embedded SQLite, and 30Hz ephemeral presence."
	/>
</svelte:head>

<div
	class="h-screen w-screen overflow-y-auto bg-(--surface-0) text-(--ink-1) selection:bg-[#6366f1]/30"
>
	<!-- Navigation Header -->
	<header
		class="sticky top-0 z-30 border-b border-(--surface-2) bg-(--surface-0)/80 backdrop-blur-md transition-colors"
	>
		<div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
			<a href="/" class="flex items-center gap-3 focus:outline-none">
				<div class="h-9 w-9 overflow-hidden rounded-xl border border-(--surface-2) shadow-sm">
					<img src={logo} alt="Mesh Logo" class="h-full w-full object-cover" />
				</div>
				<div class="flex items-center gap-2">
					<span class="text-base font-bold tracking-tight text-(--ink-1)">Mesh</span>
					<span
						class="rounded-md border border-(--surface-2) bg-(--surface-1) px-1.5 py-0.5 font-mono text-[10px] text-(--ink-3)"
						>v1.0</span
					>
				</div>
			</a>

			<nav class="hidden items-center gap-6 text-xs font-medium text-(--ink-2) md:flex">
				<a href="#features" class="transition-colors hover:text-(--ink-1)">Features</a>
				<a href="#architecture" class="transition-colors hover:text-(--ink-1)">Architecture</a>
				<a href="#self-host" class="transition-colors hover:text-(--ink-1)">Self-Host</a>
				<a href="#tech-specs" class="transition-colors hover:text-(--ink-1)">Specs</a>
			</nav>

			<div class="flex items-center gap-3">
				<!-- Theme Toggle -->
				<button
					onclick={toggleTheme}
					type="button"
					class="flex h-8 w-8 items-center justify-center rounded-lg border border-(--surface-2) bg-(--surface-1) text-(--ink-2) transition-colors hover:border-[#6366f1] hover:text-(--ink-1) focus:ring-2 focus:ring-[#6366f1] focus:outline-none"
					title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
					aria-label="Toggle color theme"
				>
					{#if isLight}
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
						</svg>
					{:else}
						<svg
							class="h-4 w-4 text-amber-300"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
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

				<!-- GitHub Star Pill -->
				<a
					href="https://github.com/VUXXE/Mesh"
					target="_blank"
					rel="noopener noreferrer"
					class="flex items-center gap-1.5 rounded-lg border border-(--surface-2) bg-(--surface-1) px-3 py-1.5 text-xs font-semibold text-(--ink-1) transition-all hover:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1] focus:outline-none"
					title="Star Mesh on GitHub"
				>
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"
						/>
					</svg>
					<svg class="h-3.5 w-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M12 2l2.94 6.26 6.86.8-5.07 4.7 1.35 6.74L12 17.27 5.92 20.5l1.35-6.74-5.07-4.7 6.86-.8L12 2z"
						/>
					</svg>
					{#if starCount !== null}
						<span class="tabular-nums">{formatStars(starCount)}</span>
					{:else}
						<span>Star</span>
					{/if}
				</a>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-4 sm:px-6">
		<!-- HERO SECTION -->
		<section class="pt-12 pb-16 lg:pt-16 lg:pb-24">
			<!-- Announcement Badge -->
			<div class="mb-6 flex justify-center lg:justify-start">
				<div
					class="inline-flex items-center gap-2 rounded-full border border-(--surface-2) bg-(--surface-1) px-3.5 py-1 text-xs font-medium text-(--ink-2) shadow-xs"
				>
					<span class="flex h-2 w-2 rounded-full bg-emerald-400"></span>
					<span>Zero Accounts Required · Edge-Native SQLite</span>
				</div>
			</div>

			<!-- Headline & Subheading -->
			<div class="mb-12 max-w-3xl text-center lg:text-left">
				<h1
					class="text-3xl font-extrabold tracking-tight text-(--ink-1) sm:text-5xl sm:leading-tight lg:text-6xl"
				>
					Fast, distraction-free whiteboard on the edge.
				</h1>
				<p class="mt-4 text-base leading-relaxed text-(--ink-2) sm:text-lg">
					Built for engineers and designers. Sub-16ms vector input, 30Hz ephemeral presence, and
					embedded SQLite persistence. No sign-ups, no cookies, no tracking. Create a room and start
					collaborating in seconds.
				</p>
			</div>

			<!-- 2-Column Hero Grid: Launcher Card + Live Mockup Canvas -->
			<div class="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
				<!-- Column 1: Launcher Card (5 cols) -->
				<div
					class="rounded-2xl border border-(--surface-2) bg-(--surface-1) p-6 shadow-xl sm:p-7 lg:col-span-5"
				>
					<div class="mb-5">
						<h2 class="text-base font-bold tracking-tight text-(--ink-1)">Start a Session</h2>
						<p class="text-xs text-(--ink-2)">Create a clean room or jump into an existing code.</p>
					</div>

					<!-- Create Room Action -->
					<div class="space-y-3.5">
						<div>
							<label for="room-password" class="mb-1.5 block text-xs font-medium text-(--ink-2)">
								Room Password <span class="text-(--ink-3)">(optional)</span>
							</label>
							<input
								id="room-password"
								type="password"
								bind:value={roomPassword}
								placeholder="Set a password to lock this room"
								autocomplete="new-password"
								class="w-full rounded-xl border border-(--surface-2) bg-(--surface-0) px-3.5 py-2.5 text-sm text-(--ink-1) placeholder-(--ink-3) transition-all focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] focus:outline-none"
							/>
							{#if passwordError}
								<p class="mt-1 text-xs text-rose-400">{passwordError}</p>
							{/if}
						</div>

						<button
							onclick={createRoom}
							class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6366f1] px-4 py-3 font-semibold text-white shadow-sm transition-all hover:bg-[#4f46e5] focus:ring-2 focus:ring-[#6366f1] focus:ring-offset-2 focus:ring-offset-(--surface-1) focus:outline-none"
						>
							<svg
								class="h-4 w-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
							>
								<line x1="12" y1="5" x2="12" y2="19"></line>
								<line x1="5" y1="12" x2="19" y2="12"></line>
							</svg>
							<span>Create New Whiteboard</span>
						</button>

						<div class="my-4 flex items-center gap-3">
							<div class="h-px flex-1 bg-(--surface-2)"></div>
							<span class="text-[11px] font-medium tracking-wider text-(--ink-3) uppercase"
								>or join existing</span
							>
							<div class="h-px flex-1 bg-(--surface-2)"></div>
						</div>

						<!-- Join Form -->
						<form onsubmit={handleJoin} class="space-y-2">
							<div class="flex items-center gap-2">
								<input
									type="text"
									bind:value={joinRoomId}
									placeholder="room-abc123 or paste link"
									class="flex-1 rounded-xl border border-(--surface-2) bg-(--surface-0) px-3.5 py-2.5 font-mono text-sm text-(--ink-1) placeholder-(--ink-3) transition-all focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] focus:outline-none"
								/>
								<button
									type="submit"
									class="rounded-xl bg-(--surface-2) px-4 py-2.5 text-sm font-semibold text-(--ink-1) transition-colors hover:bg-(--surface-3) focus:ring-2 focus:ring-[#6366f1] focus:outline-none"
								>
									Join
								</button>
							</div>

							{#if errorMessage}
								<p class="mt-1 text-xs text-rose-400">{errorMessage}</p>
							{/if}
						</form>

						<!-- Honest Capabilities -->
						<div class="mt-5 border-t border-(--surface-2) pt-4">
							<ul class="space-y-1.5 text-xs text-(--ink-2)">
								<li class="flex items-center gap-2">
									<svg
										class="h-3.5 w-3.5 text-emerald-400"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
									<span>Zero sign-up or accounts required</span>
								</li>
								<li class="flex items-center gap-2">
									<svg
										class="h-3.5 w-3.5 text-emerald-400"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
									<span>Password encryption via PBKDF2-SHA256</span>
								</li>
								<li class="flex items-center gap-2">
									<svg
										class="h-3.5 w-3.5 text-emerald-400"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
									<span>Self-hostable anywhere with Docker</span>
								</li>
							</ul>
						</div>
					</div>
				</div>

				<!-- Column 2: Live Canvas Teaser Preview (7 cols) -->
				<div
					class="relative overflow-hidden rounded-2xl border border-(--surface-2) bg-(--surface-1) shadow-xl lg:col-span-7"
				>
					<!-- Fake Canvas Titlebar -->
					<div
						class="flex h-10 items-center justify-between border-b border-(--surface-2) bg-(--surface-0) px-4"
					>
						<div class="flex items-center gap-1.5">
							<span class="h-2.5 w-2.5 rounded-full bg-rose-500/80"></span>
							<span class="h-2.5 w-2.5 rounded-full bg-amber-500/80"></span>
							<span class="h-2.5 w-2.5 rounded-full bg-emerald-500/80"></span>
							<span class="ml-2 font-mono text-[11px] text-(--ink-3)">room-arch-v1</span>
						</div>
						<div class="flex items-center gap-2">
							<div
								class="flex items-center gap-1.5 rounded-md bg-(--surface-2) px-2 py-0.5 font-mono text-[10px] text-emerald-400"
							>
								<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"></span>
								<span>2 peers active</span>
							</div>
						</div>
					</div>

					<!-- Interactive Canvas Preview Body -->
					<div class="landing-dots relative h-[380px] w-full overflow-hidden p-6 select-none">
						<!-- Architecture Box 1: Browser Client -->
						<div
							class="absolute top-12 left-8 w-44 rounded-xl border border-[#6366f1] bg-(--surface-1) p-3 shadow-md"
						>
							<div class="flex items-center gap-2">
								<span class="h-2 w-2 rounded-full bg-[#6366f1]"></span>
								<span class="text-xs font-bold text-(--ink-1)">Svelte 5 Client</span>
							</div>
							<p class="mt-1 font-mono text-[10px] text-(--ink-3)">Dual-layer 60fps canvas</p>
							<div class="mt-2 flex items-center gap-1 font-mono text-[9px] text-emerald-400">
								<span>&lt;1ms local input</span>
							</div>
						</div>

						<!-- Connector Line 1: SVG Arrow -->
						<svg
							class="pointer-events-none absolute top-20 left-52 h-16 w-28 text-(--ink-3)"
							viewBox="0 0 112 64"
						>
							<defs>
								<marker
									id="arrowhead"
									markerWidth="6"
									markerHeight="6"
									refX="5"
									refY="3"
									orient="auto"
								>
									<polygon points="0 0, 6 3, 0 6" fill="currentColor" />
								</marker>
							</defs>
							<path
								d="M 4 20 L 100 20"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-dasharray="4 4"
								marker-end="url(#arrowhead)"
							/>
							<text x="24" y="14" fill="currentColor" font-size="9" font-family="monospace"
								>WS 101</text
							>
						</svg>

						<!-- Architecture Box 2: Cloudflare Durable Object -->
						<div
							class="absolute top-12 right-8 w-44 rounded-xl border border-cyan-500/60 bg-(--surface-1) p-3 shadow-md"
						>
							<div class="flex items-center gap-2">
								<span class="h-2 w-2 rounded-full bg-cyan-400"></span>
								<span class="text-xs font-bold text-(--ink-1)">Durable Object</span>
							</div>
							<p class="mt-1 font-mono text-[10px] text-(--ink-3)">WhiteboardRoom isolate</p>
							<div class="mt-2 flex items-center gap-1 font-mono text-[9px] text-cyan-400">
								<span>30Hz presence broadcast</span>
							</div>
						</div>

						<!-- Connector Line 2: Vertical arrow down to SQLite -->
						<svg
							class="pointer-events-none absolute top-36 right-28 h-20 w-16 text-(--ink-3)"
							viewBox="0 0 64 80"
						>
							<path
								d="M 32 4 L 32 64"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-dasharray="4 4"
								marker-end="url(#arrowhead)"
							/>
							<text x="36" y="38" fill="currentColor" font-size="9" font-family="monospace"
								>LWW</text
							>
						</svg>

						<!-- Architecture Box 3: Embedded SQLite -->
						<div
							class="absolute right-8 bottom-8 w-44 rounded-xl border border-emerald-500/60 bg-(--surface-1) p-3 shadow-md"
						>
							<div class="flex items-center gap-2">
								<span class="h-2 w-2 rounded-full bg-emerald-400"></span>
								<span class="text-xs font-bold text-(--ink-1)">Embedded SQLite</span>
							</div>
							<p class="mt-1 font-mono text-[10px] text-(--ink-3)">Monotonic conflict-free</p>
							<div class="mt-2 flex items-center gap-1 font-mono text-[9px] text-emerald-400">
								<span>Zero idle billing</span>
							</div>
						</div>

						<!-- Yellow Sticky Note Mockup -->
						<div
							class="absolute bottom-10 left-10 w-48 rotate-[-2deg] rounded-lg border border-amber-300 bg-amber-100 p-3 shadow-lg transition-transform hover:rotate-0"
						>
							<div class="mb-1 text-[11px] font-bold text-amber-900">Architecture Decision</div>
							<p class="text-[11px] leading-snug text-amber-800">
								Client-side RDP smoothing keeps edge isolates fast (≤2ms). Presence stays in-memory.
							</p>
						</div>

						<!-- Animated Remote Cursor 1: Hanan (Cyan) -->
						<div
							class="pointer-events-none absolute z-10 transition-all duration-75"
							style="transform: translate({hananCursor.x}px, {hananCursor.y}px);"
						>
							<svg
								class="h-5 w-5 text-cyan-400 drop-shadow-md"
								viewBox="0 0 24 24"
								fill="currentColor"
							>
								<path d="M4 0l16 12-7 1.5-4 8.5-3-1.5 4-8.5-6-1.5z" />
							</svg>
							<span
								class="ml-3 rounded-md bg-cyan-500 px-1.5 py-0.5 text-[10px] font-semibold text-black shadow-xs"
							>
								Hanan
							</span>
						</div>

						<!-- Animated Remote Cursor 2: Maya (Amber) -->
						<div
							class="pointer-events-none absolute z-10 transition-all duration-75"
							style="transform: translate({mayaCursor.x}px, {mayaCursor.y}px);"
						>
							<svg
								class="h-5 w-5 text-amber-400 drop-shadow-md"
								viewBox="0 0 24 24"
								fill="currentColor"
							>
								<path d="M4 0l16 12-7 1.5-4 8.5-3-1.5 4-8.5-6-1.5z" />
							</svg>
							<span
								class="ml-3 rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-black shadow-xs"
							>
								Maya
							</span>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- STATS / METRIC BAR -->
		<section class="border-y border-(--surface-2) py-8">
			<div class="grid grid-cols-2 gap-6 md:grid-cols-4">
				<div class="text-center sm:text-left">
					<p class="text-2xl font-black text-(--ink-1) tabular-nums sm:text-3xl">&lt; 16ms</p>
					<p class="mt-1 text-xs text-(--ink-2)">Input-to-render loop</p>
				</div>
				<div class="text-center sm:text-left">
					<p class="text-2xl font-black text-(--ink-1) tabular-nums sm:text-3xl">30 Hz</p>
					<p class="mt-1 text-xs text-(--ink-2)">Ephemeral presence stream</p>
				</div>
				<div class="text-center sm:text-left">
					<p class="text-2xl font-black text-(--ink-1) tabular-nums sm:text-3xl">50 Peers</p>
					<p class="mt-1 text-xs text-(--ink-2)">Max concurrent capacity</p>
				</div>
				<div class="text-center sm:text-left">
					<p class="text-2xl font-black text-(--ink-1) tabular-nums sm:text-3xl">Zero Idle</p>
					<p class="mt-1 text-xs text-(--ink-2)">WebSocket hibernation API</p>
				</div>
			</div>
		</section>

		<!-- BENTO GRID: FEATURES -->
		<section id="features" class="py-16 sm:py-24">
			<div class="mb-12 max-w-2xl">
				<h2 class="text-2xl font-extrabold tracking-tight text-(--ink-1) sm:text-3xl">
					Engineered for speed, built without bloat.
				</h2>
				<p class="mt-3 text-sm leading-relaxed text-(--ink-2)">
					Mesh strips away complex cloud dependencies and account gates, delivering a pure vector
					whiteboard that responds instantly.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				<!-- Feature 1: Vector Drawing -->
				<div class="rounded-2xl border border-(--surface-2) bg-(--surface-1) p-6 shadow-xs">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6366f1]/10 text-[#6366f1]"
					>
						<svg
							class="h-5 w-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M12 19l7-7 3 3-7 7-3-3z"></path>
							<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
							<path d="M2 2l7.586 7.586"></path>
							<circle cx="11" cy="11" r="2"></circle>
						</svg>
					</div>
					<h3 class="mt-4 text-base font-bold text-(--ink-1)">Sub-16ms Vector Engine</h3>
					<p class="mt-2 text-xs leading-relaxed text-(--ink-2)">
						Freehand pen drawing with client-side Ramer-Douglas-Peucker (RDP) trajectory smoothing.
						Dual-layer canvas isolates committed strokes from the 60fps interaction overlay.
					</p>
				</div>

				<!-- Feature 2: Ephemeral Presence -->
				<div class="rounded-2xl border border-(--surface-2) bg-(--surface-1) p-6 shadow-xs">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400"
					>
						<svg
							class="h-5 w-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
							<circle cx="9" cy="7" r="4"></circle>
							<path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
							<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
						</svg>
					</div>
					<h3 class="mt-4 text-base font-bold text-(--ink-1)">30Hz Ephemeral Presence</h3>
					<p class="mt-2 text-xs leading-relaxed text-(--ink-2)">
						Live remote cursors and active shape selections stream in memory at 30Hz. Presence
						packets never write to disk or pollute SQLite databases.
					</p>
				</div>

				<!-- Feature 3: Embedded SQLite -->
				<div class="rounded-2xl border border-(--surface-2) bg-(--surface-1) p-6 shadow-xs">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"
					>
						<svg
							class="h-5 w-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
							<path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
							<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
						</svg>
					</div>
					<h3 class="mt-4 text-base font-bold text-(--ink-1)">Monotonic LWW Storage</h3>
					<p class="mt-2 text-xs leading-relaxed text-(--ink-2)">
						Each whiteboard room is an isolated Durable Object with embedded SQLite. Updates
						reconcile via monotonic Last-Write-Wins timestamps with clock-skew clamping.
					</p>
				</div>

				<!-- Feature 4: Room Security -->
				<div class="rounded-2xl border border-(--surface-2) bg-(--surface-1) p-6 shadow-xs">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400"
					>
						<svg
							class="h-5 w-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
							<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
						</svg>
					</div>
					<h3 class="mt-4 text-base font-bold text-(--ink-1)">PBKDF2 Password Gates</h3>
					<p class="mt-2 text-xs leading-relaxed text-(--ink-2)">
						Protect rooms with salted PBKDF2-SHA256 passwords (100,000 iterations). Unauthenticated
						sockets are isolated from canvas shapes and presence data.
					</p>
				</div>

				<!-- Feature 5: Touch Gestures -->
				<div class="rounded-2xl border border-(--surface-2) bg-(--surface-1) p-6 shadow-xs">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400"
					>
						<svg
							class="h-5 w-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
							<line x1="12" y1="18" x2="12.01" y2="18"></line>
						</svg>
					</div>
					<h3 class="mt-4 text-base font-bold text-(--ink-1)">Touch, Pinch & MiniMap</h3>
					<p class="mt-2 text-xs leading-relaxed text-(--ink-2)">
						Native two-finger pinch-to-zoom and two-finger panning on mobile and trackpads.
						Real-time radar MiniMap lets you jump across large infinite diagrams.
					</p>
				</div>

				<!-- Feature 6: Backup & Export -->
				<div class="rounded-2xl border border-(--surface-2) bg-(--surface-1) p-6 shadow-xs">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400"
					>
						<svg
							class="h-5 w-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
							<polyline points="7 10 12 15 17 10"></polyline>
							<line x1="12" y1="15" x2="12" y2="3"></line>
						</svg>
					</div>
					<h3 class="mt-4 text-base font-bold text-(--ink-1)">Vector Export & Backups</h3>
					<p class="mt-2 text-xs leading-relaxed text-(--ink-2)">
						Export diagrams to high-resolution PNG, clean vector SVG for Figma or Illustrator, or
						portable JSON with one-click restoration.
					</p>
				</div>
			</div>
		</section>

		<!-- ARCHITECTURE DIAGRAM SECTION -->
		<section id="architecture" class="border-t border-(--surface-2) py-16 sm:py-24">
			<div class="mb-12 max-w-2xl">
				<h2 class="text-2xl font-extrabold tracking-tight text-(--ink-1) sm:text-3xl">
					Single-origin edge architecture.
				</h2>
				<p class="mt-3 text-sm leading-relaxed text-(--ink-2)">
					SSR pages, WebSocket endpoints, and Durable Objects live in the same Cloudflare Worker
					origin. No reverse proxies, no CORS configuration, no database connection pools.
				</p>
			</div>

			<div
				class="overflow-hidden rounded-2xl border border-(--surface-2) bg-(--surface-1) p-6 sm:p-8"
			>
				<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
					<!-- Step 1 -->
					<div class="rounded-xl border border-(--surface-2) bg-(--surface-0) p-5">
						<div class="font-mono text-xs font-semibold text-[#6366f1]">01 / CLIENT TIER</div>
						<h3 class="mt-2 text-sm font-bold text-(--ink-1)">Dual-Layer Canvas</h3>
						<p class="mt-2 text-xs leading-relaxed text-(--ink-2)">
							Mutations render locally within &lt;1ms. Pen strokes are smoothed with RDP on the
							device, never loading server CPU with geometry math.
						</p>
					</div>

					<!-- Step 2 -->
					<div class="rounded-xl border border-(--surface-2) bg-(--surface-0) p-5">
						<div class="font-mono text-xs font-semibold text-cyan-400">02 / EDGE ROUTER</div>
						<h3 class="mt-2 text-sm font-bold text-(--ink-1)">WebSocket Upgrade</h3>
						<p class="mt-2 text-xs leading-relaxed text-(--ink-2)">
							hooks.server.ts intercepts /api/room/:id/ws before SvelteKit page resolution, routing
							directly to the room's Durable Object stub.
						</p>
					</div>

					<!-- Step 3 -->
					<div class="rounded-xl border border-(--surface-2) bg-(--surface-0) p-5">
						<div class="font-mono text-xs font-semibold text-emerald-400">03 / ISOLATE & DB</div>
						<h3 class="mt-2 text-sm font-bold text-(--ink-1)">Embedded SQLite</h3>
						<p class="mt-2 text-xs leading-relaxed text-(--ink-2)">
							Shapes commit transactionally via monotonic LWW upserts in ≤2ms. Sockets hibernate
							automatically, consuming zero compute between events.
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- QUICK SELF-HOST (DOCKER / BUN) -->
		<section id="self-host" class="border-t border-(--surface-2) py-16 sm:py-24">
			<div class="mb-8 max-w-2xl">
				<h2 class="text-2xl font-extrabold tracking-tight text-(--ink-1) sm:text-3xl">
					Self-host anywhere with zero external databases.
				</h2>
				<p class="mt-3 text-sm leading-relaxed text-(--ink-2)">
					Mesh is 100% self-contained. Run it on your VPS, Raspberry Pi, home lab, or deploy to
					Cloudflare Free Tier.
				</p>
			</div>

			<div class="overflow-hidden rounded-2xl border border-(--surface-2) bg-(--surface-1)">
				<!-- Tabs -->
				<div
					class="flex items-center justify-between border-b border-(--surface-2) bg-(--surface-0) px-4"
				>
					<div class="flex items-center gap-1">
						<button
							onclick={() => (activeTab = 'docker')}
							class="border-b-2 px-3 py-3 text-xs font-semibold transition-colors {activeTab ===
							'docker'
								? 'border-[#6366f1] text-(--ink-1)'
								: 'border-transparent text-(--ink-3) hover:text-(--ink-2)'}"
						>
							Docker Compose
						</button>
						<button
							onclick={() => (activeTab = 'bun')}
							class="border-b-2 px-3 py-3 text-xs font-semibold transition-colors {activeTab ===
							'bun'
								? 'border-[#6366f1] text-(--ink-1)'
								: 'border-transparent text-(--ink-3) hover:text-(--ink-2)'}"
						>
							Bun (Edge Runtime)
						</button>
						<button
							onclick={() => (activeTab = 'deploy')}
							class="border-b-2 px-3 py-3 text-xs font-semibold transition-colors {activeTab ===
							'deploy'
								? 'border-[#6366f1] text-(--ink-1)'
								: 'border-transparent text-(--ink-3) hover:text-(--ink-2)'}"
						>
							Cloudflare Deploy
						</button>
					</div>

					<button
						onclick={() => copyCode(snippets[activeTab])}
						class="flex items-center gap-1.5 rounded-lg border border-(--surface-2) bg-(--surface-1) px-2.5 py-1 text-xs font-medium text-(--ink-2) transition-colors hover:text-(--ink-1) focus:outline-none"
					>
						{#if copied}
							<svg
								class="h-3.5 w-3.5 text-emerald-400"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
							<span class="text-emerald-400">Copied</span>
						{:else}
							<svg
								class="h-3.5 w-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
								<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
							</svg>
							<span>Copy</span>
						{/if}
					</button>
				</div>

				<!-- Code Box -->
				<div class="p-5 font-mono text-xs leading-relaxed text-(--ink-1)">
					<pre class="overflow-x-auto"><code>{snippets[activeTab]}</code></pre>
				</div>
			</div>
		</section>

		<!-- TECH SPECS & GUARDRAILS -->
		<section id="tech-specs" class="border-t border-(--surface-2) py-16 sm:py-24">
			<div class="mb-10 max-w-2xl">
				<h2 class="text-2xl font-extrabold tracking-tight text-(--ink-1) sm:text-3xl">
					Technical Limits & Guardrails
				</h2>
				<p class="mt-3 text-sm leading-relaxed text-(--ink-2)">
					Mesh enforces strict room isolation and rate limits to guarantee sub-16ms latency even on
					free tier resources.
				</p>
			</div>

			<div class="overflow-hidden rounded-2xl border border-(--surface-2) bg-(--surface-1)">
				<div class="divide-y divide-(--surface-2) text-xs">
					<div class="flex flex-col justify-between px-6 py-4 sm:flex-row sm:items-center">
						<span class="font-semibold text-(--ink-1)">Max Concurrent Connections</span>
						<span class="font-mono text-(--ink-2)">50 peers per room (with unauthed eviction)</span>
					</div>
					<div class="flex flex-col justify-between px-6 py-4 sm:flex-row sm:items-center">
						<span class="font-semibold text-(--ink-1)">Max Shapes Per Room</span>
						<span class="font-mono text-(--ink-2)">10,000 vector shapes</span>
					</div>
					<div class="flex flex-col justify-between px-6 py-4 sm:flex-row sm:items-center">
						<span class="font-semibold text-(--ink-1)">Rate Limiting</span>
						<span class="font-mono text-(--ink-2)">150 messages/sec sliding window per socket</span>
					</div>
					<div class="flex flex-col justify-between px-6 py-4 sm:flex-row sm:items-center">
						<span class="font-semibold text-(--ink-1)">Payload Frame Ceiling</span>
						<span class="font-mono text-(--ink-2)">64 KB (rejects frame with code 1009)</span>
					</div>
					<div class="flex flex-col justify-between px-6 py-4 sm:flex-row sm:items-center">
						<span class="font-semibold text-(--ink-1)">Conflict Resolution</span>
						<span class="font-mono text-(--ink-2)"
							>Monotonic Last-Write-Wins (LWW) with clock skew cap</span
						>
					</div>
					<div class="flex flex-col justify-between px-6 py-4 sm:flex-row sm:items-center">
						<span class="font-semibold text-(--ink-1)">Authentication Hash</span>
						<span class="font-mono text-(--ink-2)"
							>PBKDF2-SHA256 (100,000 iterations via crypto.subtle)</span
						>
					</div>
				</div>
			</div>
		</section>
	</main>

	<!-- FOOTER -->
	<footer class="border-t border-(--surface-2) bg-(--surface-0) py-10 transition-colors">
		<div
			class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6"
		>
			<div class="flex items-center gap-3">
				<img src="/made-by-white.svg" alt="Made by" class="madeby-dark h-5 w-auto" />
				<img src="/made-by-black.svg" alt="Made by" class="madeby-light h-5 w-auto" />
				<span class="text-xs text-(--ink-3)">Distributed real-time vector whiteboard.</span>
			</div>

			<div class="flex items-center gap-5 text-xs text-(--ink-3)">
				<a
					href="https://github.com/VUXXE/Mesh"
					target="_blank"
					rel="noopener noreferrer"
					class="transition-colors hover:text-(--ink-1)"
				>
					GitHub
				</a>
				<a
					href="https://github.com/VUXXE/Mesh/blob/main/LICENSE"
					target="_blank"
					rel="noopener noreferrer"
					class="transition-colors hover:text-(--ink-1)"
				>
					MIT License
				</a>
				<a href="#features" class="transition-colors hover:text-(--ink-1)">Back to top ↑</a>
			</div>
		</div>
	</footer>
</div>

<style>
	.landing-dots {
		background-image: radial-gradient(circle, var(--grid-dot) 1.2px, transparent 1.2px);
		background-size: 24px 24px;
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
