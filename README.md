<p align="center">
  <img src="static/logo.png" alt="Mesh Logo" width="140" style="border-radius: 28px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);" />
</p>

<h1 align="center">Mesh</h1>

<p align="center">
  <strong>Fast, distraction-free real-time collaborative vector whiteboard.</strong><br />
  Built on SvelteKit 2 (Svelte 5 Runes) and Cloudflare Workers (Durable Objects with embedded SQLite &amp; WebSocket Hibernation).
</p>

<p align="center">
  <a href="#key-features"><img src="https://img.shields.io/badge/Svelte-5%20Runes-ff3e00?style=flat-square&logo=svelte&logoColor=white" alt="Svelte 5" /></a>
  <a href="#key-features"><img src="https://img.shields.io/badge/Runtime-Cloudflare%20Workers-f38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Workers" /></a>
  <a href="#architecture--storage"><img src="https://img.shields.io/badge/Storage-Embedded%20SQLite-003b57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" /></a>
  <a href="#self-hosting-with-docker"><img src="https://img.shields.io/badge/Self--Host-Docker%20Ready-2496ed?style=flat-square&logo=docker&logoColor=white" alt="Docker" /></a>
  <a href="#getting-started"><img src="https://img.shields.io/badge/Package%20Manager-Bun-fbf0df?style=flat-square&logo=bun&logoColor=black" alt="Bun" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License" /></a>
</p>

<br />

## Highlights

- **Edge-Native & Serverless:** Front-end SSR, static assets, and backend Durable Objects live under the exact same Cloudflare Worker origin. No reverse proxy, zero CORS issues.
- **Embedded SQLite Persistence:** Each room is powered by its own dedicated `WhiteboardRoom` Durable Object with transactional SQLite storage and monotonic Last-Write-Wins (LWW) conflict resolution.
- **WebSocket Hibernation API:** Zero idle compute billing. Connections hibernate in memory at the edge until packets arrive.
- **Dual-Layer Canvas Architecture:**
  - _Committed Static Buffer:_ Re-rendered only upon shape mutations or viewport transformations.
  - _60fps Interactive Overlay:_ Renders active drawing previews, selection handles, and live peer cursor movements smoothly without redrawing the entire scene.
- **Self-Hostable Anywhere:** Deploy to Cloudflare Workers with one command, or self-host in any environment using Docker and Docker Compose. Zero external database dependencies.

---

## Key Features

### ✏️ Vector Drawing Suite

- **Freehand Pen:** High-precision path capture with client-side Ramer-Douglas-Peucker (RDP) trajectory smoothing.
- **Geometric Shapes:** Rectangles, ellipses, straight lines, and directional arrows with customizable stroke colors, fill shades, and stroke widths.
- **Collaborative Notes:** Vector text labels and sticky notes with multi-line editing, font families (Sans, Serif, Mono), font sizes, and color tags.
- **Interactive Manipulation:** Hit testing for selection, multi-shape drag translation, 8-handle resize boxes (including pen and arrow paths, with Shift aspect-ratio lock), bounding boxes, and deletion.
- **Light & Dark Theme:** Sun/moon toggle in the header with canvas, grid, and export colors following the active theme. Preference persists in local storage.

### 🔒 Room Passwords

- **Optional Lock:** Set a password (4-128 characters) when creating a room from the landing page.
- **Auth Gate:** Joiners see a password prompt; shapes, cursors, and presence are withheld and mutations are dropped until authentication succeeds.
- **Hashed Storage:** Only a salted SHA-256 hash lives in room SQLite — plaintext passwords are never stored. Auth state rides the socket attachment so it survives hibernation, and browsers remember the password per tab for reconnects.

### 👥 Real-Time Collaboration & Presence

- **Ephemeral Remote Cursors:** Remote pointer positions broadcast at 30Hz with smooth interpolated rendering.
- **Custom Identity:** Live user avatars with customizable display names and signature colors saved in local storage.
- **Zero-Storage Presence:** Cursor coordinates and selection packets are routed exclusively in memory and never touch disk.

