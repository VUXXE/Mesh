<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import logo from '$lib/assets/logo.png';

	const REPO = 'VUXXE/Mesh';

	// Room Creation & Join State
	let joinRoomId = $state('');
	let errorMessage = $state('');
	let roomPassword = $state('');
	let passwordError = $state('');
	let starCount = $state<number | null>(null);
	let isLight = $state(false);
	let activeSelfHostTab = $state<'docker' | 'bun' | 'deploy'>('docker');
	let activeEngineTab = $state<'vector' | 'storage' | 'presence' | 'security'>('vector');
	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout> | null = null;

	// Simulated remote cursor animation state
	let hananCursor = $state({ x: 190, y: 115 });
	let mayaCursor = $state({ x: 410, y: 225 });

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

		// Animate simulated remote cursors
		let angle = 0;
		const interval = setInterval(() => {
			angle += 0.035;
			hananCursor = {
				x: 190 + Math.cos(angle) * 26,
				y: 115 + Math.sin(angle * 1.4) * 18
			};
			mayaCursor = {
				x: 410 + Math.sin(angle * 0.8) * 22,
				y: 225 + Math.cos(angle * 1.2) * 16
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
	<title>Mesh: Open-Source Edge Vector Whiteboard</title>
	<meta
		name="description"
		content="Fast, distraction-free collaborative vector whiteboard on Cloudflare Workers and Svelte 5. Sub-16ms drawing feedback, embedded SQLite, and adaptive ephemeral presence."
	/>
</svelte:head>

<div
	class="relative h-screen w-screen overflow-x-hidden overflow-y-auto bg-(--surface-0) text-(--ink-1) selection:bg-(--accent-lime)/30"
>
	<!-- SIDE RAILS (OpenDesign signature technical rails) -->
	<aside
		class="side-rail left pointer-events-none fixed top-0 bottom-0 left-0 z-30 hidden w-10 items-center justify-center border-r border-(--surface-2)/60 xl:flex"
	>
		<span class="rail-text text-(--ink-3)">MESH // EDGE VECTOR ENGINE // ISOLATE SQLITE</span>
	</aside>
	<aside
		class="side-rail right pointer-events-none fixed top-0 right-0 bottom-0 z-30 hidden w-10 items-center justify-center border-l border-(--surface-2)/60 xl:flex"
	>
		<span class="rail-text text-(--ink-3)">SUB-16MS LATENCY // 15HZ ADAPTIVE // ZERO-IDLE</span>
	</aside>

	<!-- FLOATING LIQUID-GLASS NAVIGATION BAR -->
	<header class="sticky top-4 z-50 mx-auto max-w-5xl px-4 sm:px-6">
		<nav
			class="flex items-center justify-between gap-4 rounded-full border border-(--surface-2) bg-(--surface-1)/85 px-4 py-2.5 shadow-xl shadow-black/10 backdrop-blur-xl sm:px-6"
		>
			<!-- Brand Mark & Identity -->
			<a href="/" class="text-decoration-none flex items-center gap-2.5">
				<img src={logo} alt="Mesh Logo" class="h-7 w-7 rounded-lg object-contain shadow-xs" />
				<span class="font-extrabold tracking-tight text-(--ink-1) sm:text-base">Mesh</span>
				<span
					class="hidden items-center gap-1.5 rounded-full border border-(--accent-lime)/30 bg-(--accent-glow) px-2 py-0.5 text-[10px] font-bold text-(--accent-lime) sm:inline-flex"
				>
					<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-(--accent-lime)"></span>
					v1.0 Edge
				</span>
			</a>

			<!-- Nav Links -->
			<div class="hidden items-center gap-6 text-xs font-semibold tracking-wide md:flex">
				<a href="#workbench" class="text-(--ink-2) transition-colors hover:text-(--ink-1)">
					Workbench
				</a>
				<a href="#engine" class="text-(--ink-2) transition-colors hover:text-(--ink-1)"> Engine </a>
				<a href="#architecture" class="text-(--ink-2) transition-colors hover:text-(--ink-1)">
					Architecture
				</a>
				<a href="#self-host" class="text-(--ink-2) transition-colors hover:text-(--ink-1)">
					Self-Host
				</a>
				<a href="#tech-specs" class="text-(--ink-2) transition-colors hover:text-(--ink-1)">
					Specs
				</a>
			</div>

			<!-- Right Actions: Theme Toggle, GitHub Stars, Action Pill -->
			<div class="flex items-center gap-2.5 sm:gap-3">
				<!-- Theme Toggle -->
				<button
					type="button"
					onclick={toggleTheme}
					aria-label="Toggle visual theme"
					class="flex h-8 w-8 items-center justify-center rounded-full border border-(--surface-2) bg-(--surface-0) text-(--ink-2) transition-colors hover:border-(--surface-3) hover:text-(--ink-1)"
				>
					{#if isLight}
						<!-- Moon Icon -->
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
						<!-- Sun Icon -->
						<svg
							class="h-4 w-4"
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

				<!-- GitHub Pill -->
				<a
					href="https://github.com/{REPO}"
					target="_blank"
					rel="noreferrer"
					class="hidden items-center gap-1.5 rounded-full border border-(--surface-2) bg-(--surface-0) px-3 py-1 text-xs font-semibold text-(--ink-2) transition-colors hover:border-(--surface-3) hover:text-(--ink-1) sm:inline-flex"
				>
					<svg class="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
						<path
							d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
						/>
					</svg>
					<span>★ {starCount !== null ? formatStars(starCount) : 'Star'}</span>
				</a>

				<!-- Quick Create CTA Button -->
				<button
					type="button"
					onclick={createRoom}
					class="inline-flex items-center gap-1.5 rounded-full bg-(--ink-1) px-3.5 py-1.5 text-xs font-bold text-(--surface-0) shadow-xs transition-transform hover:-translate-y-0.5"
				>
					<span>New Room</span>
					<span class="text-(--accent-lime)">→</span>
				</button>
			</div>
		</nav>
	</header>

	<!-- MAIN CONTENT CONTAINER -->
	<main class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
		<!-- HERO SECTION (OpenDesign signature framed title) -->
		<section class="flex flex-col items-center pt-12 pb-14 text-center sm:pt-16 sm:pb-20">
			<!-- Top Announcement Pill -->
			<div
				class="inline-flex items-center gap-2 rounded-full border border-(--surface-2) bg-(--surface-1) px-4 py-1 text-xs font-semibold text-(--ink-2) shadow-xs"
			>
				<span class="h-2 w-2 rounded-full bg-(--accent-lime)"></span>
				<span>Distraction-free serverless vector canvas</span>
				<span class="font-mono text-[11px] text-(--ink-3)">// 0ms idle compute</span>
			</div>

			<!-- SIGNATURE FRAMED HERO TITLE (with 4 corner marks) -->
			<div
				class="relative mt-8 inline-block max-w-4xl border border-(--accent-lime)/70 bg-(--surface-1)/40 px-6 py-8 backdrop-blur-xs sm:px-14 sm:py-12"
			>
				<!-- 4 Corner Tick Squares -->
				<span class="absolute -top-1.5 -left-1.5 h-3 w-3 bg-(--accent-lime)"></span>
				<span class="absolute -top-1.5 -right-1.5 h-3 w-3 bg-(--accent-lime)"></span>
				<span class="absolute -bottom-1.5 -left-1.5 h-3 w-3 bg-(--accent-lime)"></span>
				<span class="absolute -right-1.5 -bottom-1.5 h-3 w-3 bg-(--accent-lime)"></span>

				<p class="font-mono text-xs font-bold tracking-widest text-(--accent-lime) uppercase">
					REAL-TIME COLLABORATIVE SYSTEM
				</p>
				<h1
					class="mt-3 text-3xl font-black tracking-tight text-(--ink-1) sm:text-5xl sm:leading-tight lg:text-6xl"
				>
					Real-time vector whiteboard,<br />
					<span class="od-highlight">executed on the edge.</span>
				</h1>
			</div>

			<!-- Hero Subheading -->
			<p class="mt-6 max-w-2xl text-base leading-relaxed text-(--ink-2) sm:text-lg">
				Built for engineers and product teams. Sub-16ms vector input, adaptive 15Hz presence, and
				embedded SQLite persistence. No sign-ups, no tracking cookies, and zero idle compute costs.
			</p>

			<!-- Hero Action Buttons -->
			<div class="mt-8 flex flex-wrap items-center justify-center gap-4">
				<button
					type="button"
					onclick={createRoom}
					class="inline-flex items-center gap-2 rounded-full bg-(--ink-1) px-6 py-3 text-sm font-bold text-(--surface-0) shadow-lg shadow-black/10 transition-transform hover:-translate-y-0.5"
				>
					<span>Launch Whiteboard</span>
					<span class="font-mono font-bold text-(--accent-lime)">→</span>
				</button>
				<a
					href="#workbench"
					class="inline-flex items-center gap-2 rounded-full border border-(--surface-2) bg-(--surface-1) px-5 py-3 text-sm font-semibold text-(--ink-1) transition-colors hover:border-(--surface-3)"
				>
					<span>Explore Workbench</span>
				</a>
			</div>
		</section>

		<!-- WORKBENCH CENTERPIECE (Workstation Window with Room Launcher & Interactive Canvas Preview) -->
		<section id="workbench" class="mb-16 scroll-mt-24">
			<div
				class="overflow-hidden rounded-2xl border border-(--surface-2) bg-(--surface-1) shadow-2xl shadow-black/20"
			>
				<!-- Window Header Bar (macOS traffic lights + URL bar) -->
				<div
					class="flex items-center justify-between border-b border-(--surface-2) bg-(--surface-0)/80 px-4 py-3"
				>
					<div class="flex items-center gap-2">
						<span class="h-3 w-3 rounded-full bg-[#ef4444]/80"></span>
						<span class="h-3 w-3 rounded-full bg-[#eab308]/80"></span>
						<span class="h-3 w-3 rounded-full bg-[#22c55e]/80"></span>
					</div>
					<div
						class="flex items-center gap-2 rounded-md border border-(--surface-2) bg-(--surface-1) px-3 py-1 font-mono text-xs text-(--ink-2)"
					>
						<svg
							class="h-3.5 w-3.5 text-(--accent-lime)"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
							<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
						</svg>
						<span>https://mesh.workers.dev/room/...</span>
					</div>
					<div class="flex items-center gap-2 font-mono text-[11px] text-(--accent-lime)">
						<span class="h-2 w-2 animate-ping rounded-full bg-(--accent-lime)"></span>
						<span>LIVE PREVIEW</span>
					</div>
				</div>

				<!-- Window Body Grid: Left Launcher + Right Simulated Canvas -->
				<div class="grid grid-cols-1 lg:grid-cols-12">
					<!-- LEFT COLUMN: Launcher Station (5 cols) -->
					<div
						class="border-b border-(--surface-2) p-6 sm:p-8 lg:col-span-5 lg:border-r lg:border-b-0"
					>
						<div class="flex items-center justify-between">
							<span
								class="font-mono text-xs font-bold tracking-wider text-(--accent-lime) uppercase"
							>
								// ROOM CONTROL
							</span>
							<span
								class="rounded bg-(--surface-2) px-2 py-0.5 text-[10px] font-bold text-(--ink-2)"
							>
								PBKDF2 READY
							</span>
						</div>

						<h2 class="mt-2 text-xl font-bold text-(--ink-1)">Start or Join Whiteboard</h2>
						<p class="mt-1 text-xs text-(--ink-2)">
							Every room is a private, dedicated Durable Object isolate backed by embedded SQLite.
						</p>

						<!-- Create Room Form -->
						<div class="mt-6 space-y-4">
							<div>
								<label for="create-password" class="block text-xs font-semibold text-(--ink-2)">
									Room Protection (Optional)
								</label>
								<div class="relative mt-1.5">
									<input
										id="create-password"
										type="password"
										bind:value={roomPassword}
										placeholder="Leave empty for public, or enter password"
										class="w-full rounded-xl border border-(--surface-2) bg-(--surface-0) px-3.5 py-2.5 text-xs text-(--ink-1) placeholder-(--ink-3) transition-colors focus:border-(--accent-lime) focus:outline-none"
									/>
									<span class="absolute top-2.5 right-3 text-[10px] text-(--ink-3)">
										{roomPassword ? 'Locked' : 'Public'}
									</span>
								</div>
								{#if passwordError}
									<p class="mt-1 text-xs text-red-400">{passwordError}</p>
								{/if}
							</div>

							<button
								type="button"
								onclick={createRoom}
								class="flex w-full items-center justify-center gap-2 rounded-xl bg-(--ink-1) px-4 py-3 text-sm font-bold text-(--surface-0) transition-transform hover:-translate-y-0.5"
							>
								<span>Create New Whiteboard</span>
								<span class="font-mono text-(--accent-lime)">→</span>
							</button>
						</div>

						<!-- Separator -->
						<div class="my-6 flex items-center gap-3">
							<div class="h-px flex-1 bg-(--surface-2)"></div>
							<span class="font-mono text-[10px] text-(--ink-3) uppercase"
								>OR JOIN BY CODE / LINK</span
							>
							<div class="h-px flex-1 bg-(--surface-2)"></div>
						</div>

						<!-- Join Form -->
						<form onsubmit={handleJoin} class="space-y-3">
							<div>
								<input
									type="text"
									bind:value={joinRoomId}
									placeholder="room-qk5qt3 or full URL"
									class="w-full rounded-xl border border-(--surface-2) bg-(--surface-0) px-3.5 py-2.5 font-mono text-xs text-(--ink-1) placeholder-(--ink-3) transition-colors focus:border-(--accent-lime) focus:outline-none"
								/>
								{#if errorMessage}
									<p class="mt-1 text-xs text-red-400">{errorMessage}</p>
								{/if}
							</div>
							<button
								type="submit"
								class="flex w-full items-center justify-center gap-2 rounded-xl border border-(--surface-2) bg-(--surface-0) px-4 py-2.5 text-xs font-semibold text-(--ink-1) transition-colors hover:border-(--surface-3)"
							>
								<span>Join Whiteboard Session</span>
							</button>
						</form>

						<!-- Feature Bullets -->
						<div
							class="mt-6 space-y-2 border-t border-(--surface-2) pt-5 text-[11px] text-(--ink-2)"
						>
							<div class="flex items-center gap-2">
								<span class="text-(--accent-lime)">✓</span>
								<span>Zero user accounts or telemetry tracking</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="text-(--accent-lime)">✓</span>
								<span>Single-writer SQLite isolate with monotonic LWW</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="text-(--accent-lime)">✓</span>
								<span>Adaptive 15Hz presence stream (Free-tier safe)</span>
							</div>
						</div>
					</div>

					<!-- RIGHT COLUMN: Simulated Live Canvas Teaser (7 cols) -->
					<div
						class="relative min-h-[380px] bg-(--canvas-bg) p-6 sm:p-8 lg:col-span-7"
						style="background-image: radial-gradient(circle, var(--grid-dot) 1px, transparent 1px); background-size: 20px 20px;"
					>
						<!-- Mini Mock Canvas Toolbar -->
						<div
							class="absolute top-4 left-4 z-20 flex items-center gap-1 rounded-full border border-(--surface-2) bg-(--surface-1)/90 px-3 py-1.5 shadow-md backdrop-blur-md"
						>
							<span class="rounded bg-(--surface-2) p-1 text-(--accent-lime)">
								<!-- Select cursor -->
								<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
									<path d="M4 0l16 12-7 1.5-4 8.5-3-1.5 4-8.5-6-1.5z" />
								</svg>
							</span>
							<span class="p-1 text-(--ink-3)">
								<!-- Pen -->
								<svg
									class="h-3.5 w-3.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M12 19l7-7 3 3-7 7-3-3z"></path>
									<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
								</svg>
							</span>
							<span class="p-1 text-(--ink-3)">
								<!-- Rectangle -->
								<svg
									class="h-3.5 w-3.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<rect x="3" y="3" width="18" height="18" rx="2"></rect>
								</svg>
							</span>
							<span class="p-1 text-(--ink-3)">
								<!-- Sticky -->
								<svg
									class="h-3.5 w-3.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
									<polyline points="14 2 14 8 20 8"></polyline>
								</svg>
							</span>
							<span class="ml-1 text-[10px] text-(--ink-3)">|</span>
							<span class="ml-1 font-mono text-[10px] text-(--ink-2)">100%</span>
						</div>

						<!-- Status pill top right -->
						<div
							class="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-full border border-(--surface-2) bg-(--surface-1)/90 px-3 py-1 font-mono text-[10px] text-(--ink-2) shadow-xs backdrop-blur-md"
						>
							<span class="h-1.5 w-1.5 rounded-full bg-(--accent-lime)"></span>
							<span>2 peers active</span>
						</div>

						<!-- Vector Canvas Elements -->
						<!-- Architecture Box 1: Browser Client -->
						<div
							class="absolute top-16 left-6 w-44 rounded-xl border border-indigo-500/60 bg-(--surface-1) p-3 shadow-md"
						>
							<div class="flex items-center gap-1.5">
								<span class="h-2 w-2 rounded-full bg-indigo-400"></span>
								<span class="text-xs font-bold text-(--ink-1)">Svelte 5 Client</span>
							</div>
							<p class="mt-1 font-mono text-[10px] text-(--ink-3)">Dual-layer Canvas</p>
							<div class="mt-2 flex items-center gap-1 font-mono text-[9px] text-indigo-400">
								<span>RDP smoothing (≤16ms)</span>
							</div>
						</div>

						<!-- Connector Line 1: Curved SVG arrow to Durable Object -->
						<svg
							class="pointer-events-none absolute top-18 left-48 h-20 w-44 text-(--ink-3)"
							viewBox="0 0 176 80"
						>
							<path
								d="M 8 20 C 60 0, 110 0, 164 20"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-dasharray="4 4"
								marker-end="url(#arrowhead)"
							/>
							<text x="70" y="34" fill="currentColor" font-size="9" font-family="monospace">
								wss:// (15Hz)
							</text>
							<defs>
								<marker
									id="arrowhead"
									markerWidth="6"
									markerHeight="6"
									refX="4"
									refY="3"
									orient="auto"
								>
									<polygon points="0 0, 6 3, 0 6" fill="currentColor" />
								</marker>
							</defs>
						</svg>

						<!-- Architecture Box 2: Cloudflare Durable Object -->
						<div
							class="absolute top-16 right-6 w-44 rounded-xl border border-cyan-500/60 bg-(--surface-1) p-3 shadow-md"
						>
							<div class="flex items-center gap-1.5">
								<span class="h-2 w-2 rounded-full bg-cyan-400"></span>
								<span class="text-xs font-bold text-(--ink-1)">Durable Object</span>
							</div>
							<p class="mt-1 font-mono text-[10px] text-(--ink-3)">WhiteboardRoom isolate</p>
							<div class="mt-2 flex items-center gap-1 font-mono text-[9px] text-cyan-400">
								<span>Embedded SQLite</span>
							</div>
						</div>

						<!-- Sticky Note: Real system constraint -->
						<div
							class="absolute bottom-6 left-8 w-52 rotate-[-2deg] rounded-lg border border-amber-300 bg-amber-100 p-3.5 shadow-lg transition-transform hover:rotate-0"
						>
							<div class="mb-1 text-[11px] font-bold text-amber-900">System Decision</div>
							<p class="text-[11px] leading-snug text-amber-800">
								Presence stays ephemeral in DO memory; shapes persist to SQLite with monotonic LWW.
							</p>
						</div>

						<!-- Simulated Collaborator Cursor 1: Hanan (Cyan) -->
						<div
							class="pointer-events-none absolute z-20 transition-all duration-75"
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

						<!-- Simulated Collaborator Cursor 2: Maya (Amber) -->
						<div
							class="pointer-events-none absolute z-20 transition-all duration-75"
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
								class="ml-3 rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-black shadow-xs"
							>
								Maya
							</span>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- TELEMETRY WIRE TICKER (OpenDesign continuous stream) -->
		<section class="mb-20 overflow-hidden border-y border-(--surface-2) py-3.5">
			<div class="animate-ticker flex items-center gap-8 font-mono text-xs text-(--ink-2)">
				<div class="flex items-center gap-2">
					<span class="h-1.5 w-1.5 rounded-full bg-(--accent-lime)"></span>
					<span class="text-(--ink-1)">LATENCY: &lt; 16MS</span>
				</div>
				<span>//</span>
				<div class="flex items-center gap-2">
					<span class="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
					<span class="text-(--ink-1)">PRESENCE: 15HZ ADAPTIVE</span>
				</div>
				<span>//</span>
				<div class="flex items-center gap-2">
					<span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
					<span class="text-(--ink-1)">PERSISTENCE: MONOTONIC LWW SQLITE</span>
				</div>
				<span>//</span>
				<div class="flex items-center gap-2">
					<span class="h-1.5 w-1.5 rounded-full bg-purple-400"></span>
					<span class="text-(--ink-1)">COMPUTE: ZERO-IDLE HIBERNATION</span>
				</div>
				<span>//</span>
				<div class="flex items-center gap-2">
					<span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
					<span class="text-(--ink-1)">CAPACITY: 50 PEERS / 10,000 SHAPES</span>
				</div>
				<span>//</span>
				<div class="flex items-center gap-2">
					<span class="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
					<span class="text-(--ink-1)">SECURITY: PBKDF2-SHA256</span>
				</div>
				<span>//</span>
				<!-- Duplicate loop for continuous marquee -->
				<div class="flex items-center gap-2">
					<span class="h-1.5 w-1.5 rounded-full bg-(--accent-lime)"></span>
					<span class="text-(--ink-1)">LATENCY: &lt; 16MS</span>
				</div>
				<span>//</span>
				<div class="flex items-center gap-2">
					<span class="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
					<span class="text-(--ink-1)">PRESENCE: 15HZ ADAPTIVE</span>
				</div>
				<span>//</span>
				<div class="flex items-center gap-2">
					<span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
					<span class="text-(--ink-1)">PERSISTENCE: MONOTONIC LWW SQLITE</span>
				</div>
				<span>//</span>
				<div class="flex items-center gap-2">
					<span class="h-1.5 w-1.5 rounded-full bg-purple-400"></span>
					<span class="text-(--ink-1)">COMPUTE: ZERO-IDLE HIBERNATION</span>
				</div>
			</div>
		</section>

		<!-- INTERACTIVE ENGINE DOCK (OpenDesign Labs Dock Style) -->
		<section id="engine" class="mb-24 scroll-mt-24">
			<div class="mb-8">
				<div class="inline-flex items-center gap-2">
					<span class="h-px w-5 bg-(--accent-lime)"></span>
					<span class="font-mono text-xs font-bold tracking-widest text-(--accent-lime) uppercase">
						CORE SYSTEMS
					</span>
				</div>
				<h2 class="mt-2 text-2xl font-black tracking-tight text-(--ink-1) sm:text-3xl">
					Engineered for speed, built without bloat.
				</h2>
				<p class="mt-2 text-sm text-(--ink-2)">
					Select a subsystem below to inspect its architecture guarantees and design decisions.
				</p>
			</div>

			<!-- Interactive Subsystem Tabs -->
			<div class="flex flex-wrap items-center gap-2 border-b border-(--surface-2) pb-4">
				<button
					type="button"
					onclick={() => (activeEngineTab = 'vector')}
					class="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all {activeEngineTab ===
					'vector'
						? 'bg-(--accent-lime) text-black shadow-md'
						: 'bg-(--surface-1) text-(--ink-2) hover:text-(--ink-1)'}"
				>
					<span>✏️ Vector Engine</span>
				</button>
				<button
					type="button"
					onclick={() => (activeEngineTab = 'storage')}
					class="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all {activeEngineTab ===
					'storage'
						? 'bg-(--accent-lime) text-black shadow-md'
						: 'bg-(--surface-1) text-(--ink-2) hover:text-(--ink-1)'}"
				>
					<span>🗄️ Durable SQLite</span>
				</button>
				<button
					type="button"
					onclick={() => (activeEngineTab = 'presence')}
					class="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all {activeEngineTab ===
					'presence'
						? 'bg-(--accent-lime) text-black shadow-md'
						: 'bg-(--surface-1) text-(--ink-2) hover:text-(--ink-1)'}"
				>
					<span>⚡ Adaptive Presence</span>
				</button>
				<button
					type="button"
					onclick={() => (activeEngineTab = 'security')}
					class="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all {activeEngineTab ===
					'security'
						? 'bg-(--accent-lime) text-black shadow-md'
						: 'bg-(--surface-1) text-(--ink-2) hover:text-(--ink-1)'}"
				>
					<span>🔒 Zero-Knowledge Auth</span>
				</button>
			</div>

			<!-- Active Subsystem Card Display -->
			<div class="mt-6 rounded-2xl border border-(--surface-2) bg-(--surface-1) p-6 sm:p-8">
				{#if activeEngineTab === 'vector'}
					<div class="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
						<div>
							<span class="font-mono text-xs font-bold text-(--accent-lime)"
								>// DUAL-LAYER CANVAS</span
							>
							<h3 class="mt-2 text-xl font-black text-(--ink-1)">Sub-16ms Vector Render Loop</h3>
							<p class="mt-3 text-sm leading-relaxed text-(--ink-2)">
								Mesh splits rendering across two decoupled canvas surfaces. The committed buffer
								redraws strictly on shape additions or removals. Active drawing previews, live drag
								bounding boxes, and remote peer cursors execute on an overlay running at a locked
								60fps.
							</p>
							<div class="mt-5 grid grid-cols-2 gap-4 font-mono text-xs">
								<div class="rounded-xl border border-(--surface-2) bg-(--surface-0) p-3">
									<p class="text-(--ink-3)">Smoothing Algorithm</p>
									<p class="mt-1 font-bold text-(--ink-1)">Ramer-Douglas-Peucker</p>
								</div>
								<div class="rounded-xl border border-(--surface-2) bg-(--surface-0) p-3">
									<p class="text-(--ink-3)">Supported Primitives</p>
									<p class="mt-1 font-bold text-(--ink-1)">7 Vector Tools</p>
								</div>
							</div>
						</div>
						<div
							class="rounded-xl border border-(--surface-2) bg-(--surface-0) p-5 font-mono text-xs text-(--ink-2)"
						>
							<div class="text-(--accent-lime)">// Client-Side Geometry Optimization</div>
							<p class="mt-2 text-(--ink-1)">
								const points = ramerDouglasPeucker(rawStroke, 1.2);<br />
								const shape = {'{'} id, type: 'path', data: {'{'} points {'}'}
								{'}'};
							</p>
							<p class="mt-4 text-(--ink-3)">
								/* Geometry computation happens purely in the client worker thread, ensuring DO
								handlers stay &le; 2ms */
							</p>
						</div>
					</div>
				{:else if activeEngineTab === 'storage'}
					<div class="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
						<div>
							<span class="font-mono text-xs font-bold text-emerald-400"
								>// ISOLATE TRANSACTION STORAGE</span
							>
							<h3 class="mt-2 text-xl font-black text-(--ink-1)">Deterministic Monotonic LWW</h3>
							<p class="mt-3 text-sm leading-relaxed text-(--ink-2)">
								Each whiteboard room operates as an independent Cloudflare Durable Object isolate
								with its own embedded SQLite database. Multi-user concurrent writes resolve via
								Last-Write-Wins with clock-skew safeguards, preventing conflicting mutations without
								centralized database bottlenecks.
							</p>
							<div class="mt-5 grid grid-cols-2 gap-4 font-mono text-xs">
								<div class="rounded-xl border border-(--surface-2) bg-(--surface-0) p-3">
									<p class="text-(--ink-3)">Storage Medium</p>
									<p class="mt-1 font-bold text-(--ink-1)">Embedded SQLite</p>
								</div>
								<div class="rounded-xl border border-(--surface-2) bg-(--surface-0) p-3">
									<p class="text-(--ink-3)">Clock-Skew Cap</p>
									<p class="mt-1 font-bold text-(--ink-1)">+5000ms Clamping</p>
								</div>
							</div>
						</div>
						<div
							class="rounded-xl border border-(--surface-2) bg-(--surface-0) p-5 font-mono text-xs text-(--ink-2)"
						>
							<div class="text-emerald-400">-- Embedded Transactional Upsert</div>
							<p class="mt-2 text-(--ink-1)">
								INSERT INTO shapes (id, type, x, y, updated_at)<br />
								VALUES (?, ?, ?, ?, ?)<br />
								ON CONFLICT(id) DO UPDATE SET<br />
								&nbsp;&nbsp;x = excluded.x, updated_at = excluded.updated_at<br />
								WHERE excluded.updated_at &gt;= shapes.updated_at;
							</p>
						</div>
					</div>
				{:else if activeEngineTab === 'presence'}
					<div class="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
						<div>
							<span class="font-mono text-xs font-bold text-cyan-400">// WEBSOCKET HIBERNATION</span
							>
							<h3 class="mt-2 text-xl font-black text-(--ink-1)">Adaptive 15Hz Presence</h3>
							<p class="mt-3 text-sm leading-relaxed text-(--ink-2)">
								Cursor tracking is broadcast in memory and never touches disk. While alone in a
								room, cursor transmissions are completely suppressed, saving over 100,000
								invocations per hour and preserving Cloudflare Free Tier quotas. When collaborating,
								transmissions adaptively stream at 15Hz with deadband filtering.
							</p>
							<div class="mt-5 grid grid-cols-2 gap-4 font-mono text-xs">
								<div class="rounded-xl border border-(--surface-2) bg-(--surface-0) p-3">
									<p class="text-(--ink-3)">Solo Quota Usage</p>
									<p class="mt-1 font-bold text-(--ink-1)">0 Cursor Requests</p>
								</div>
								<div class="rounded-xl border border-(--surface-2) bg-(--surface-0) p-3">
									<p class="text-(--ink-3)">Deadband Filter</p>
									<p class="mt-1 font-bold text-(--ink-1)">&lt; 2px Movement</p>
								</div>
							</div>
						</div>
						<div
							class="rounded-xl border border-(--surface-2) bg-(--surface-0) p-5 font-mono text-xs text-(--ink-2)"
						>
							<div class="text-cyan-400">// In-Memory Presence Attachment</div>
							<p class="mt-2 text-(--ink-1)">
								if (this.peers.length === 0 &amp;&amp; cursor !== null) return;<br />
								if (distSq &lt; 4 &amp;&amp; selectionUnchanged) return;<br />
								ws.serializeAttachment({'{'} userId, name, color, cursor {'}'});
							</p>
							<p class="mt-4 text-(--ink-3)">
								/* Ephemeral packets bypass disk writes, eliminating lock contention */
							</p>
						</div>
					</div>
				{:else if activeEngineTab === 'security'}
					<div class="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
						<div>
							<span class="font-mono text-xs font-bold text-purple-400"
								>// CRYPTOGRAPHIC VERIFICATION</span
							>
							<h3 class="mt-2 text-xl font-black text-(--ink-1)">Zero-Knowledge Room Locks</h3>
							<p class="mt-3 text-sm leading-relaxed text-(--ink-2)">
								Password-protected rooms enforce client-side derivation with PBKDF2-SHA256 (100,000
								iterations). Unauthenticated sockets are strictly withheld from receiving shapes,
								presence streams, or mutation events until authenticated. Brute-force throttling and
								connection timeouts prevent automated attacks.
							</p>
							<div class="mt-5 grid grid-cols-2 gap-4 font-mono text-xs">
								<div class="rounded-xl border border-(--surface-2) bg-(--surface-0) p-3">
									<p class="text-(--ink-3)">Derivation Iterations</p>
									<p class="mt-1 font-bold text-(--ink-1)">100,000 Rounds</p>
								</div>
								<div class="rounded-xl border border-(--surface-2) bg-(--surface-0) p-3">
									<p class="text-(--ink-3)">Auth Gate Policy</p>
									<p class="mt-1 font-bold text-(--ink-1)">Strict Isolation</p>
								</div>
							</div>
						</div>
						<div
							class="rounded-xl border border-(--surface-2) bg-(--surface-0) p-5 font-mono text-xs text-(--ink-2)"
						>
							<div class="text-purple-400">// Constant-Time Hash Matching</div>
							<p class="mt-2 text-(--ink-1)">
								const actual = await this.hashPassword(input, salt);<br />
								return this.hashesEqual(actual, expectedHash);
							</p>
							<p class="mt-4 text-(--ink-3)">
								/* Rate limits: 5-second lockout after 5 fails; disconnect code 1008 after 10
								attempts */
							</p>
						</div>
					</div>
				{/if}
			</div>
		</section>

		<!-- 3-TIER ARCHITECTURE VISUALIZER -->
		<section id="architecture" class="mb-24 scroll-mt-24">
			<div class="mb-10 text-center sm:text-left">
				<div class="inline-flex items-center gap-2">
					<span class="h-px w-5 bg-(--accent-lime)"></span>
					<span class="font-mono text-xs font-bold tracking-widest text-(--accent-lime) uppercase">
						SYSTEM TOPOLOGY
					</span>
				</div>
				<h2 class="mt-2 text-2xl font-black tracking-tight text-(--ink-1) sm:text-3xl">
					Single origin. Zero external database dependencies.
				</h2>
			</div>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
				<!-- Tier 1: Client Layer -->
				<div class="rounded-2xl border border-(--surface-2) bg-(--surface-1) p-6">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400"
					>
						<span class="font-mono text-xs font-bold">01</span>
					</div>
					<h3 class="mt-4 text-base font-bold text-(--ink-1)">Browser Client</h3>
					<p class="mt-2 text-xs leading-relaxed text-(--ink-2)">
						Runs Svelte 5 with fine-grained reactivity ($state/$effect). Captures pointer events,
						smooths strokes with RDP, and renders optimistic updates locally.
					</p>
				</div>

				<!-- Tier 2: Edge Router -->
				<div class="rounded-2xl border border-(--surface-2) bg-(--surface-1) p-6">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400"
					>
						<span class="font-mono text-xs font-bold">02</span>
					</div>
					<h3 class="mt-4 text-base font-bold text-(--ink-1)">Anycast Edge Worker</h3>
					<p class="mt-2 text-xs leading-relaxed text-(--ink-2)">
						hooks.server.ts intercepts /api/room/:id/ws before page resolution, routing the raw
						upgrade to the dedicated room isolate via idFromName(roomId).
					</p>
				</div>

				<!-- Tier 3: Room Isolate & SQLite -->
				<div class="rounded-2xl border border-(--surface-2) bg-(--surface-1) p-6">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"
					>
						<span class="font-mono text-xs font-bold">03</span>
					</div>
					<h3 class="mt-4 text-base font-bold text-(--ink-1)">Durable Object & SQLite</h3>
					<p class="mt-2 text-xs leading-relaxed text-(--ink-2)">
						One isolate per room. Accepts hibernating WebSocket connections, resolves LWW conflicts,
						and commits to single-tenant transactional SQLite storage.
					</p>
				</div>
			</div>
		</section>

		<!-- SELF-HOSTING TERMINAL STATION -->
		<section id="self-host" class="mb-24 scroll-mt-24">
			<div class="mb-8">
				<div class="inline-flex items-center gap-2">
					<span class="h-px w-5 bg-(--accent-lime)"></span>
					<span class="font-mono text-xs font-bold tracking-widest text-(--accent-lime) uppercase">
						DEPLOYMENT
					</span>
				</div>
				<h2 class="mt-2 text-2xl font-black tracking-tight text-(--ink-1) sm:text-3xl">
					Self-host in your own cloud or container.
				</h2>
			</div>

			<div
				class="overflow-hidden rounded-2xl border border-(--surface-2) bg-(--surface-1) shadow-xl"
			>
				<!-- Terminal Tab Bar -->
				<div
					class="flex flex-wrap items-center justify-between gap-4 border-b border-(--surface-2) bg-(--surface-0)/80 px-4 py-3"
				>
					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={() => (activeSelfHostTab = 'docker')}
							class="rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition-colors {activeSelfHostTab ===
							'docker'
								? 'bg-(--surface-2) text-(--ink-1)'
								: 'text-(--ink-3) hover:text-(--ink-1)'}"
						>
							Docker Compose
						</button>
						<button
							type="button"
							onclick={() => (activeSelfHostTab = 'bun')}
							class="rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition-colors {activeSelfHostTab ===
							'bun'
								? 'bg-(--surface-2) text-(--ink-1)'
								: 'text-(--ink-3) hover:text-(--ink-1)'}"
						>
							Bun Runtime
						</button>
						<button
							type="button"
							onclick={() => (activeSelfHostTab = 'deploy')}
							class="rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition-colors {activeSelfHostTab ===
							'deploy'
								? 'bg-(--surface-2) text-(--ink-1)'
								: 'text-(--ink-3) hover:text-(--ink-1)'}"
						>
							Cloudflare Deploy
						</button>
					</div>

					<button
						type="button"
						onclick={() => copyCode(snippets[activeSelfHostTab])}
						class="flex items-center gap-1.5 rounded-lg border border-(--surface-2) bg-(--surface-1) px-3 py-1 text-xs font-semibold text-(--ink-2) transition-colors hover:border-(--surface-3) hover:text-(--ink-1)"
					>
						{#if copied}
							<span class="text-(--accent-lime)">✓ Copied!</span>
						{:else}
							<span>Copy Command</span>
						{/if}
					</button>
				</div>

				<!-- Terminal Code View -->
				<div class="p-6 font-mono text-xs leading-relaxed sm:text-sm">
					<pre class="overflow-x-auto text-(--ink-1)"><code>{snippets[activeSelfHostTab]}</code
						></pre>
				</div>
			</div>
		</section>

		<!-- PROTOCOL SPECS & TECHNICAL LIMITS TABLE -->
		<section id="tech-specs" class="mb-24 scroll-mt-24">
			<div class="mb-8">
				<div class="inline-flex items-center gap-2">
					<span class="h-px w-5 bg-(--accent-lime)"></span>
					<span class="font-mono text-xs font-bold tracking-widest text-(--accent-lime) uppercase">
						SPECIFICATION
					</span>
				</div>
				<h2 class="mt-2 text-2xl font-black tracking-tight text-(--ink-1) sm:text-3xl">
					Hard protocol bounds &amp; invariants.
				</h2>
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
						<span class="font-semibold text-(--ink-1)">Presence Broadcast</span>
						<span class="font-mono text-(--ink-2)"
							>Adaptive 15Hz with solo silence and deadband filtering</span
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

	<!-- EDITORIAL TYPOGRAPHIC FOOTER -->
	<footer class="border-t border-(--surface-2) bg-(--surface-0) py-12 transition-colors">
		<div
			class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8"
		>
			<div class="flex items-center gap-3">
				<img src={logo} alt="Mesh Logo" class="h-6 w-6 rounded-md object-contain" />
				<span class="text-sm font-bold text-(--ink-1)">Mesh</span>
				<span class="text-xs text-(--ink-3)">// MIT Open Source License</span>
			</div>

			<div class="flex items-center gap-6 text-xs text-(--ink-2)">
				<a
					href="https://github.com/{REPO}"
					target="_blank"
					rel="noreferrer"
					class="transition-colors hover:text-(--ink-1)"
				>
					GitHub Repository
				</a>
				<a
					href="https://github.com/{REPO}/blob/main/LICENSE"
					target="_blank"
					rel="noreferrer"
					class="transition-colors hover:text-(--ink-1)"
				>
					License
				</a>
				<a
					href="https://github.com/{REPO}/releases"
					target="_blank"
					rel="noreferrer"
					class="transition-colors hover:text-(--ink-1)"
				>
					Releases
				</a>
			</div>
		</div>
	</footer>
</div>
