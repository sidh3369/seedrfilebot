#!/bin/bash

# SeedrSync Bot Startup Script

echo "Starting SeedrSync Bot..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please copy .env.example to .env and configure your credentials."
    exit 1
fi

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed!"
    echo "Please install Node.js 18 or higher."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d node_modules ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the bot
echo "Bot is starting..."
node bot.js
