# SeedrSync Bot

A Telegram bot that downloads torrents to Seedr cloud and generates M3U8 playlists stored on GitHub.

## Features

- Download torrents via magnet links to Seedr
- Multiple Seedr accounts support
- Generate M3U8 playlists from your video files
- Store playlists permanently on GitHub
- Manage files directly from Telegram

## Requirements

- Node.js 18 or higher
- Supabase account (free tier works)
- GitHub account for playlist storage
- Telegram Bot Token from @BotFather

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

4. Configure your environment variables:
   - `TELEGRAM_BOT_TOKEN` - Get from @BotFather on Telegram
   - `GITHUB_TOKEN` - Create at https://github.com/settings/tokens (needs repo permissions)
   - `GITHUB_REPO_OWNER` - Your GitHub username
   - `GITHUB_REPO_NAME` - Repository name to store playlists
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_ANON_KEY` - Your Supabase anonymous key

5. Start the bot:
```bash
npm start
```

## Commands

- `/start` - Welcome message
- `/login` - Add Seedr account
- `/accounts` - Manage your Seedr accounts
- `/files` - View your Seedr files
- `/m3u` - Generate M3U8 playlist
- `/status` - Check connection status
- `/help` - Show help

## Usage

1. Start the bot with `/start`
2. Add your Seedr account with `/login`
3. Send any magnet link to the bot
4. Use `/files` to view and manage your files
5. Use `/m3u` to generate your M3U8 playlist

## Deployment on Linux Shared Hosting

### Using PM2 (Recommended)

1. Install PM2:
```bash
npm install -g pm2
```

2. Start the bot:
```bash
pm2 start bot.js --name seedrsync-bot
pm2 save
pm2 startup
```

3. Monitor:
```bash
pm2 logs seedrsync-bot
pm2 status
```

### Using systemd

Create `/etc/systemd/system/seedrsync-bot.service`:

```ini
[Unit]
Description=SeedrSync Telegram Bot
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/path/to/seedrsync-bot
ExecStart=/usr/bin/node bot.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable seedrsync-bot
sudo systemctl start seedrsync-bot
sudo systemctl status seedrsync-bot
```

## License

MIT
