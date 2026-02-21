const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from public/ (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Health check for Railway
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// GET /api/shops – from database or fallback to JSON file when no DB
let pool = null;
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });
}

const CREATE_TABLE = `
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

async function ensureTable() {
  if (!pool) return;
  try {
    await pool.query(CREATE_TABLE);
  } catch (err) {
    console.error('Failed to create shops table:', err.message);
  }
}

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
  // Fallback: serve from data/shops.json when no DATABASE_URL (e.g. local dev without DB)
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

app.listen(PORT, async () => {
  await ensureTable();
  console.log(`Server listening on port ${PORT}`);
});
