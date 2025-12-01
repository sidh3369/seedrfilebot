import { Bot, InlineKeyboard, session } from 'grammy';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as seedr from './lib/seedr.js';
import * as github from './lib/github.js';

config();

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Session middleware
bot.use(session({
  initial: () => ({ loginState: null, loginEmail: null })
}));

// Helper functions
async function getUser(telegramUserId) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();
  return data;
}

async function createUser(telegramUserId) {
  const { data } = await supabase
    .from('users')
    .insert({ telegram_user_id: telegramUserId })
    .select()
    .single();
  return data;
}

async function getUserAccounts(userId) {
  const { data } = await supabase
    .from('seedr_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  return data || [];
}

async function addAccount(userId, accessToken, refreshToken, email) {
  const { data } = await supabase
    .from('seedr_accounts')
    .insert({
      user_id: userId,
      seedr_access_token: accessToken,
      seedr_refresh_token: refreshToken,
      account_email: email
    })
    .select()
    .single();
  return data;
}

async function deleteAccount(accountId) {
  await supabase
    .from('seedr_accounts')
    .update({ is_active: false })
    .eq('id', accountId);
}

async function getAccount(accountId) {
  const { data } = await supabase
    .from('seedr_accounts')
    .select('*')
    .eq('id', accountId)
    .maybeSingle();
  return data;
}

// Commands
bot.command('start', async (ctx) => {
  const telegramUserId = ctx.from?.id.toString();
  if (!telegramUserId) return;

  let user = await getUser(telegramUserId);
  if (!user) {
    user = await createUser(telegramUserId);
  }

  await ctx.reply(
    '🚀 *Welcome to SeedrSync Bot!*\n\n' +
    '📥 Download torrents to Seedr cloud\n' +
    '🎬 Auto-generate M3U8 playlists\n' +
    '☁️ Store playlists on GitHub\n\n' +
    '*Quick Start:*\n' +
    '1. Add your Seedr account - /login\n' +
    '2. Send any magnet link\n' +
    '3. Get your M3U8 playlist - /m3u\n\n' +
    '_Made by Shailesh Patel_',
    { parse_mode: 'Markdown' }
  );
});

bot.command('login', async (ctx) => {
  ctx.session.loginState = 'awaiting_email';
  await ctx.reply(
    '🔐 *Add Seedr Account*\n\n' +
    'Please send your Seedr email address:',
    { parse_mode: 'Markdown' }
  );
});

bot.command('accounts', async (ctx) => {
  const telegramUserId = ctx.from?.id.toString();
  if (!telegramUserId) return;

  const user = await getUser(telegramUserId);
  if (!user) {
    await ctx.reply('Please use /start first.');
    return;
  }

  const accounts = await getUserAccounts(user.id);

  if (accounts.length === 0) {
    await ctx.reply('You have no Seedr accounts connected.\n\nUse /login to add an account.');
    return;
  }

  await ctx.reply(`*Your Seedr Accounts (${accounts.length})*\n\nClick to remove:`, { parse_mode: 'Markdown' });

  for (const account of accounts) {
    const keyboard = new InlineKeyboard().text('Remove', `remove_${account.id}`);
    const email = account.account_email || 'Unknown';
    const addedDate = new Date(account.created_at).toLocaleDateString();

    await ctx.reply(
      `📧 ${email}\nAdded: ${addedDate}`,
      { reply_markup: keyboard }
    );
  }
});

bot.command('files', async (ctx) => {
  const telegramUserId = ctx.from?.id.toString();
  if (!telegramUserId) return;

  const user = await getUser(telegramUserId);
  if (!user) {
    await ctx.reply('Not connected. Use /login to connect.');
    return;
  }

  const accounts = await getUserAccounts(user.id);
  if (accounts.length === 0) {
    await ctx.reply('No accounts connected. Use /login to add an account.');
    return;
  }

  const statusMsg = await ctx.reply('⏳ Fetching files...');

  let totalFolders = 0;

  for (const account of accounts) {
    try {
      const folders = await seedr.getFolderContents(account.seedr_access_token);

      if (folders.length > 0) {
        const accountLabel = account.account_email || `Account #${account.id}`;
        await ctx.reply(`📧 *${accountLabel}*`, { parse_mode: 'Markdown' });

        for (const folder of folders.slice(0, 10)) {
          const keyboard = new InlineKeyboard()
            .text('Links', `links_${folder.id}_${account.id}`)
            .text('Delete', `delete_${folder.id}_${account.id}`);

          const size = folder.size ? `\n${(folder.size / 1024 / 1024).toFixed(2)} MB` : '';
          await ctx.reply(
            `📂 *${folder.name}*${size}`,
            { parse_mode: 'Markdown', reply_markup: keyboard }
          );
          totalFolders++;
        }
      }
    } catch (error) {
      console.error(`Error fetching files for account ${account.id}:`, error);
    }
  }

  await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);

  if (totalFolders === 0) {
    await ctx.reply('No files found. Add a magnet link to get started!');
  }
});

