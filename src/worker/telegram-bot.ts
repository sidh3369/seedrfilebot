import { Bot, webhookCallback, InlineKeyboard } from 'grammy';
import { Env } from './env';
import { getUser, createUser, updateUserSeedrTokens, addSeedrAccount, getUserSeedrAccounts, deleteSeedrAccount, getSeedrAccount } from './database';
import { loginWithPassword, addMagnet, getFolderContents, getFiles, getFileUrl, deleteFolder } from './seedr';
import { uploadM3U8ToGitHub } from './github';

// Store conversation states for /login2 flow
const loginStates = new Map<string, { state: 'awaiting_email' | 'awaiting_password', email?: string }>();

// Store active downloads for cancellation
const activeDownloads = new Map<string, { cancel: boolean, torrentId?: number }>();

// Function to clear stuck downloads
export function clearActiveDownloads() {
  activeDownloads.clear();
  loginStates.clear();
  console.log('[RESET] Cleared all active downloads and login states');
}

export async function setupBotCommands(env: Env) {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  
  const commands = [
    { command: 'start', description: '🚀 Start the bot' },
    { command: 'login2', description: '🔐 Add Seedr account' },
    { command: 'accounts', description: '👥 Manage accounts' },
    { command: 'files', description: '📁 View files' },
    { command: 'm3u', description: '🎵 Generate personal playlist' },
    { command: 'status', description: '✅ Check connection' },
    { command: 'help', description: '❓ Show help' },
  ];
  
  // Set commands for all chats and the menu button
  await bot.api.setMyCommands(commands, { scope: { type: "default" } });
  
  // Also set for private chats specifically to ensure menu button shows
  await bot.api.setMyCommands(commands, { scope: { type: "all_private_chats" } });
  
  console.log('[BOT] Commands set successfully for menu button');
}

