# Backup and Restore SOP

## Backup schedule

- Automatic backups run:
  - Every 4 hours
  - Daily at 02:00
- Manual backup available in **Settings → Backups** (owner only)

## Manual backup

1. Login as owner.
2. Open **Settings**.
3. In **Backups**, click **Create Backup Now**.
4. Verify new entry appears with timestamp and size.

## Restore backup

1. Login as owner.
2. Open **Settings → Backups**.
3. Click **Restore** for desired backup file.
4. Confirm restore action.
5. Wait until success toast appears.

## Drill checklist (weekly)

1. Create a fresh manual backup.
2. Add a test order.
3. Restore to previous backup.
4. Confirm test order is gone and historical data is intact.
5. Recreate manual backup after drill.

## File locations

- Database: `server/data/restaurant.db`
- Backups: `server/backups/*.db`
- Metadata/checksum: `server/backups/*.db.json`

## Recovery target

- Target recovery time: **≤ 15 minutes** for single-server failure.
