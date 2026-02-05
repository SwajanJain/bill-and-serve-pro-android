# 7-Day Pilot Runbook (Single Restaurant)

## Objective

Validate production stability in live shifts before final go-live:

- No missing orders
- No duplicate payments
- Offline waiter flow remains usable
- Conflicts stay manageable and visible

## Pilot Scope

- 1 restaurant
- 2–4 waiter devices (Android)
- 1 cashier desktop browser
- 1 kitchen screen/user (if enabled)

## Day 0 (Pre-Pilot Setup)

1. Confirm backend is running from on-prem machine:
   - `http://<server-ip>:3001/api/health`
2. On all Android devices:
   - Login screen → `Server` → set server URL.
3. Confirm each device can:
   - create order
   - send KOT
   - complete payment
4. Create a manual backup from `Settings -> Backups`.

## Daily Test Window (10–15 min before business peak)

1. Put one waiter device offline (airplane mode).
2. Create/edit order on offline device (table with open order).
3. Re-enable network and confirm sync in cashier screen.
4. Verify no duplicate line/payment entries.
5. Check `Settings -> Sync Conflicts`.

## Daily Operational Checks (End of day)

Record these in `docs/PILOT_DAILY_LOG.md`:

- Total orders
- Paid orders
- Sync conflicts raised/resolved
- Any duplicate payment/order incidents
- Backup status (auto/manual)

## Failure Handling SOP

### If sync backlog grows

1. Ask staff to keep app open on affected device.
2. Use `Retry Sync` in settings.
3. If still blocked, capture screenshot + actionId from conflict card.

### If lock conflicts block service

1. Manager/owner uses `Force Unlock` from conflict card.
2. Retry action.
3. Continue service and note incident in daily log.

### If data corruption suspected

1. Stop new billing temporarily.
2. Take immediate backup.
3. Compare recent orders/payments.
4. Restore last known-good backup only if required.

## Pilot Exit Criteria (Must Pass)

- 7 consecutive days:
  - 0 duplicate payments
  - 0 missing orders after reconnect
  - no unresolved conflict older than 24h
- At least 1 restore drill completed successfully.
