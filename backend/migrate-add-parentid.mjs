import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('Adding parentId column to Task...');

    await client.query(`
      ALTER TABLE "Task"
      ADD COLUMN IF NOT EXISTS "parentId" TEXT
      REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);
    console.log('✓ Added Task.parentId with FK');

    await client.query(`
      CREATE INDEX IF NOT EXISTS "Task_parentId_idx" ON "Task"("parentId")
    `);
    console.log('✓ Created index on Task.parentId');

    console.log('\nDone!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
