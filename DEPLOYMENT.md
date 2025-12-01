# Deployment Guide

## Quick Start for Linux Shared Hosting

### Prerequisites

1. Linux shared hosting with SSH access
2. Node.js 18+ installed
3. PM2 or systemd access (for keeping bot running)

### Setup Steps

1. Upload files to your server via SFTP/SCP or clone from git
2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
nano .env  # Edit with your credentials
```

4. Test the bot:
```bash
node bot.js
```

5. Deploy with PM2:
```bash
npm install -g pm2
pm2 start bot.js --name seedrsync-bot
pm2 save
pm2 startup  # Follow the instructions to enable auto-start
```

## Environment Variables

### Required Variables

1. **TELEGRAM_BOT_TOKEN**
   - Get from @BotFather on Telegram
   - Steps: Open Telegram > Search @BotFather > /newbot > Follow instructions

2. **GITHUB_TOKEN**
   - Create at: https://github.com/settings/tokens
   - Required permissions: `repo` (Full control of private repositories)
   - This is used to store M3U8 playlists

3. **GITHUB_REPO_OWNER**
   - Your GitHub username

4. **GITHUB_REPO_NAME**
   - Repository name where playlists will be stored
   - Create a new public or private repository on GitHub

5. **SUPABASE_URL**
   - From your Supabase project settings
   - Format: https://xxxxx.supabase.co

6. **SUPABASE_ANON_KEY**
   - From your Supabase project settings (API section)
   - This is the public anon key

## Supabase Setup

1. Create account at https://supabase.com
2. Create a new project
3. Wait for project to be ready
4. Get your credentials from Settings > API
5. Database tables are created automatically via migration

## GitHub Repository Setup

1. Create a new repository on GitHub (public or private)
2. This will store your M3U8 playlists
3. Make sure your GitHub token has access to this repository

## Monitoring

### Using PM2
```bash
pm2 status                    # Check bot status
pm2 logs seedrsync-bot       # View logs
pm2 restart seedrsync-bot    # Restart bot
pm2 stop seedrsync-bot       # Stop bot
```

### Using systemd
```bash
sudo systemctl status seedrsync-bot   # Check status
sudo journalctl -u seedrsync-bot -f   # View logs
sudo systemctl restart seedrsync-bot  # Restart
```

## Troubleshooting

### Bot not responding
1. Check if bot is running: `pm2 status`
2. Check logs: `pm2 logs seedrsync-bot`
3. Verify .env credentials are correct
4. Test Supabase connection

### Database errors
1. Verify SUPABASE_URL and SUPABASE_ANON_KEY
2. Check if migration was applied successfully
3. Check Supabase dashboard for table existence

### GitHub upload errors
1. Verify GITHUB_TOKEN has correct permissions
2. Check if repository exists
3. Verify GITHUB_REPO_OWNER and GITHUB_REPO_NAME are correct

### Seedr login errors
1. Verify Seedr credentials are correct
2. Try logging in manually on Seedr website
3. Check if Seedr service is up

## File Structure
```
seedrsync-bot/
├── bot.js              # Main bot file
├── lib/
│   ├── seedr.js       # Seedr API functions
│   └── github.js      # GitHub upload functions
├── .env               # Environment variables (create this)
├── .env.example       # Example environment file
├── package.json       # Dependencies
├── start.sh          # Startup script
└── README.md         # Documentation
```

## Security Notes

1. Never commit .env file to git
2. Keep your bot token secret
3. Rotate tokens if compromised
4. Use private GitHub repository for playlists if needed
5. Supabase RLS policies are configured for security

## Support

For issues and questions:
- Check logs first
- Verify all credentials
- Ensure Node.js version is 18+
- Check network connectivity

## Updates

To update the bot:
```bash
git pull  # If using git
npm install  # Update dependencies
pm2 restart seedrsync-bot  # Restart bot
```
