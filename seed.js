const path = require('path');
const fs = require('fs');
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

async function seed() {
  const jsonPath = path.join(__dirname, 'data', 'shops.json');
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const shops = JSON.parse(raw);

  await pool.query(CREATE_TABLE);

  for (const s of shops) {
    await pool.query(UPSERT, [
      s.id,
      s.name ?? null,
      s.address ?? null,
      s.city ?? null,
      s.category ?? null,
      s.description ?? null,
      s.link ?? null,
      s.shopImage ?? null,
      s.productPhotos ? JSON.stringify(s.productPhotos) : null
    ]);
  }

  console.log(`Seeded ${shops.length} shops.`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
