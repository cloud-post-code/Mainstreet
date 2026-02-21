const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mainstreet-dev-secret-change-in-production';

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
    product_photos JSONB
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

async function ensureTables() {
  if (!pool) return;
  try {
    await pool.query(CREATE_SHOPS);
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

// GET /api/shops
app.get('/api/shops', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query(
        'SELECT id, name, address, city, category, description, link, shop_image AS "shopImage", product_photos AS "productPhotos" FROM shops ORDER BY id'
      );
      return res.json(result.rows);
    } catch (err) {
      console.error('DB error:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
  }
  try {
    const fs = require('fs');
    const jsonPath = path.join(__dirname, 'data', 'shops.json');
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    return res.json(data);
  } catch (err) {
    console.error('Fallback read error:', err.message);
    return res.status(500).json({ error: 'No shops data' });
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

app.listen(PORT, async () => {
  await ensureTables();
  console.log(`Server listening on port ${PORT}`);
});
