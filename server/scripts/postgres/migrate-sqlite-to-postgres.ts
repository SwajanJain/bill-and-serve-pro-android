import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import Database from 'better-sqlite3';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TABLES_IN_ORDER = [
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

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return value;
}

async function copyTableData(sql: postgres.Sql, sqlite: Database.Database, tableName: string): Promise<void> {
  const rows = sqlite.prepare(`SELECT * FROM ${quoteIdentifier(tableName)}`).all() as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    console.log(`- ${tableName}: 0 rows`);
    return;
  }

  const columns = Object.keys(rows[0]);
  const quotedColumns = columns.map(quoteIdentifier).join(', ');
  const chunkSize = 500;
  let inserted = 0;

  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const values: unknown[] = [];
    const tuples = chunk.map((row, rowIndex) => {
      const placeholders = columns.map((_, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`);
      for (const column of columns) {
        values.push(normalizeValue(row[column]));
      }
      return `(${placeholders.join(', ')})`;
    });

    const query = `INSERT INTO ${quoteIdentifier(tableName)} (${quotedColumns}) VALUES ${tuples.join(', ')}`;
    await sql.unsafe(query, values);
    inserted += chunk.length;
  }

  console.log(`- ${tableName}: ${inserted} rows`);
}

async function run(): Promise<void> {
  const sqlitePath = process.env.DB_PATH || resolve(__dirname, '../../data/restaurant.db');
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to migrate into PostgreSQL.');
  }

  const schemaPath = resolve(__dirname, './schema.sql');
  const schemaSQL = readFileSync(schemaPath, 'utf8');

  const sqlite = new Database(sqlitePath, { readonly: true });
  const sql = postgres(databaseUrl, { max: 1, ssl: 'prefer' });

  console.log('🚚 Migrating SQLite data to PostgreSQL');
  console.log(`SQLite: ${sqlitePath}`);

  try {
    await sql.begin(async (transaction) => {
      await transaction.unsafe(schemaSQL);
      await transaction.unsafe(
        `TRUNCATE TABLE ${TABLES_IN_ORDER.map(quoteIdentifier).join(', ')} RESTART IDENTITY CASCADE`
      );

      for (const table of TABLES_IN_ORDER) {
        await copyTableData(transaction, sqlite, table);
      }

      await transaction.unsafe(`
        SELECT setval(
          pg_get_serial_sequence('domain_events', 'seq'),
          COALESCE((SELECT MAX(seq) FROM domain_events), 1),
          true
        )
      `);
    });

    console.log('✅ Migration completed successfully');
  } finally {
    sqlite.close();
    await sql.end({ timeout: 5 });
  }
}

run().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
