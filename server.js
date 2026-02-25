const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const { parse } = require('csv-parse/sync');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mainstreet-dev-secret-change-in-production';

// Security headers (common on Railway: HSTS, X-Content-Type-Options, etc.)
app.use(helmet({ contentSecurityPolicy: false }));
// CORS: allow credentials (cookies) from same origin; adjust origin in production
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Serve static files from public/ (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Health check for Railway
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Client config (e.g. Google Maps API key) – only expose non-secret keys needed by frontend
app.get('/api/config', (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY || '';
  if (process.env.NODE_ENV !== 'production') {
    console.log('[api/config] Requested; key present:', !!key);
  }
  res.json({
    googleMapsApiKey: key
  });
});

// Database
let pool = null;
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });
}

const CREATE_SHOPS = `
  CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    name TEXT,
    address TEXT,
    city TEXT,
    category TEXT,
    description TEXT,
    link TEXT,
    shop_image TEXT,
    logo TEXT,
    product_photos JSONB,
    product_count TEXT
  );
`;

const CREATE_USERS = `
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    subscribe_emails BOOLEAN DEFAULT false,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

const CREATE_COMMENTS = `
  CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    shop_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`;
const CREATE_COMMENTS_INDEX = `CREATE INDEX IF NOT EXISTS comments_shop_id_idx ON comments(shop_id);`;

const CREATE_FAVORITES = `
  CREATE TABLE IF NOT EXISTS favorites (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_id TEXT NOT NULL,
    PRIMARY KEY (user_id, shop_id)
  );
`;

const SHOP_UPSERT = `
  INSERT INTO shops (id, name, address, city, category, description, link, shop_image, logo, product_photos, product_count)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    link = EXCLUDED.link,
    shop_image = EXCLUDED.shop_image,
    logo = EXCLUDED.logo,
    product_photos = EXCLUDED.product_photos,
    product_count = EXCLUDED.product_count;
