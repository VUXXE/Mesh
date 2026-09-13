<p align="center">
  <img src="static/logo.png" alt="Mesh Logo" width="120" style="border-radius: 20px;" />
</p>

<h1 align="center">Mesh</h1>

<p align="center">
  Serverless real-time collaborative vector whiteboard built with SvelteKit 2 (Svelte 5 Runes) and Cloudflare Workers (Durable Objects with embedded SQLite and WebSocket Hibernation).
</p>

## Features

- **Single-Origin Deployment:** SvelteKit frontend SSR/static assets and backend Durable Objects run under the same Cloudflare Worker origin.
- **Embedded SQLite Persistence:** Durable Objects SQLite storage with monotonic Last-Write-Wins (LWW) conflict resolution.
- **WebSocket Hibernation API:** Zero idle compute burn while maintaining active client sessions.
- **Dual-Layer Canvas:**
  - Committed static buffer canvas for vector shapes (`path`, `rectangle`, `ellipse`, `text`, `sticky_note`).
  - 60fps interactive overlay for real-time stroke previews, bounding boxes, and peer cursors.
- **Real-Time Presence:** Throttled 30Hz remote cursor tracking and peer selection indicators.
- **Navigation & Radar:** MiniMap radar overview with click-to-pan navigation.
- **Exporting:** Direct export to PNG and SVG.

## Tech Stack

- **Frontend:** SvelteKit 2, Svelte 5 (Runes), Tailwind CSS v4
- **Runtime & Deployment:** Cloudflare Workers, `@sveltejs/adapter-cloudflare`, Wrangler
- **Backend & Storage:** Cloudflare Durable Objects (`WhiteboardRoom`), Embedded SQLite
- **Package Manager:** Bun

## Getting Started

### Install Dependencies

```bash
bun install
```

### Type Generation

```bash
bun run gen
```

### Type Checking & Linting

```bash
bun run check
bun run lint
```

### Build & Preview Locally

```bash
bun run build
bun run preview
```

### Running Tests

```bash
bun run scripts/test-handshake.ts
bun run scripts/test-sync-and-presence.ts
bun run scripts/test-e2e.ts
```
