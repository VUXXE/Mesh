function parseRoomInput(input: string): string {
	let trimmed = input.trim();
	if (trimmed.includes('/room/')) {
		trimmed = trimmed.split('/room/').pop()?.split(/[?#/]/)[0] || trimmed;
	}
	return trimmed;
}

function isValidRoomId(id: string): boolean {
	return /^[a-zA-Z0-9_-]{3,64}$/.test(id);
}

async function runRoomParserTests() {
	console.log('--- Testing Room Code & Link Parsing ---');

	// 1. Plain room code
	const code1 = parseRoomInput('room-qk5qt3');
	if (code1 !== 'room-qk5qt3' || !isValidRoomId(code1)) {
		throw new Error(`Failed on plain code: ${code1}`);
	}

	// 2. Localhost URL
	const code2 = parseRoomInput('http://localhost:4173/room/room-qk5qt3');
	if (code2 !== 'room-qk5qt3' || !isValidRoomId(code2)) {
		throw new Error(`Failed on localhost URL: ${code2}`);
	}

	// 3. HTTPS production URL with trailing slash and params
	const code3 = parseRoomInput('https://mesh.workers.dev/room/room-alpha99/?ref=share#top');
	if (code3 !== 'room-alpha99' || !isValidRoomId(code3)) {
		throw new Error(`Failed on production URL: ${code3}`);
	}

	console.log('PASSED: Room code and URL extraction verified successfully!\n');
}

runRoomParserTests().catch((err) => {
	console.error(err);
	process.exit(1);
});