bot.command('m3u', async (ctx) => {
  const telegramUserId = ctx.from?.id.toString();
  if (!telegramUserId) return;

  const user = await getUser(telegramUserId);
  if (!user) {
    await ctx.reply('Please use /start first.');
    return;
  }

  const statusMsg = await ctx.reply('⏳ Generating M3U playlist...');

  const accounts = await getUserAccounts(user.id);
  if (accounts.length === 0) {
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      'No Seedr accounts connected.\n\nUse /login to add your account.'
    );
    return;
  }

  let m3u8Content = '#EXTM3U\n';
  let totalVideos = 0;

  for (const account of accounts) {
    try {
      const folders = await seedr.getFolderContents(account.seedr_access_token);

      for (const folder of folders) {
        try {
          const files = await seedr.getFiles(account.seedr_access_token, folder.id);
          const videoFiles = files.filter(f =>
            f.play_video && /\.(mp4|mkv|avi|mov)$/i.test(f.name)
          );

          for (const file of videoFiles) {
            const fileUrl = await seedr.getFileUrl(account.seedr_access_token, file.folder_file_id);
            if (fileUrl) {
              m3u8Content += `#EXTINF:-1,${file.name}\n${fileUrl}\n`;
              totalVideos++;
            }
          }
        } catch (error) {
          console.error(`Failed to process folder ${folder.id}:`, error.message);
        }
      }
    } catch (error) {
      console.error(`Failed to get folders for account ${account.id}:`, error.message);
    }
  }

  if (totalVideos === 0) {
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      'No video files found in your accounts.'
    );
    return;
  }

  const githubUrl = await github.uploadM3U8(m3u8Content, `user-${telegramUserId}.m3u8`);

  await ctx.api.editMessageText(
    ctx.chat.id,
    statusMsg.message_id,
    `✅ *M3U8 Playlist Generated!*\n\n` +
    `🎬 Total Videos: ${totalVideos}\n` +
    `🔗 [Download M3U8](${githubUrl})`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('status', async (ctx) => {
  const telegramUserId = ctx.from?.id.toString();
  if (!telegramUserId) return;

  const user = await getUser(telegramUserId);
  if (!user) {
    await ctx.reply('Not connected. Run /login to add your account.');
    return;
  }

  const accounts = await getUserAccounts(user.id);

  if (accounts.length === 0) {
    await ctx.reply('No accounts connected. Run /login to add your account.');
  } else {
    await ctx.reply(`✅ Connected with ${accounts.length} Seedr account(s)!\n\nUse /accounts to manage them.`);
  }
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    '*📚 SeedrSync Bot Help*\n\n' +
    '*Commands:*\n' +
    '/start - Welcome message\n' +
    '/login - Add Seedr account\n' +
    '/accounts - Manage accounts\n' +
    '/files - View files\n' +
    '/m3u - Generate M3U playlist\n' +
    '/status - Check connection\n' +
    '/help - Show this help\n\n' +
    '_Made by Shailesh Patel_',
    { parse_mode: 'Markdown' }
  );
});

