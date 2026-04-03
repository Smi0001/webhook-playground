require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  // Run every *.sql file in this directory, in alphabetical order
  const files = fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf-8');
      await pool.query(sql);
      console.log(`  ✓ ${file}`);
    }
    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
