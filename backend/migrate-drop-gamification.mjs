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
    console.log('Dropping gamification tables and columns...');

    await client.query(`DROP TABLE IF EXISTS "UserAchievement" CASCADE`);
    console.log('✓ Dropped UserAchievement');

    await client.query(`DROP TABLE IF EXISTS "Achievement" CASCADE`);
    console.log('✓ Dropped Achievement');

    await client.query(`DROP TABLE IF EXISTS "ActivityLog" CASCADE`);
    console.log('✓ Dropped ActivityLog');

    // Remove gamification columns from User
    for (const col of ['xp', 'level', 'streak', 'longestStreak', 'lastActiveDate']) {
      await client.query(`ALTER TABLE "User" DROP COLUMN IF EXISTS "${col}"`);
      console.log(`✓ Dropped User.${col}`);
    }

    // Remove xpReward from Task
    await client.query(`ALTER TABLE "Task" DROP COLUMN IF EXISTS "xpReward"`);
    console.log('✓ Dropped Task.xpReward');

    console.log('\nAll done!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