// Handle callbacks
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const telegramUserId = ctx.from?.id.toString();
  if (!telegramUserId) return;

  const user = await getUser(telegramUserId);
  if (!user) {
    await ctx.answerCallbackQuery({ text: 'User not found' });
    return;
  }

  if (data.startsWith('remove_')) {
    const accountId = parseInt(data.replace('remove_', ''));
    const account = await getAccount(accountId);

    if (!account || account.user_id !== user.id) {
      await ctx.answerCallbackQuery({ text: 'Account not found' });
      return;
    }

    await deleteAccount(accountId);
    await ctx.answerCallbackQuery({ text: 'Account removed' });
    await ctx.editMessageText(`Removed: ${account.account_email || 'Account'}`);

  } else if (data.startsWith('links_')) {
    const [_, folderIdStr, accountIdStr] = data.split('_');
    const folderId = parseInt(folderIdStr);
    const accountId = parseInt(accountIdStr);

    const account = await getAccount(accountId);
    if (!account) {
      await ctx.answerCallbackQuery({ text: 'Account not found' });
      return;
    }

    await ctx.answerCallbackQuery({ text: 'Getting files...' });

    const files = await seedr.getFiles(account.seedr_access_token, folderId);

    if (files.length === 0) {
      await ctx.reply('No files found in this folder.');
      return;
    }

    let message = '🔗 *Download Links:*\n\n';
    for (const file of files.slice(0, 10)) {
      const fileUrl = await seedr.getFileUrl(account.seedr_access_token, file.folder_file_id);
      if (fileUrl) {
        message += `📄 [${file.name}](${fileUrl})\n`;
      }
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });

  } else if (data.startsWith('delete_')) {
    const [_, folderIdStr, accountIdStr] = data.split('_');
    const folderId = parseInt(folderIdStr);
    const accountId = parseInt(accountIdStr);

    const account = await getAccount(accountId);
    if (!account || account.user_id !== user.id) {
      await ctx.answerCallbackQuery({ text: 'Unauthorized' });
      return;
    }

    await ctx.answerCallbackQuery({ text: 'Deleting...' });
    await seedr.deleteFolder(account.seedr_access_token, folderId);
    await ctx.editMessageText('🗑️ *Deleted*', { parse_mode: 'Markdown' });
  }
});

// Handle text messages
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  const telegramUserId = ctx.from?.id.toString();
  if (!telegramUserId) return;

  // Login flow
  if (ctx.session.loginState === 'awaiting_email') {
    if (!text.includes('@')) {
      await ctx.reply('Invalid email. Please send a valid email address:');
      return;
    }

    ctx.session.loginState = 'awaiting_password';
    ctx.session.loginEmail = text;
    await ctx.reply('Email received! Now send your Seedr password:');
    return;
  }

  if (ctx.session.loginState === 'awaiting_password' && ctx.session.loginEmail) {
    const email = ctx.session.loginEmail;
    const password = text;

    ctx.session.loginState = null;
    ctx.session.loginEmail = null;

    try {
      await ctx.reply('⏳ Logging in to Seedr...');

      const tokens = await seedr.loginWithPassword(email, password);

      let user = await getUser(telegramUserId);
      if (!user) {
        user = await createUser(telegramUserId);
      }

      await addAccount(user.id, tokens.access_token, tokens.refresh_token || null, email);

      await ctx.reply(`✅ Successfully added Seedr account!\n\n📧 ${email}\n\nYou can now send magnet links or use /m3u.`);
    } catch (error) {
      await ctx.reply(`Login failed: ${error.message}\n\nPlease try /login again.`);
    }
    return;
  }

  // Magnet links
  if (text.startsWith('magnet:?')) {
    const user = await getUser(telegramUserId);
    if (!user) {
      await ctx.reply('Please use /start first.');
      return;
    }

    const accounts = await getUserAccounts(user.id);
    if (accounts.length === 0) {
      await ctx.reply('Please connect your Seedr account first using /login');
      return;
    }

    const account = accounts[0];

    try {
      const torrentId = await seedr.addMagnet(account.seedr_access_token, text);
      await new Promise(resolve => setTimeout(resolve, 3000));

      const folders = await seedr.getFolderContents(account.seedr_access_token);
      const folder = folders.find(f => f.id === torrentId);

      if (folder) {
        let msg = '✅ *Magnet link added!*\n\n';
        msg += `📂 *Name:* ${folder.name}\n`;

        if (folder.size) {
          const sizeGB = (folder.size / 1024 / 1024 / 1024).toFixed(2);
          const sizeMB = (folder.size / 1024 / 1024).toFixed(2);
          msg += `📦 *Size:* ${parseFloat(sizeGB) >= 1 ? sizeGB + ' GB' : sizeMB + ' MB'}\n`;
        }

        msg += '\n_Use /files to view when ready._';
        await ctx.reply(msg, { parse_mode: 'Markdown' });
      } else {
        await ctx.reply('✅ *Magnet link added!*\n\n_Processing... Use /files to view._', { parse_mode: 'Markdown' });
      }
    } catch (error) {
      await ctx.reply(`Error: ${error.message}`);
    }
  }
});

// Error handling
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start bot
console.log('Starting SeedrSync Bot...');
bot.start();
