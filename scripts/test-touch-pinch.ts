async function testTouchPinch() {
	console.log('--- Testing Multi-touch Pinch Zoom & Pan Math ---');

	// Initial two-finger touch: distance = 100px, midpoint = (200, 200)
	const t1_initial = { x: 150, y: 200 };
	const t2_initial = { x: 250, y: 200 };

	const initialDist = Math.hypot(t2_initial.x - t1_initial.x, t2_initial.y - t1_initial.y);
	const initialMidpoint = {
		x: (t1_initial.x + t2_initial.x) / 2,
		y: (t1_initial.y + t2_initial.y) / 2
	};

	if (initialDist !== 100 || initialMidpoint.x !== 200 || initialMidpoint.y !== 200) {
		throw new Error('Initial pinch calculation incorrect.');
	}

	let currentZoom = 1.0;
	let panX = 0;
	let panY = 0;

	// Finger spread to distance = 200px (2x zoom in) and shifted +50px X, +30px Y
	const t1_moved = { x: 150, y: 230 };
	const t2_moved = { x: 350, y: 230 };

	const currentDist = Math.hypot(t2_moved.x - t1_moved.x, t2_moved.y - t1_moved.y);
	const currentMidpoint = {
		x: (t1_moved.x + t2_moved.x) / 2,
		y: (t1_moved.y + t2_moved.y) / 2
	};

	const scale = currentDist / initialDist;
	const newZoom = Math.min(Math.max(currentZoom * scale, 0.1), 5.0);

	const mX = initialMidpoint.x;
	const mY = initialMidpoint.y;
	const panDeltaX = currentMidpoint.x - initialMidpoint.x;
	const panDeltaY = currentMidpoint.y - initialMidpoint.y;

	const newPanX = mX - (mX - panX) * (newZoom / currentZoom) + panDeltaX;
	const newPanY = mY - (mY - panY) * (newZoom / currentZoom) + panDeltaY;

	if (newZoom !== 2.0) {
		throw new Error(`Expected newZoom to be 2.0, got ${newZoom}`);
	}
	if (panDeltaX !== 50 || panDeltaY !== 30) {
		throw new Error(`Expected pan delta (50, 30), got (${panDeltaX}, ${panDeltaY})`);
	}
	if (newPanX !== -150 || newPanY !== -170) {
		throw new Error(`Expected new pan (-150, -170), got (${newPanX}, ${newPanY})`);
	}

	// Extreme zoom in (clamp test)
	const extremeScale = 100;
	const clampedZoom = Math.min(Math.max(currentZoom * extremeScale, 0.1), 5.0);
	if (clampedZoom !== 5.0) {
		throw new Error(`Expected clamped zoom to be 5.0, got ${clampedZoom}`);
	}

	console.log('PASSED: Multi-touch pinch zoom & pan transformation math verified!\n');
}

testTouchPinch().catch((err) => {
	console.error(err);
	process.exit(1);
});
