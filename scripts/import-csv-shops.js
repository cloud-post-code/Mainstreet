#!/usr/bin/env node
/**
 * Imports shops from a CRM CSV into Main Street data.
 * Usage: node scripts/import-csv-shops.js <path-to-csv>
 * Writes: data/boutique-data.csv, data/shops.json
 */

const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

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

function getIdFromRow(row) {
  return (row.ID || '').trim() || null;
}

function main() {
  const csvPath = process.argv[2] || path.join(__dirname, '../data/boutique-data.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found:', csvPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true });

  const seen = new Set();
  const shops = [];
  for (const row of rows) {
    const id = getIdFromRow(row);
    if (!id) continue;
    const name = (row['Boutique Name'] || '').trim() || null;
    const key = (name || '').trim().toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);

    const address = (row.Address || '').trim() || null;
    const shopImage = (row['Hero Image'] || '').trim() || null;
    const logo = (row.Logo || '').trim() || null;
    const heroOrLogo = shopImage || (logo && logo.toLowerCase().startsWith('http') ? logo : null);

    shops.push({
      id,
      name,
      address,
      city: parseCityFromAddress(address),
      category: (row.Category || row['Shop Type'] || '').trim() || null,
      description: (row['50-Word Description'] || '').trim() || null,
      link: (row.Website || '').trim() || null,
      shopImage: heroOrLogo,
      logo: logo || null,
      productPhotos: productPhotosFromRow(row),
      productCount: (row['Estimated Item Count'] || '').trim() || null
    });
  }

  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  // Write shops.json (frontend/API shape when no DB)
  const jsonPath = path.join(dataDir, 'shops.json');
  const jsonShops = shops.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    city: s.city,
    category: s.category,
    description: s.description,
    link: s.link,
    shopImage: s.shopImage,
    logo: s.logo,
    productPhotos: s.productPhotos,
    productCount: s.productCount
  }));
  fs.writeFileSync(jsonPath, JSON.stringify(jsonShops, null, 2), 'utf8');
  console.log('Wrote', jsonPath, 'with', jsonShops.length, 'shops');

  // Copy CSV to data/boutique-data.csv for DB seeding
  const destCsv = path.join(dataDir, 'boutique-data.csv');
  if (path.resolve(csvPath) !== path.resolve(destCsv)) {
    fs.copyFileSync(csvPath, destCsv);
    console.log('Copied CSV to', destCsv);
  }
}

main();
