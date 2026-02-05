# Go-Live Checklist (Single Restaurant On-Prem)

## A) Technical Readiness

- [ ] Server machine fixed LAN IP configured
- [ ] `NODE_ENV=production` and secure `JWT_SECRET` set
- [ ] App opens on `http://<server-ip>:3001`
- [ ] Android devices connected to correct server URL
- [ ] Socket realtime updates visible across devices
- [ ] Backups enabled and visible in settings
- [ ] One restore test completed successfully

## B) Functional Readiness

- [ ] Waiter can create order on table and switch tables quickly
- [ ] Add-more-order flow works on same table after first KOT
- [ ] KOT incremental flow verified (only unsent lines in next KOT)
- [ ] Cashier can edit, bill, and accept payment from desktop
- [ ] Conflict cards show actionable controls (Retry/Force Unlock)

## C) Security & Stability

- [ ] Auth and sync rate limits active
- [ ] Owner role required for backup/restore actions
- [ ] No default secrets in runtime
- [ ] Build artifacts and logs are accessible for troubleshooting

## D) Pilot Gates (Must Meet Before Final Go-Live)

- [ ] 7 days: zero duplicate payments
- [ ] 7 days: zero missing orders after reconnect
- [ ] Sync success > 99.5%
- [ ] No unresolved conflict older than 24h

## E) Operational Handover

- [ ] Restaurant team trained (waiter/cashier/manager)
- [ ] Incident escalation contact shared
- [ ] SOP docs handed over:
  - [ ] `docs/INSTALL_ON_PREM.md`
  - [ ] `docs/BACKUP_AND_RESTORE.md`
  - [ ] `docs/PILOT_RUNBOOK.md`
  - [ ] `docs/PILOT_DAILY_LOG.md`