export function createBot(env: Env) {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  bot.command('start', async (ctx) => {
    const telegramUserId = ctx.from?.id.toString();
    if (!telegramUserId) return;

    let user = await getUser(env, telegramUserId);
    if (!user) {
      user = await createUser(env, telegramUserId);
    }

    await ctx.reply(
      '🚀 *Welcome to SeedrSync Bot!*\n\n' +
      '📥 Download torrents to Seedr cloud\n' +
      '🎬 Auto-generate M3U8 playlists\n' +
      '☁️ Store playlists on GitHub\n\n' +
      '*Quick Start:*\n' +
      '1. Add your Seedr account - /login2\n' +
      '2. Send any magnet link\n' +
      '3. Get your M3U8 playlist - /m3u\n\n' +
      '_Made by Shailesh Patel_',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('accounts', async (ctx) => {
    const telegramUserId = ctx.from?.id.toString();
    if (!telegramUserId) return;

    const user = await getUser(env, telegramUserId);
    if (!user) {
      await ctx.reply('Please use /start first.');
      return;
    }

    const accounts = await getUserSeedrAccounts(env, user.id);
    
    if (accounts.length === 0) {
      await ctx.reply('You have no Seedr accounts connected.\n\nUse /login2 to add an account.');
      return;
    }

    await ctx.reply(`*Your Seedr Accounts (${accounts.length})*\n\nClick to remove:`, { parse_mode: 'Markdown' });

    for (const account of accounts) {
      const keyboard = new InlineKeyboard().text('❌ Remove', `remove_account_${account.id}`);
      const email = account.account_email || 'Unknown';
      const addedDate = new Date(account.created_at).toLocaleDateString();
      
      await ctx.reply(
        `📧 ${email}\nAdded: ${addedDate}`,
        { reply_markup: keyboard }
      );
    }
  });

  bot.command('m3u', async (ctx) => {
    try {
      const telegramUserId = ctx.from?.id.toString();
      if (!telegramUserId) return;

      const user = await getUser(env, telegramUserId);
      if (!user) {
        await ctx.reply('Please use /start first.');
        return;
      }

      const statusMsg = await ctx.reply('⏳ Generating your personal M3U playlist...');
      
      const accounts = await getUserSeedrAccounts(env, user.id);
      
      if (accounts.length === 0) {
        await ctx.api.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          '❌ No Seedr accounts connected.\n\nUse /login2 to add your account.'
        );
        return;
      }

      let m3u8Content = '#EXTM3U\n';
      let totalVideos = 0;

      console.log(`[M3U] Processing ${accounts.length} account(s) for user ${telegramUserId}`);
      
      for (const account of accounts) {
        try {
          console.log(`[M3U] Processing account ${account.id}`);
          const folders = await getFolderContents(account.seedr_access_token);
          console.log(`[M3U] Account ${account.id} has ${folders.length} folders`);
          
          for (const folder of folders) {
            try {
              const files = await getFiles(account.seedr_access_token, folder.id);
              const videoFiles = files.filter(f => 
                f.play_video && (
                  f.name.endsWith('.mp4') || 
                  f.name.endsWith('.mkv') || 
                  f.name.endsWith('.avi') ||
                  f.name.endsWith('.mov')
                )
              );

              for (const file of videoFiles) {
                const fileUrl = await getFileUrl(account.seedr_access_token, file.folder_file_id);
                if (fileUrl) {
                  m3u8Content += `#EXTINF:-1,${file.name}\n`;
                  m3u8Content += `${fileUrl}\n`;
                  totalVideos++;
                }
              }
            } catch (error: any) {
              console.error(`[M3U] Failed to process folder ${folder.id}:`, error.message);
            }
          }
        } catch (error: any) {
          console.error(`[M3U] Failed to get folders for account ${account.id}:`, error.message);
        }
      }

      if (totalVideos === 0) {
        await ctx.api.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          '❌ No video files found in your accounts.'
        );
        return;
      }

      const githubUrl = await uploadM3U8ToGitHub(env, m3u8Content, `user-${telegramUserId}.m3u8`);
      
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `✅ *Your Personal M3U8 Playlist Generated!*\n\n` +
        `🎬 Total Videos: ${totalVideos}\n` +
        `🔗 [Download M3U8](${githubUrl})\n\n` +
        `_This playlist includes only your videos_`,
        { parse_mode: 'Markdown' }
      );
    } catch (error: any) {
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  });

  bot.command('status', async (ctx) => {
    const telegramUserId = ctx.from?.id.toString();
    if (!telegramUserId) return;

    const user = await getUser(env, telegramUserId);
    if (!user) {
      await ctx.reply('❌ Not connected. Run /login2 to add your account.');
      return;
    }

    const accounts = await getUserSeedrAccounts(env, user.id);
    
    if (accounts.length === 0) {
      await ctx.reply('❌ No accounts connected. Run /login2 to add your account.');
    } else {
      await ctx.reply(`✅ Connected with ${accounts.length} Seedr account(s)!\n\nUse /accounts to manage them.`);
    }
  });

  bot.command('login2', async (ctx) => {
    const telegramUserId = ctx.from?.id.toString();
    if (!telegramUserId) return;

    loginStates.set(telegramUserId, { state: 'awaiting_email' });
    
    await ctx.reply(
      '🔐 *Add Seedr Account*\n\n' +
      'Please send your Seedr email address:',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      '*📚 SeedrSync Bot Help*\n\n' +
      '*Commands:*\n' +
      '/start - Show welcome message\n' +
      '/login2 - Add a Seedr account\n' +
      '/accounts - Manage your accounts\n' +
      '/files - View your Seedr files\n' +
      '/m3u - Generate your personal M3U playlist\n' +
      '/status - Check connection status\n' +
      '/help - Show this help\n\n' +
      '*Features:*\n' +
      '• Multiple accounts support\n' +
      '• Personal M3U playlist\n' +
      '• Auto-update M3U8 daily\n' +
      '• Delete files from Telegram\n' +
      '• Simple magnet link support\n\n' +
      '_Made by Shailesh Patel_',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('files', async (ctx) => {
    const telegramUserId = ctx.from?.id.toString();
    if (!telegramUserId) return;

    const user = await getUser(env, telegramUserId);
    if (!user) {
      await ctx.reply('❌ Not connected. Use /login2 to connect your account.');
      return;
    }

    const accounts = await getUserSeedrAccounts(env, user.id);
    
    if (accounts.length === 0) {
      await ctx.reply('❌ No accounts connected. Use /login2 to add an account.');
      return;
    }

    try {
      const statusMsg = await ctx.reply('⏳ Fetching your files...');
      
      let totalFolders = 0;
      
      for (const account of accounts) {
        try {
          const folders = await getFolderContents(account.seedr_access_token);
          
          if (folders.length > 0) {
            const accountLabel = account.account_email || `Account #${account.id}`;
            await ctx.reply(`📧 *${accountLabel}*`, { parse_mode: 'Markdown' });
            
            for (const folder of folders.slice(0, 10)) {
              const keyboard = new InlineKeyboard()
                .text('🔗 Links', `getlink_${folder.id}_${account.id}`)
                .text('🗑️ Delete', `delete_${folder.id}_${account.id}`);

              const size = folder.size ? `\nSize: ${(folder.size / 1024 / 1024).toFixed(2)} MB` : '';
              await ctx.reply(
                `📂 *${folder.name}*${size}`,
                { parse_mode: 'Markdown', reply_markup: keyboard }
              );
              totalFolders++;
            }
            
            if (folders.length > 10) {
              await ctx.reply(`_...and ${folders.length - 10} more files_`, { parse_mode: 'Markdown' });
            }
          }
        } catch (error) {
          console.error(`Error fetching files for account ${account.id}:`, error);
        }
      }

      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);

      if (totalFolders === 0) {
        await ctx.reply('📁 No files found. Add a magnet link to get started!');
      }
    } catch (error: any) {
      await ctx.reply(`Error: ${error.message}`);
    }
  });

  // Handle callback queries
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const telegramUserId = ctx.from?.id.toString();
    if (!telegramUserId) return;

    const user = await getUser(env, telegramUserId);
    if (!user) {
      await ctx.answerCallbackQuery({ text: '❌ User not found' });
      return;
    }

    try {
      if (data.startsWith('remove_account_')) {
        const accountId = parseInt(data.replace('remove_account_', ''));
        const account = await getSeedrAccount(env, accountId);
        
        if (!account || account.user_id !== user.id) {
          await ctx.answerCallbackQuery({ text: '❌ Account not found or unauthorized' });
          return;
        }
        
        await deleteSeedrAccount(env, accountId);
        await ctx.answerCallbackQuery({ text: '✅ Account removed' });
        await ctx.editMessageText(`❌ Removed: ${account.account_email || 'Account'}`);
        
      } else if (data.startsWith('getlink_')) {
        const [_, folderIdStr, accountIdStr] = data.split('_');
        const folderId = parseInt(folderIdStr);
        const accountId = parseInt(accountIdStr);
        
        const account = await getSeedrAccount(env, accountId);
        if (!account) {
          await ctx.answerCallbackQuery({ text: '❌ Account not found' });
          return;
        }
        
        await ctx.answerCallbackQuery({ text: '⏳ Getting files...' });
        
        const files = await getFiles(account.seedr_access_token, folderId);
        
        if (files.length === 0) {
          await ctx.reply('No files found in this folder.');
          return;
        }

        let message = '🔗 *Download Links:*\n\n';
        for (const file of files.slice(0, 10)) {
          const fileUrl = await getFileUrl(account.seedr_access_token, file.folder_file_id);
          if (fileUrl) {
            message += `📄 [${file.name}](${fileUrl})\n`;
          }
        }

        if (files.length > 10) {
          message += `\n_...and ${files.length - 10} more files_`;
        }

        await ctx.reply(message, { parse_mode: 'Markdown' });
        
      } else if (data.startsWith('delete_')) {
        const [_, folderIdStr, accountIdStr] = data.split('_');
        const folderId = parseInt(folderIdStr);
        const accountId = parseInt(accountIdStr);
        
        const account = await getSeedrAccount(env, accountId);
        if (!account || account.user_id !== user.id) {
          await ctx.answerCallbackQuery({ text: '❌ Unauthorized' });
          return;
        }
        
        await ctx.answerCallbackQuery({ text: '⏳ Deleting...' });
        
        await deleteFolder(account.seedr_access_token, folderId);
        
        await ctx.editMessageText('🗑️ *Deleted*', { parse_mode: 'Markdown' });
      }
    } catch (error: any) {
      await ctx.answerCallbackQuery({ text: `Error: ${error.message}` });
    }
  });

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    const telegramUserId = ctx.from?.id.toString();
    if (!telegramUserId) return;

    // Check if user is in login flow
    const loginState = loginStates.get(telegramUserId);
    if (loginState) {
      if (loginState.state === 'awaiting_email') {
        if (!text.includes('@')) {
          await ctx.reply('❌ Invalid email format. Please send a valid email address:');
          return;
        }
        
        loginStates.set(telegramUserId, { state: 'awaiting_password', email: text });
        await ctx.reply('📧 Email received!\n\nNow please send your Seedr password:');
        return;
      } else if (loginState.state === 'awaiting_password' && loginState.email) {
        const email = loginState.email;
        const password = text;
        
        loginStates.delete(telegramUserId);
        
        try {
          await ctx.reply('⏳ Logging in to Seedr...');
          
          const tokens = await loginWithPassword(email, password);
          
          let user = await getUser(env, telegramUserId);
          if (!user) {
            user = await createUser(env, telegramUserId);
          }
          
          await addSeedrAccount(env, user.id, tokens.access_token, tokens.refresh_token || null, email);
          await updateUserSeedrTokens(env, telegramUserId, tokens.access_token, tokens.refresh_token || '');
          
          await ctx.reply(`✅ Successfully added Seedr account!\n\n📧 ${email}\n\nYou can now send magnet links or use /m3u to generate your playlist.`);
        } catch (error: any) {
          await ctx.reply(`❌ Login failed: ${error.message}\n\nPlease try /login2 again.`);
        }
        return;
      }
    }

    if (!text.startsWith('magnet:?')) {
      return;
    }

    const user = await getUser(env, telegramUserId);
    if (!user) {
      await ctx.reply('Please use /start first.');
      return;
    }

    const accounts = await getUserSeedrAccounts(env, user.id);
    if (accounts.length === 0) {
      await ctx.reply('Please connect your Seedr account first using /login2');
      return;
    }

    const account = accounts[0];

    try {
      const torrentId = await addMagnet(account.seedr_access_token, text);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const folders = await getFolderContents(account.seedr_access_token);
      const folder = folders.find(f => f.id === torrentId);
      
      if (folder) {
        let successMsg = '✅ *Magnet link added successfully!*\n\n';
        successMsg += `📂 *Name:* ${folder.name}\n`;
        
        if (folder.size) {
          const sizeMB = (folder.size / 1024 / 1024).toFixed(2);
          const sizeGB = (folder.size / 1024 / 1024 / 1024).toFixed(2);
          successMsg += `📦 *Size:* ${parseFloat(sizeGB) >= 1 ? sizeGB + ' GB' : sizeMB + ' MB'}\n`;
        }
        
        successMsg += '\n_Download started. Use /files to view when ready._';
        
        await ctx.reply(successMsg, { parse_mode: 'Markdown' });
      } else {
        await ctx.reply(
          '✅ *Magnet link added successfully!*\n\n' +
          '_Processing... Use /files to view when ready._',
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error: any) {
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  });

  return bot;
}

export function createWebhookHandler(env: Env) {
  const bot = createBot(env);
  
  bot.catch((err) => {
    console.error('Bot error:', err);
  });
  
  return webhookCallback(bot, 'hono');
}
