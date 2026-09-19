import { Database } from 'bun:sqlite';

console.log('=== Running Worker Efficiency Verification Tests ===');

// Test 1: SQLite Upsert with RETURNING * and LWW conflict resolution
{
	const db = new Database(':memory:');
	db.exec(`
		CREATE TABLE shapes (
			id TEXT PRIMARY KEY NOT NULL,
			type TEXT NOT NULL,
			x REAL NOT NULL DEFAULT 0.0,
			y REAL NOT NULL DEFAULT 0.0,
			width REAL DEFAULT 0.0,
			height REAL DEFAULT 0.0,
			fill TEXT DEFAULT 'transparent',
			stroke TEXT DEFAULT '#000000',
			stroke_width REAL DEFAULT 2.0,
			rotation REAL DEFAULT 0.0,
			z_index INTEGER DEFAULT 0,
			data TEXT,
			created_by TEXT NOT NULL,
			updated_at INTEGER NOT NULL
		);
	`);

	const upsertStmt = `
		INSERT INTO shapes (
			id, type, x, y, width, height, fill, stroke, stroke_width, rotation, z_index, data, created_by, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
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
		WHERE excluded.updated_at >= shapes.updated_at
		RETURNING id, type, x, y, width, height, fill, stroke, stroke_width, rotation, z_index, data, created_by, updated_at;
	`;

	const stmt = db.prepare(upsertStmt);

	// Insert initial shape
	const inserted = stmt.get(
		's1',
		'rectangle',
		10.0,
		20.0,
		100.0,
		50.0,
		'#fff',
		'#000',
		2.0,
		0.0,
		1,
		null,
		'user_1',
		1000
	) as any;

	console.log(
		'Test 1 - Initial insert with RETURNING returned row:',
		inserted !== null && inserted.id === 's1'
	);
	if (!inserted || inserted.x !== 10.0) throw new Error('Test 1 failed on initial insert');

	// Newer update (1050 > 1000) should succeed and return updated row
	const updated = stmt.get(
		's1',
		'rectangle',
		35.5,
		45.5,
		120.0,
		60.0,
		'#fff',
		'#000',
		2.0,
		0.0,
		1,
		null,
		'user_1',
		1050
	) as any;

	console.log(
		'Test 1 - Newer update returned updated row:',
		updated !== null && updated.x === 35.5
	);
	if (!updated || updated.x !== 35.5) throw new Error('Test 1 failed on newer update');

	// Stale update (900 < 1050) should be dropped by LWW WHERE clause and RETURNING should return null/undefined
	const stale = stmt.get(
		's1',
		'rectangle',
		99.0,
		99.0,
		120.0,
		60.0,
		'#fff',
		'#000',
		2.0,
		0.0,
		1,
		null,
		'user_1',
		900
	);

	console.log('Test 1 - Stale update correctly returned null without error:', stale === null);
	if (stale !== null) throw new Error('Test 1 failed: stale update was not rejected by RETURNING!');
}

// Test 2: Batch DELETE with WHERE id IN (...)
{
	const db = new Database(':memory:');
	db.exec(`
		CREATE TABLE shapes (id TEXT PRIMARY KEY, type TEXT);
		INSERT INTO shapes VALUES ('s1', 'rectangle'), ('s2', 'ellipse'), ('s3', 'path');
	`);

	const validIds = ['s1', 's3'];
	const placeholders = validIds.map(() => '?').join(',');
	db.prepare(`DELETE FROM shapes WHERE id IN (${placeholders})`).run(...validIds);

	const remaining = db.prepare('SELECT id FROM shapes').all() as any[];
	console.log('Test 2 - Batch delete remaining count:', remaining.length, 'expected: 1 (s2)');
	if (remaining.length !== 1 || remaining[0].id !== 's2')
		throw new Error('Test 2 failed on batch delete');
}

// Test 3: Float coordinate rounding
{
	const round1 = (n: number | undefined): number =>
		typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : (n ?? 0);

	const rawFloat = 142.8491029384;
	const rounded = round1(rawFloat);
	console.log('Test 3 - Rounded float:', rounded, 'expected: 142.8');
	if (rounded !== 142.8) throw new Error('Test 3 failed on float rounding');

	const jsonRaw = JSON.stringify({ x: rawFloat, y: rawFloat });
	const jsonRounded = JSON.stringify({ x: rounded, y: rounded });
	console.log(
		`Test 3 - Byte size reduction: ${jsonRaw.length}B -> ${jsonRounded.length}B (${Math.round((1 - jsonRounded.length / jsonRaw.length) * 100)}% smaller)`
	);
	if (jsonRounded.length >= jsonRaw.length) throw new Error('Test 3 failed on size compression');
}

// Test 4: Smart Shape Count Caching & Threshold Recalibration
{
	let countQueriesExecuted = 0;
	let cachedCount: number | null = null;
	const db = new Database(':memory:');
	db.exec(`
		CREATE TABLE shapes (id TEXT PRIMARY KEY, type TEXT);
		INSERT INTO shapes VALUES ('s1', 'rectangle'), ('s2', 'ellipse');
	`);

	const queryCountFromDb = (): number => {
		countQueriesExecuted++;
		const row = db.prepare('SELECT COUNT(*) as count FROM shapes').get() as { count: number };
		return row.count;
	};

	const getShapeCount = (): number => {
		if (cachedCount === null || cachedCount >= 9000) {
			cachedCount = queryCountFromDb();
		}
		return cachedCount;
	};

	// Initially null: queries DB once
	if (getShapeCount() !== 2) throw new Error('Test 4 initial count mismatch');
	if (countQueriesExecuted !== 1) throw new Error('Test 4 should have queried once');

	// Subsequent calls use cache, 0 extra DB queries
	if (getShapeCount() !== 2) throw new Error('Test 4 cached count mismatch');
	if (countQueriesExecuted !== 1) throw new Error('Test 4 should not have queried DB again');

	// Simulate 100 upserts (cachedCount incremented in memory)
	cachedCount += 100;
	if (getShapeCount() !== 102) throw new Error('Test 4 count increment mismatch');
	if (countQueriesExecuted !== 1)
		throw new Error('Test 4 should not query DB during regular upserts');

	// When crossing 9000 threshold, it auto-recalibrates from DB
	cachedCount = 9050;
	const recalibrated = getShapeCount();
	if (recalibrated !== 2) throw new Error(`Test 4 recalibration failed, got ${recalibrated}`);
	if (countQueriesExecuted !== 2)
		throw new Error('Test 4 should have recalibrated by querying DB once');

	console.log(
		'Test 4 - Smart count caching & threshold recalibration passed (0 queries during normal updates)'
	);
}

console.log('=== All Worker Efficiency Tests Passed Successfully! ===');
