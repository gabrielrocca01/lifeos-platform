const BASE = 'http://localhost:3000';

let token = '';
const testEmail = `smoke_${Date.now()}@test.com`;

async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${label}`);
  } catch (e) {
    console.error(`❌ ${label}:`, (e as Error).message);
  }
}

// ── Core ──────────────────────────────────────────────────────────────────────

await check('GET /health', async () => {
  const r = await fetch(`${BASE}/health`);
  if (!r.ok) throw new Error(`${r.status}`);
  const body = await r.json();
  if (!body.ok) throw new Error('health not ok');
});

await check('POST /api/auth/register', async () => {
  const r = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'test1234', name: 'Smoke Test' }),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  const body = await r.json();
  if (!body.ok || !body.data?.token) throw new Error('no token in response');
  token = body.data.token;
});

await check('POST /api/auth/login', async () => {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'test1234' }),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  const body = await r.json();
  if (!body.ok || !body.data?.token) throw new Error('no token');
  token = body.data.token;
});

await check('GET /api/auth/me', async () => {
  const r = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`${r.status}`);
  const body = await r.json();
  if (!body.ok || !body.data?.email) throw new Error('no user data');
});

await check('POST /api/auth/refresh', async () => {
  const r = await fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(`${r.status}`);
  const body = await r.json();
  if (!body.ok || !body.data?.token) throw new Error('no refreshed token');
  token = body.data.token;
});

// ── Life routes ───────────────────────────────────────────────────────────────

await check('GET /api/life/habits', async () => {
  const r = await fetch(`${BASE}/api/life/habits`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`${r.status}`);
  const body = await r.json();
  if (!body.ok) throw new Error('not ok');
});

let habitId = '';
await check('POST /api/life/habits', async () => {
  const r = await fetch(`${BASE}/api/life/habits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'Smoke habit', icon: '🔥' }),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  const body = await r.json();
  if (!body.ok || !body.data?.id) throw new Error('no habit id');
  habitId = body.data.id;
});

await check('GET /api/life/habits/:id/streak', async () => {
  const r = await fetch(`${BASE}/api/life/habits/${habitId}/streak`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`${r.status}`);
  const body = await r.json();
  if (!body.ok || body.data?.streak === undefined) throw new Error('no streak');
});

await check('GET /api/life/goals', async () => {
  const r = await fetch(`${BASE}/api/life/goals`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`${r.status}`);
});

await check('GET /api/life/ideas', async () => {
  const r = await fetch(`${BASE}/api/life/ideas`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`${r.status}`);
});

await check('GET /api/life/projects', async () => {
  const r = await fetch(`${BASE}/api/life/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`${r.status}`);
});

// ── Finance routes ────────────────────────────────────────────────────────────

await check('GET /api/finance/accounts', async () => {
  const r = await fetch(`${BASE}/api/finance/accounts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`${r.status}`);
  const body = await r.json();
  if (!body.success) throw new Error('not success');
});

await check('GET /api/finance/transactions', async () => {
  const r = await fetch(`${BASE}/api/finance/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`${r.status}`);
});

// ── Auth protection checks ────────────────────────────────────────────────────

await check('GET /api/life/habits returns 401 without token', async () => {
  const r = await fetch(`${BASE}/api/life/habits`);
  if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
});

await check('GET /api/finance/accounts returns 401 without token', async () => {
  const r = await fetch(`${BASE}/api/finance/accounts`);
  if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
});

console.log('\nSmoke test completato.');
