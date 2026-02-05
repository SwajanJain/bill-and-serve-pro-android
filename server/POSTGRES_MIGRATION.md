# PostgreSQL Migration Guide

This project currently runs on SQLite in runtime (`DB_CLIENT=sqlite`), but you can now migrate all data to PostgreSQL and verify parity.

## 1) Start PostgreSQL locally

```bash
cd server
docker compose -f docker-compose.postgres.yml up -d
```

## 2) Set environment variables

```bash
cp .env.example .env
```

Make sure:

- `DB_PATH` points to your SQLite DB (default: `./data/restaurant.db`)
- `DATABASE_URL` points to your PostgreSQL instance  
  Example: `postgres://postgres:postgres@localhost:5432/bill_and_serve_pro`

## 3) Run migration (SQLite -> PostgreSQL)

```bash
npm run db:postgres:migrate
```

What it does:

- Applies `scripts/postgres/schema.sql`
- Truncates PostgreSQL tables
- Copies all rows table-by-table from SQLite
- Resets `domain_events` sequence

## 4) Verify row counts

```bash
npm run db:postgres:verify
```

This compares row counts table-by-table between SQLite and PostgreSQL and fails if mismatched.

## Notes

- This migration is idempotent and safe to re-run.
- Runtime query layer is still SQLite-oriented, so this migration block focuses on **data portability and readiness**.
