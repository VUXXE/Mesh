import type { Handle } from '@sveltejs/kit';

const ROOM_ID_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	const match = pathname.match(/^\/api\/room\/([^/]+)\/ws$/);

	if (match) {
		const roomId = match[1];

		// Room ID validation (PRD §9.1)
		if (!ROOM_ID_REGEX.test(roomId)) {
			return new Response('Invalid room ID. Must match /^[a-zA-Z0-9_-]{3,64}$/', { status: 400 });
		}

		const upgrade = event.request.headers.get('Upgrade');
		if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
			return new Response('Expected WebSocket upgrade', { status: 426 });
		}

		const env = event.platform?.env;
		if (!env || !env.ROOMS) {
			return new Response('Durable Objects binding ROOMS is not available on this platform', {
				status: 500
			});
		}

		const id = env.ROOMS.idFromName(roomId);
		const stub = env.ROOMS.get(id);
		return stub.fetch(event.request);
	}

	return resolve(event);
};
