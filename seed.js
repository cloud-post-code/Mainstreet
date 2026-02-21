const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required to run seed.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

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

const UPSERT = `
  INSERT INTO shops (id, name, address, city, category, description, link, shop_image, product_photos)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    link = EXCLUDED.link,
    shop_image = EXCLUDED.shop_image,
    product_photos = EXCLUDED.product_photos;
`;

const PLACEHOLDER_IMAGE = 'https://placehold.co/200x200/1d761e/fefff5?text=Product';

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
      urls.push(PLACEHOLDER_IMAGE);
    }
  }
  return urls;
}

function loadShopsFromCsv(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true });
  return rows.map((row) => ({
    id: (row.ID || '').trim() || null,
    name: (row['Boutique Name'] || '').trim() || null,
    address: (row.Address || '').trim() || null,
    city: parseCityFromAddress(row.Address),
    category: null,
    description: (row['50-Word Description'] || '').trim() || null,
    link: (row.Website || '').trim() || null,
    shop_image: (row['Hero Image'] || '').trim() || null,
    product_photos: productPhotosFromRow(row)
  })).filter((s) => s.id);
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
    product_photos: s.productPhotos || null
  }));
}

async function seed() {
  const csvPath = path.join(__dirname, 'data', 'boutique-data.csv');
  const jsonPath = path.join(__dirname, 'data', 'shops.json');

  let shops;
  if (fs.existsSync(csvPath)) {
    shops = loadShopsFromCsv(csvPath);
    console.log('Using initial data from data/boutique-data.csv');
  } else if (fs.existsSync(jsonPath)) {
    shops = loadShopsFromJson(jsonPath);
    console.log('Using data from data/shops.json');
  } else {
    console.error('No data file found. Add data/boutique-data.csv or data/shops.json');
    process.exit(1);
  }

  await pool.query(CREATE_TABLE);

  for (const s of shops) {
    await pool.query(UPSERT, [
      s.id,
      s.name,
      s.address,
      s.city,
      s.category,
      s.description,
      s.link,
      s.shop_image,
      s.product_photos ? JSON.stringify(s.product_photos) : null
    ]);
  }

  console.log(`Seeded ${shops.length} shops.`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
