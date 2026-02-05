# Billit On-Prem Installation (Single Restaurant)

This setup runs everything on one cashier/server machine in the restaurant LAN.

## 1) Prerequisites

- Windows/macOS/Linux machine that stays on during business hours
- Node.js 20+ and npm
- Same Wi-Fi/LAN for cashier desktop + Android waiter phones
- For Android offline durability, install Capacitor SQLite plugin in app build pipeline:
  - `npm i @capacitor-community/sqlite`
  - `npx cap sync android`

## 2) Configure server

Create `server/.env` from `server/.env.example` and set:

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=3001`
- `JWT_SECRET=<secure-random-32+ chars>`
- `DB_PATH=./data/restaurant.db`
- `ENABLE_WEB_STATIC=true`
- `ENABLE_BACKUP_SCHEDULER=true`

## 3) Build app

From repository root:

```bash
npm run build
cd server
npm run build
```

## 4) Start server

```bash
cd server
npm start
```

Open from desktop browser:

- `http://<server-lan-ip>:3001`

Examples:

- `http://192.168.1.20:3001`

## 5) Connect Android devices

On login screen, tap **Server** and set:

- `http://<server-lan-ip>:3001`

Tap **Save & Test**.

## 6) Production runtime recommendation

Use PM2 so server auto-restarts:

```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## 7) LAN checklist

- Router has DHCP reservation for server machine (stable IP)
- Firewall allows inbound TCP `3001` on local network
- All devices are on same subnet