`;

const SEED_PLACEHOLDER_IMAGE = 'https://placehold.co/200x200/1d761e/fefff5?text=Product';

function parseCityFromAddress(addressStr) {
  if (!addressStr || typeof addressStr !== 'string') return null;
  const parts = addressStr.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[1];
  return null;
}

function productPhotosFromRow(row) {
  const urls = [];
  for (let i = 1; i <= 6; i++) {
    const val = row['Product Images ' + i];
    if (val && typeof val === 'string' && val.trim().toLowerCase().startsWith('http')) {
      urls.push(val.trim());
    } else {
      urls.push(SEED_PLACEHOLDER_IMAGE);
    }
  }
  return urls;
}

function getIdFromRow(row) {
  const firstKey = Object.keys(row)[0];
  return (row.ID || (firstKey !== undefined ? row[firstKey] : '') || row[''] || '').trim() || null;
}

function loadShopsFromCsv(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true });
  return rows.map((row) => ({
    id: getIdFromRow(row) || null,
    name: (row['Boutique Name'] || '').trim() || null,
    address: (row.Address || '').trim() || null,
    city: parseCityFromAddress(row.Address),
    category: (row['Shop Type'] || row.Category || '').trim() || null,
    description: (row['50-Word Description'] || '').trim() || null,
    link: (row.Website || '').trim() || null,
    shop_image: (row['Hero Image'] || '').trim() || null,
    logo: (row.Logo || '').trim() || null,
    product_photos: productPhotosFromRow(row),
    product_count: (row['Estimated Item Count'] || '').trim() || null
  }))
    .filter((s) => s.id)
    .filter(dedupeByShopName());
}

function dedupeByShopName() {
  const seen = new Set();
  return (shop) => {
    const key = (shop.name || '').trim().toLowerCase();
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
}

function loadShopsFromJson(jsonPath) {
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw);
  return data.map((s) => ({
    id: s.id,
    name: s.name ?? null,
    address: s.address ?? null,
    city: s.city ?? null,
    category: s.category ?? null,
    description: s.description ?? null,
    link: s.link ?? null,
    shop_image: s.shopImage ?? null,
    logo: s.logo ?? null,
    product_photos: s.productPhotos || null,
    product_count: s.productCount ?? s.product_count ?? null
  }));
}

async function runSeedShops() {
  const csvPath = path.join(__dirname, 'data', 'boutique-data.csv');
  const jsonPath = path.join(__dirname, 'data', 'shops.json');
  let shops;
  if (fs.existsSync(csvPath)) {
    shops = loadShopsFromCsv(csvPath);
  } else if (fs.existsSync(jsonPath)) {
    shops = loadShopsFromJson(jsonPath);
  } else {
    return { error: 'No data file found (data/boutique-data.csv or data/shops.json)' };
  }
  for (const s of shops) {
    await pool.query(SHOP_UPSERT, [
      s.id,
      s.name,
      s.address,
      s.city,
      s.category,
      s.description,
      s.link,
      s.shop_image,
      s.logo,
      s.product_photos ? JSON.stringify(s.product_photos) : null,
      s.product_count || null
    ]);
  }
  return { count: shops.length };
}

// Admin required: must be signed in and is_admin in DB
async function adminRequired(req, res, next) {
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    const row = result.rows[0];
    if (!row || !row.is_admin) return res.status(403).json({ error: 'Admin only' });
    next();
  } catch (err) {
    console.error('Admin check error:', err.message);
    res.status(500).json({ error: 'Failed to verify admin' });
  }
}

async function ensureTables() {
  if (!pool) return;
  try {
    await pool.query(CREATE_SHOPS);
    await pool.query('ALTER TABLE shops ADD COLUMN IF NOT EXISTS product_count TEXT');
    await pool.query('ALTER TABLE shops ADD COLUMN IF NOT EXISTS enter_store_clicks INTEGER DEFAULT 0');
    await pool.query(CREATE_USERS);
    await pool.query(CREATE_COMMENTS);
    await pool.query(CREATE_COMMENTS_INDEX);
    await pool.query(CREATE_FAVORITES);
  } catch (err) {
    console.error('Failed to create tables:', err.message);
  }
}

// Auth: optional middleware – sets req.user if valid JWT cookie
function authOptional(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    next();
  }
}

// Auth: required – 401 if not signed in
function authRequired(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Sign in required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    subscribe_emails: row.subscribe_emails,
    is_admin: row.is_admin
  };
}

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });
  const { email, username, password, subscribe_emails } = req.body || {};
  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedUsername = (username || '').trim();
  if (!trimmedEmail || !trimmedUsername || !password) {
    return res.status(400).json({ error: 'Email, username, and password are required' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const password_hash = await bcrypt.hash(password, 10);
  const id = crypto.randomUUID();
  try {
    await pool.query(
      'INSERT INTO users (id, email, username, password_hash, subscribe_emails) VALUES ($1, $2, $3, $4, $5)',
      [id, trimmedEmail, trimmedUsername, password_hash, Boolean(subscribe_emails)]
    );
    const user = { id, email: trimmedEmail, username: trimmedUsername, subscribe_emails: Boolean(subscribe_emails), is_admin: false };
    const token = jwt.sign({ id, email: trimmedEmail, username: trimmedUsername }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
    return res.json({ user: publicUser(user) });
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint?.includes('email')) return res.status(409).json({ error: 'Email already registered' });
      if (err.constraint?.includes('username')) return res.status(409).json({ error: 'Username already taken' });
    }
    console.error('Register error:', err.message);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });
  const { email_or_username, password } = req.body || {};
  const input = (email_or_username || '').trim();
  if (!input || !password) {
    return res.status(400).json({ error: 'Email/username and password are required' });
  }
  try {
    const isEmail = input.includes('@');
    const result = await pool.query(
      'SELECT id, email, username, password_hash, subscribe_emails, is_admin FROM users WHERE ' + (isEmail ? 'email = $1' : 'username = $1'),
      [isEmail ? input.toLowerCase() : input]
    );
    const row = result.rows[0];
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      return res.status(401).json({ error: 'Invalid email/username or password' });
    }
    const user = publicUser(row);
    const token = jwt.sign({ id: row.id, email: row.email, username: row.username }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
    return res.json({ user });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
});

// GET /api/auth/me
app.get('/api/auth/me', authOptional, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const result = await pool.query(
      'SELECT id, email, username, subscribe_emails, is_admin FROM users WHERE id = $1',
      [req.user.id]
    );
    const row = result.rows[0];
    if (!row) return res.status(401).json({ error: 'User not found' });
    return res.json(publicUser(row));
  } catch (err) {
    console.error('Auth me error:', err.message);
    return res.status(500).json({ error: 'Failed to get user' });
  }
});

// Query with timeout so slow DB does not hang the request
function queryWithTimeout(p, text, values, ms) {
  ms = ms || 10000;
  return Promise.race([
    p.query(text, values),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), ms))
  ]);
}

// GET /api/shops
app.get('/api/shops', async (req, res) => {
  if (pool) {
    try {
      const result = await queryWithTimeout(
        pool,
        'SELECT id, name, address, city, category, description, link, shop_image AS "shopImage", logo, product_photos AS "productPhotos", product_count AS "productCount", enter_store_clicks AS "enterStoreClicks" FROM shops ORDER BY id',
        [],
        10000
      );
      return res.json(result.rows);
    } catch (err) {
      console.error('DB error:', err.message);
      return res.status(500).json({ error: err.message === 'Query timeout' ? 'Database timeout' : 'Database error' });
    }
  }
  try {
    const jsonPath = path.join(__dirname, 'data', 'shops.json');
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    return res.json(data);
  } catch (err) {
    console.error('Fallback read error:', err.message);
    return res.status(500).json({ error: 'No shops data' });
  }
});

// POST /api/shops/:id/enter – record "Enter store" click (non-admin only)
app.post('/api/shops/:id/enter', authOptional, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });
  const shopId = req.params.id;
  if (!shopId) return res.status(400).json({ error: 'Shop id required' });
  try {
    if (req.user) {
      const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
      const row = result.rows[0];
      if (row && row.is_admin) return res.status(204).end();
    }
    const update = await pool.query(
      'UPDATE shops SET enter_store_clicks = COALESCE(enter_store_clicks, 0) + 1 WHERE id = $1',
      [shopId]
    );
    if (update.rowCount === 0) return res.status(404).json({ error: 'Shop not found' });
    return res.status(204).end();
  } catch (err) {
    console.error('Enter store click error:', err.message);
    return res.status(500).json({ error: 'Failed to record click' });
  }
});

// GET /api/shops/:shopId/comments
app.get('/api/shops/:shopId/comments', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });
  const { shopId } = req.params;
  try {
    const result = await pool.query(
      'SELECT c.id, c.shop_id, c.user_id, c.text, c.created_at, u.username FROM comments c JOIN users u ON u.id = c.user_id WHERE c.shop_id = $1 ORDER BY c.created_at ASC',
      [shopId]
    );
    return res.json(result.rows.map(r => ({
      id: r.id,
      shop_id: r.shop_id,
      user_id: r.user_id,
      username: r.username,
      text: r.text,
      created_at: r.created_at
    })));
  } catch (err) {
    console.error('Comments get error:', err.message);
    return res.status(500).json({ error: 'Failed to load comments' });
  }
});

// POST /api/shops/:shopId/comments (auth required)
app.post('/api/shops/:shopId/comments', authRequired, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });
  const { shopId } = req.params;
  const { text } = req.body || {};
  const trimmed = (text || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'Comment text is required' });
  try {
    const result = await pool.query(
      'INSERT INTO comments (shop_id, user_id, text) VALUES ($1, $2, $3) RETURNING id, shop_id, user_id, text, created_at',
      [shopId, req.user.id, trimmed]
    );
    const row = result.rows[0];
    return res.status(201).json({
      id: row.id,
      shop_id: row.shop_id,
      user_id: row.user_id,
      username: req.user.username,
      text: row.text,
      created_at: row.created_at
    });
  } catch (err) {
    console.error('Comment post error:', err.message);
    return res.status(500).json({ error: 'Failed to post comment' });
  }
});

// GET /api/favorites (auth required)
app.get('/api/favorites', authRequired, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const result = await pool.query('SELECT shop_id FROM favorites WHERE user_id = $1', [req.user.id]);
    return res.json(result.rows.map(r => r.shop_id));
  } catch (err) {
    console.error('Favorites get error:', err.message);
    return res.status(500).json({ error: 'Failed to load favorites' });
  }
});

// POST /api/favorites – body: { shopId }. Toggle (add if missing, remove if present)
app.post('/api/favorites', authRequired, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });
  const { shopId } = req.body || {};
  if (!shopId) return res.status(400).json({ error: 'shopId is required' });
  try {
    const existing = await pool.query('SELECT 1 FROM favorites WHERE user_id = $1 AND shop_id = $2', [req.user.id, shopId]);
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM favorites WHERE user_id = $1 AND shop_id = $2', [req.user.id, shopId]);
      return res.json({ favorited: false, shopId });
    } else {
      await pool.query('INSERT INTO favorites (user_id, shop_id) VALUES ($1, $2)', [req.user.id, shopId]);
      return res.json({ favorited: true, shopId });
    }
  } catch (err) {
    console.error('Favorites toggle error:', err.message);
    return res.status(500).json({ error: 'Failed to update favorite' });
  }
});

// POST /api/admin/shops – create one shop (admin only)
app.post('/api/admin/shops', authRequired, adminRequired, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });
  const body = req.body || {};
  const name = (body.name != null && body.name !== undefined) ? String(body.name).trim() : '';
  const address = (body.address != null && body.address !== undefined) ? String(body.address) : '';
  const city = (body.city != null && body.city !== undefined) ? String(body.city) : '';
  const category = (body.category != null && body.category !== undefined) ? String(body.category) : '';
  const description = (body.description != null && body.description !== undefined) ? String(body.description) : '';
  const link = (body.link != null && body.link !== undefined) ? String(body.link) : '';
  const shop_image = (body.shop_image != null && body.shop_image !== undefined) ? String(body.shop_image) : '';
  const logo = (body.logo != null && body.logo !== undefined) ? String(body.logo) : '';
  const product_count = (body.product_count != null && body.product_count !== undefined) ? String(body.product_count) : '';
  let product_photos = body.product_photos;
  if (!Array.isArray(product_photos)) {
    if (typeof product_photos === 'string' && product_photos.trim()) {
      try {
        product_photos = JSON.parse(product_photos);
      } catch (e) {
        product_photos = [];
      }
    } else {
      product_photos = [];
    }
  }
  const slug = name
    ? name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || null
    : null;
  let id = slug || 'shop-' + crypto.randomBytes(6).toString('hex');
  try {
    const existing = await pool.query('SELECT id FROM shops WHERE id = $1', [id]);
    if (existing.rows.length > 0) {
      id = (slug || 'shop') + '-' + crypto.randomBytes(4).toString('hex');
    }
    await pool.query(SHOP_UPSERT, [
      id, name, address, city, category, description, link, shop_image, logo,
      JSON.stringify(product_photos), product_count
    ]);
    const result = await pool.query(
      'SELECT id, name, address, city, category, description, link, shop_image AS "shopImage", logo, product_photos AS "productPhotos", product_count AS "productCount" FROM shops WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) return res.status(500).json({ error: 'Create failed' });
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.message && err.message.includes('JSON')) return res.status(400).json({ error: 'Invalid product_photos' });
    console.error('Admin POST shop error:', err.message);
    return res.status(500).json({ error: 'Create failed' });
  }
});

// PATCH /api/admin/shops/:id – update one shop (admin only)
app.patch('/api/admin/shops/:id', authRequired, adminRequired, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });
  const { id } = req.params;
  const body = req.body || {};
  const allowed = ['name', 'address', 'city', 'category', 'description', 'link', 'shop_image', 'logo', 'product_photos', 'product_count'];
  const updates = [];
  const values = [];
  let paramIndex = 1;
  for (const key of allowed) {
    const camel = key === 'shop_image' ? 'shopImage' : key === 'product_photos' ? 'productPhotos' : key === 'product_count' ? 'productCount' : key;
    const val = body[camel] !== undefined ? body[camel] : body[key];
    if (val === undefined) continue;
    if (key === 'product_photos') {
      const arr = Array.isArray(val) ? val : (typeof val === 'string' ? (val.trim() ? JSON.parse(val) : []) : []);
      updates.push(key + ' = $' + paramIndex);
      values.push(JSON.stringify(arr));
    } else {
      updates.push(key + ' = $' + paramIndex);
      values.push(typeof val === 'string' ? val : (val == null ? null : String(val)));
    }
    paramIndex++;
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(id);
  const setClause = updates.join(', ');
  try {
    const result = await pool.query(
      'UPDATE shops SET ' + setClause + ' WHERE id = $' + paramIndex + ' RETURNING id, name, address, city, category, description, link, shop_image AS "shopImage", logo, product_photos AS "productPhotos", product_count AS "productCount"',
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    if (err.message && err.message.includes('JSON')) return res.status(400).json({ error: 'Invalid product_photos JSON' });
    console.error('Admin PATCH shop error:', err.message);
    return res.status(500).json({ error: 'Update failed' });
  }
});

// DELETE /api/admin/shops/:id – delete one shop (admin only)
app.delete('/api/admin/shops/:id', authRequired, adminRequired, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM shops WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
    return res.status(204).send();
  } catch (err) {
    console.error('Admin DELETE shop error:', err.message);
    return res.status(500).json({ error: 'Delete failed' });
  }
});

// POST /api/admin/seed – sync shop data from CSV/JSON (admin only)
app.post('/api/admin/seed', authRequired, adminRequired, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const result = await runSeedShops();
    if (result.error) return res.status(400).json({ error: result.error });
    return res.json({ ok: true, count: result.count });
  } catch (err) {
    console.error('Admin seed error:', err.message);
    return res.status(500).json({ error: 'Seed failed' });
  }
});

// 404 – log so you can see what path is "not found" (e.g. in Railway logs)
app.use((req, res) => {
  console.warn('404:', req.method, req.path);
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.listen(PORT, async () => {
  await ensureTables();
  console.log(`Server listening on port ${PORT}`);
});