### ⏪ Multi-Level History (Undo / Redo)

- Full local history stack supporting `Ctrl+Z` and `Ctrl+Y` / `Ctrl+Shift+Z`.
- Tracks batch additions, property modifications, spatial translations, and shape deletions with immediate optimistic UI updates.

### 📱 Touch Gestures & Navigation

- **Pinch-to-Zoom:** Native two-finger pinch gesture scaling centered precisely around the touch midpoint.
- **Two-Finger Pan:** Effortless canvas panning on mobile devices and trackpads with touch-action isolation.
- **MiniMap Radar:** Real-time bird's-eye canvas overview with clickable quick-pan viewport positioning.

### 💾 Backup & Export

- **Export to PNG:** High-resolution bitmap snapshot rendering only the populated shape bounds.
- **Export to SVG:** Pure vector graphic export suitable for Figma, Illustrator, or web embedding.
- **Export to JSON:** Human-readable backup containing complete room vector states.
- **Import from JSON:** One-click restoration from any previous JSON room backup.

---

## Architecture & Storage

```mermaid
flowchart TD
    subgraph Client["Client Browser (Svelte 5 Runes)"]
        UI["Dual-Layer Canvas Engine"]
        Hist["History Manager (Undo/Redo)"]
        Socket["WebSocket Client (Auto-Reconnect)"]
        UI <--> Socket
        UI <--> Hist
    end

    subgraph Edge["Cloudflare Worker / Docker Container"]
        Origin["Single-Origin Router (hooks.server.ts)"]
        DO["WhiteboardRoom Durable Object"]
        SQLite[("Embedded SQLite DB")]
        MemStore["Ephemeral In-Memory Presence"]

        Origin -->|HTTP / SSR| UI
        Socket <-->|WebSocket 101| DO
        DO <-->|LWW Monotonic Upsert| SQLite
        DO <-->|30Hz Broadcast| MemStore
    end
```

### Monotonic LWW Concurrency

Conflict resolution operates strictly under monotonic Last-Write-Wins (LWW):

```sql
INSERT INTO shapes (id, type, x, y, width, height, fill, stroke, stroke_width, rotation, z_index, data, created_by, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
    type = excluded.type,
    x = excluded.x,
    y = excluded.y,
    width = excluded.width,
    height = excluded.height,
    fill = excluded.fill,
    stroke = excluded.stroke,
    stroke_width = excluded.stroke_width,
    rotation = excluded.rotation,
    z_index = excluded.z_index,
    data = excluded.data,
    updated_at = excluded.updated_at
WHERE excluded.updated_at >= shapes.updated_at;
```

---

## Tools & Keyboard Shortcuts

| Shortcut                        | Tool / Action   | Description                                |
| :------------------------------ | :-------------- | :----------------------------------------- |
| `V` or `1`                      | **Select**      | Select, drag, and manipulate shapes        |
| `P` or `2`                      | **Pen**         | Freehand vector drawing with RDP smoothing |
| `L` or `3`                      | **Line**        | Straight line tool                         |
| `A` or `4`                      | **Arrow**       | Directional vector arrow                   |
| `R` or `5`                      | **Rectangle**   | Geometric box with stroke and fill         |
| `O` or `6`                      | **Ellipse**     | Geometric circle / ellipse                 |
| `T` or `7`                      | **Text**        | Place editable text labels                 |
| `S` or `8`                      | **Sticky Note** | Collaborative colored sticky note          |
| `H` or `Space + Drag`           | **Pan Canvas**  | Navigate across the infinite canvas        |
| `Ctrl + Z`                      | **Undo**        | Revert the most recent action              |
| `Ctrl + Y` / `Ctrl + Shift + Z` | **Redo**        | Reapply the previously undone action       |
| `Delete` / `Backspace`          | **Delete**      | Remove selected shapes                     |
| `Wheel` / `Ctrl + +/-`          | **Zoom**        | Zoom viewport in and out                   |

---

