#!/bin/bash

# Bill & Serve Pro - Server Startup Script

cd "$(dirname "$0")/.."

echo "🍽️  Bill & Serve Pro - Starting Server"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if database exists
if [ ! -f "data/restaurant.db" ]; then
    echo "🗄️  Initializing database..."
    npm run db:migrate
    echo "🌱 Seeding initial data..."
    npm run db:seed
fi

echo ""
echo "🚀 Starting server..."
npm run dev
