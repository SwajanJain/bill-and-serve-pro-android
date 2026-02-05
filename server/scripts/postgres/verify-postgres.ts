import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TABLES = [
  'users',
  'areas',
  'tables',
  'categories',
  'menu_items',
  'orders',
  'order_lines',
  'kots',
  'kot_lines',
  'payments',
  'raw_materials',
  'stock_transactions',
  'audit_events',
  'settings',
  'sequences',
  'device_sessions',
  'idempotency_keys',
  'sync_actions',
  'sync_cursors',
  'domain_events',
] as const;

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function run(): Promise<void> {
  const sqlitePath = process.env.DB_PATH || resolve(__dirname, '../../data/restaurant.db');
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const sqlite = new Database(sqlitePath, { readonly: true });
  const sql = postgres(databaseUrl, { max: 1, ssl: 'prefer' });

  let mismatchCount = 0;
  try {
    for (const table of TABLES) {
      const sqliteCount = sqlite.prepare(`SELECT COUNT(*) as count FROM ${quoteIdentifier(table)}`).get() as { count: number };
      const postgresCount = await sql<{ count: string }[]>`SELECT COUNT(*)::text as count FROM ${sql(table)}`;
      const sqliteValue = Number(sqliteCount.count || 0);
      const postgresValue = Number(postgresCount[0]?.count || 0);
      const match = sqliteValue === postgresValue;

      if (!match) {
        mismatchCount += 1;
      }

      console.log(
        `${match ? '✅' : '❌'} ${table}: sqlite=${sqliteValue} postgres=${postgresValue}`
      );
    }
  } finally {
    sqlite.close();
    await sql.end({ timeout: 5 });
  }

  if (mismatchCount > 0) {
    throw new Error(`Found ${mismatchCount} table count mismatches.`);
  }
}

run().catch((error) => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