## Self-Hosting with Docker

Mesh is completely self-contained. You can self-host it on any Linux VPS, Raspberry Pi, home server, or local machine.

### Quick Start with Docker Compose

```bash
# 1. Clone the repository
git clone https://github.com/VUXXE/Mesh.git
cd Mesh

# 2. Start the whiteboard server
docker compose up -d
```

Access the application at `http://localhost:4173`.

### Persistent Data

All whiteboard rooms, vector data, and SQLite databases are safely preserved in the named Docker volume `mesh_data` mapped to `/data` in the container.

### Run with Docker CLI

```bash
# Build the production image
docker build -t mesh .

# Run with persistent storage
docker run -d \
  --name mesh-whiteboard \
  --restart unless-stopped \
  -p 4173:4173 \
  -v mesh_data:/data \
  mesh
```

### Configuration Options

| Variable      | Default | Description                                                 |
| :------------ | :------ | :---------------------------------------------------------- |
| `PORT`        | `4173`  | Internal listening port                                     |
| `PERSIST_DIR` | `/data` | Directory where SQLite databases and room states are stored |

---

## Local Development

### Prerequisites

- [Bun](https://bun.sh) (v1.1+)
- Node.js (v20+ or v22+)

### Setup

```bash
# Install dependencies
bun install

# Generate Cloudflare Worker TypeScript types
bun run gen

# Run the development server
bun run dev
```

### Verification & Testing

```bash
# Run type checks and diagnostics
bun run check

# Check Prettier code formatting
bun run lint

# Format code
bun run format

# Run test suites (local edge server on :8788 required for live tests)
bun run scripts/test-handshake.ts
bun run scripts/test-sync-and-presence.ts
bun run scripts/test-room-password.ts
bun run scripts/test-room-link-parser.ts
bun run scripts/test-history.ts
bun run scripts/test-sticky-note.ts
bun run scripts/test-arrow-line.ts
bun run scripts/test-font-picker.ts
bun run scripts/test-export-import.ts
bun run scripts/test-touch-pinch.ts
bun run scripts/test-e2e.ts
```

### Production Build & Local Edge Emulation

```bash
# Build SvelteKit bundle and inject Durable Object exports
bun run build

# Preview locally with Cloudflare Workers (Miniflare/workerd)
bun run preview
```

---

## Cloudflare Deployment

Deploy Mesh to Cloudflare Workers with zero infrastructure management:

```bash
# Authenticate with Cloudflare
bunx wrangler login

# Deploy directly to your Cloudflare account
bunx wrangler deploy
```

---

## Wire Protocol Reference

All WebSocket messages are encoded as JSON strings over standard secure WebSockets (`wss://`).

### Client to Server (C2S)

- `presence:update`: Broadcasts local cursor coordinates `(x, y)` and selected shape IDs at 30Hz.
- `room:auth`: Submits a room password for authentication.
- `room:set_password`: Sets (or, when authed, changes) the room password.
- `shape:upsert`: Sends an array of created or modified `shapes[]` with millisecond timestamps.
- `shape:delete`: Sends an array of deleted shape `ids[]`.
- `canvas:clear`: Requests clearing all shapes from the active room.

### Server to Client (S2C)

- `sync:init`: Initial room snapshot containing all committed shapes and active peers sent immediately upon connection. Carries `requiresPassword: true` with empty content when the room is locked and the socket is not yet authed.
- `room:auth_ok`: Password accepted; full `sync:init` follows.
- `room:auth_failed`: Password rejected.
- `room:password_set`: A password was set on the room (sent to the setter plus a broadcast to peers).
- `presence:peer`: Broadcasts remote peer cursor updates and selection state.
- `shapes:upserted`: Propagates newly committed or updated shapes to room peers.
- `shapes:deleted`: Propagates shape deletions.
- `peer:left`: Notifies remaining peers when a user disconnects.
- `canvas:cleared`: Signals all clients to clear their canvas.

---

## License

Mesh is open-source software licensed under the [MIT License](LICENSE).
