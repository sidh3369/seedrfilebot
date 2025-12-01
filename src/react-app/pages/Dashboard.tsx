import { useState, useEffect } from 'react';

interface SeedrAccount {
  id: number;
  account_email: string | null;
  created_at: string;
}

interface SeedrFile {
  id: number;
  name: string;
  size?: number;
  type: string;
  accountId: number;
  accountEmail: string | null;
}

export default function Dashboard() {
  const [sessionId, setSessionId] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accounts, setAccounts] = useState<SeedrAccount[]>([]);
  const [files, setFiles] = useState<SeedrFile[]>([]);
  const [magnetLink, setMagnetLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [loginMode, setLoginMode] = useState<'password' | 'device'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userCode, setUserCode] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [githubPlaylistUrl, setGithubPlaylistUrl] = useState('');

  useEffect(() => {
    const storedSession = localStorage.getItem('seedr_session');
    if (storedSession) {
      setSessionId(storedSession);
      setIsLoggedIn(true);
      fetchAccounts(storedSession);
      fetchFiles(storedSession);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  const fetchAccounts = async (session: string) => {
    try {
      const res = await fetch('/api/seedr/accounts', {
        headers: { 'X-Session-ID': session }
      });
      const data = await res.json();
      if (data.success) {
        setAccounts(data.accounts);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  };

  const fetchFiles = async (session: string) => {
    try {
      const res = await fetch('/api/seedr/files', {
        headers: { 'X-Session-ID': session }
      });
      const data = await res.json();
      if (data.success) {
        setFiles(data.files);
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  };

  const handleLoginWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const res = await fetch('/api/seedr/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      
      if (data.success) {
        const newSessionId = data.sessionId;
        localStorage.setItem('seedr_session', newSessionId);
        setSessionId(newSessionId);
        setIsLoggedIn(true);
        setMessage('✅ Seedr account added successfully!');
        setEmail('');
        setPassword('');
        setShowAddAccount(false);
        fetchAccounts(newSessionId);
        fetchFiles(newSessionId);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ Failed to add account');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginWithDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const res = await fetch('/api/seedr/device-code');
      const data = await res.json();
      
      if (data.success) {
        setUserCode(data.user_code);
        setVerificationUrl(data.verification_url);
        setMessage(`Go to ${data.verification_url} and enter code: ${data.user_code}`);
        
        const interval = setInterval(async () => {
          try {
            const checkRes = await fetch('/api/seedr/check-auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ device_code: data.device_code }),
            });
            const checkData = await checkRes.json();
            
            if (checkData.success) {
              clearInterval(interval);
              const newSessionId = checkData.sessionId;
              localStorage.setItem('seedr_session', newSessionId);
              setSessionId(newSessionId);
              setIsLoggedIn(true);
              setMessage('✅ Seedr account connected!');
              setUserCode('');
              setVerificationUrl('');
              setShowAddAccount(false);
              fetchAccounts(newSessionId);
              fetchFiles(newSessionId);
            }
          } catch (error) {
            console.error('Auth check error:', error);
          }
        }, 5000);
        
        setPollInterval(interval);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ Failed to initiate login');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAccount = async (accountId: number) => {
    if (!confirm('Remove this Seedr account?')) return;
    
    try {
      const res = await fetch(`/api/seedr/accounts/${accountId}`, {
        method: 'DELETE',
        headers: { 'X-Session-ID': sessionId }
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage('✅ Account removed');
        fetchAccounts(sessionId);
        fetchFiles(sessionId);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ Failed to remove account');
    }
  };

  const handleAddMagnet = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const res = await fetch('/api/seedr/magnet', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({ magnetLink }),
      });
      const data = await res.json();
      
      if (data.success) {
        const folderInfo = data.folder 
          ? `\n📂 ${data.folder.name}${data.folder.size ? `\n📦 ${(data.folder.size / 1024 / 1024).toFixed(2)} MB` : ''}`
          : '';
        setMessage(`✅ Magnet link added successfully!${folderInfo}`);
        setMagnetLink('');
        setTimeout(() => fetchFiles(sessionId), 2000);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ Failed to add magnet');
    } finally {
      setLoading(false);
    }
  };

  const handleGetLinks = async (fileId: number, accountId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/seedr/files/${fileId}/links?accountId=${accountId}`, {
        headers: { 'X-Session-ID': sessionId }
      });
      const data = await res.json();
      
      if (data.success && data.links.length > 0) {
        let linksMsg = '🔗 Download Links:\n\n';
        data.links.forEach((link: any) => {
          linksMsg += `📄 ${link.name}\n${link.url}\n\n`;
        });
        setMessage(linksMsg);
      } else {
        setMessage('❌ No links found');
      }
    } catch (error) {
      setMessage('❌ Failed to get links');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (fileId: number, accountId: number) => {
    if (!confirm('Delete this file?')) return;
    
    try {
      const res = await fetch(`/api/seedr/files/${fileId}?accountId=${accountId}`, {
        method: 'DELETE',
        headers: { 'X-Session-ID': sessionId }
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage('✅ File deleted');
        fetchFiles(sessionId);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ Failed to delete file');
    }
  };

  const handleGenerateM3U = async (fileId: number, accountId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/seedr/files/${fileId}/m3u`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage(`✅ M3U8 Generated!\n\n🎬 Videos: ${data.videoCount}\n🔗 ${data.url}`);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ Failed to generate M3U');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePersonalM3U = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/seedr/m3u/generate', {
        method: 'POST',
        headers: { 'X-Session-ID': sessionId }
      });
      const data = await res.json();
      
      if (data.success) {
        setGithubPlaylistUrl(data.githubUrl);
        setMessage(`✅ Personal M3U8 Generated!\n\n🎬 Total Videos: ${data.videoCount}\n🔗 GitHub URL:\n${data.githubUrl}\n\n📊 This playlist includes all your videos!`);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ Failed to generate playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('seedr_session');
    setSessionId('');
    setIsLoggedIn(false);
    setAccounts([]);
    setFiles([]);
    setGithubPlaylistUrl('');
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">SeedrSync Dashboard</h1>
            <p className="text-purple-200">Login with your Seedr account</p>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setLoginMode('password')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                loginMode === 'password'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-purple-200 hover:bg-white/20'
              }`}
            >
              🔐 Email/Password
            </button>
            <button
              onClick={() => setLoginMode('device')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                loginMode === 'device'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-purple-200 hover:bg-white/20'
              }`}
            >
              📱 Device Code
            </button>
          </div>

          {loginMode === 'password' ? (
            <form onSubmit={handleLoginWithPassword} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Seedr email"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Seedr password"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-2 rounded-lg transition-colors"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          ) : (
            <div>
              {!userCode ? (
                <button
                  onClick={handleLoginWithDevice}
                  disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-2 rounded-lg transition-colors"
                >
                  {loading ? 'Getting Code...' : 'Get Device Code'}
                </button>
              ) : (
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-200 font-semibold mb-2">Authorization Code:</p>
                  <p className="text-white text-2xl font-mono mb-2">{userCode}</p>
                  <p className="text-green-200 text-sm mb-2">Visit:</p>
                  <a 
                    href={verificationUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:text-blue-200 break-all"
                  >
                    {verificationUrl}
                  </a>
                  <p className="text-green-200 text-sm mt-3">
                    ⏳ Waiting for authorization...
                  </p>
                </div>
              )}
            </div>
          )}

          {message && (
            <div className="mt-4 bg-white/5 rounded-lg p-3">
              <p className="text-white text-sm whitespace-pre-wrap">{message}</p>
            </div>
          )}

          <p className="mt-6 text-center text-purple-300 text-sm">
            Made by Shailesh Patel
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">SeedrSync Dashboard</h1>
            <p className="text-purple-200">Welcome back!</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            🚪 Logout
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm mb-1">Connected Accounts</p>
                <p className="text-3xl font-bold text-white">{accounts.length}</p>
              </div>
              <div className="p-3 bg-purple-500/30 rounded-lg">
                <svg className="w-8 h-8 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm mb-1">Total Files</p>
                <p className="text-3xl font-bold text-white">{files.length}</p>
              </div>
              <div className="p-3 bg-green-500/30 rounded-lg">
                <svg className="w-8 h-8 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm mb-1">Video Folders</p>
                <p className="text-3xl font-bold text-white">
                  {files.filter(f => f.type === 'folder').length}
                </p>
              </div>
              <div className="p-3 bg-blue-500/30 rounded-lg">
                <svg className="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Playlist - Only show after account is added */}
        {accounts.length > 0 && (
          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-md rounded-xl p-6 border border-purple-500/30 mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-500/30 rounded-lg">
                <svg className="w-6 h-6 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white">🎵 Your Personal Playlist</h2>
            </div>
            {githubPlaylistUrl ? (
              <div className="bg-black/30 rounded-lg p-4 mb-3">
                <p className="text-purple-200 text-sm mb-2">GitHub Permanent URL (Auto-updates daily):</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={githubPlaylistUrl}
                    readOnly
                    className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm font-mono"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(githubPlaylistUrl);
                      setMessage('✅ URL copied!');
                      setTimeout(() => setMessage(''), 3000);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
                  >
                    📋 Copy
                  </button>
                  <a
                    href={githubPlaylistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
                  >
                    🔗 Open
                  </a>
                </div>
              </div>
            ) : (
              <div className="bg-black/30 rounded-lg p-4 mb-3">
                <p className="text-purple-200 text-sm">Generate your personal M3U playlist to get a permanent GitHub URL.</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleGeneratePersonalM3U}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                🎵 {githubPlaylistUrl ? 'Regenerate' : 'Generate'} Playlist
              </button>
            </div>
          </div>
        )}

        {/* Accounts Section */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Seedr Accounts</h2>
            <button
              onClick={() => setShowAddAccount(!showAddAccount)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              ➕ Add Account
            </button>
          </div>

          {showAddAccount && (
            <div className="bg-white/5 rounded-lg p-4 mb-4">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setLoginMode('password')}
                  className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                    loginMode === 'password'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-purple-200 hover:bg-white/20'
                  }`}
                >
                  🔐 Email/Password
                </button>
                <button
                  onClick={() => setLoginMode('device')}
                  className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                    loginMode === 'device'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-purple-200 hover:bg-white/20'
                  }`}
                >
                  📱 Device Code
                </button>
              </div>

              {loginMode === 'password' ? (
                <form onSubmit={handleLoginWithPassword} className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Seedr email"
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Seedr password"
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-2 rounded-lg transition-colors"
                  >
                    {loading ? 'Adding...' : 'Add Account'}
                  </button>
                </form>
              ) : (
                <div>
                  {!userCode ? (
                    <button
                      onClick={handleLoginWithDevice}
                      disabled={loading}
                      className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-2 rounded-lg transition-colors"
                    >
                      {loading ? 'Getting Code...' : 'Get Device Code'}
                    </button>
                  ) : (
                    <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                      <p className="text-green-200 font-semibold mb-2">Authorization Code:</p>
                      <p className="text-white text-2xl font-mono mb-2">{userCode}</p>
                      <p className="text-green-200 text-sm mb-2">Visit:</p>
                      <a 
                        href={verificationUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-300 hover:text-blue-200 break-all"
                      >
                        {verificationUrl}
                      </a>
                      <p className="text-green-200 text-sm mt-3">
                        ⏳ Waiting for authorization...
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {accounts.length === 0 ? (
            <p className="text-purple-200 text-center py-4">No accounts connected. Add one to get started!</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="bg-white/5 rounded-lg p-4 flex items-center justify-between border border-white/10"
                >
                  <div>
                    <p className="text-white font-medium">
                      {account.account_email || `Account #${account.id}`}
                    </p>
                    <p className="text-purple-300 text-sm">
                      Added: {new Date(account.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveAccount(account.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                  >
                    ❌ Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Magnet */}
        {accounts.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Add Torrent/Magnet Link</h2>
            <form onSubmit={handleAddMagnet} className="space-y-4">
              <input
                type="text"
                value={magnetLink}
                onChange={(e) => setMagnetLink(e.target.value)}
                placeholder="Paste magnet link here..."
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !magnetLink}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                {loading ? '⏳ Adding...' : '➕ Add to Seedr'}
              </button>
            </form>
          </div>
        )}

        {/* Message Display */}
        {message && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 mb-8">
            <p className="text-white whitespace-pre-wrap break-all">{message}</p>
          </div>
        )}

        {/* Files List */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Your Files</h2>
            <button
              onClick={() => fetchFiles(sessionId)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
          {files.length === 0 ? (
            <p className="text-purple-200 text-center py-8">
              {accounts.length === 0 
                ? 'Add a Seedr account to get started!' 
                : 'No files found. Add a magnet link to download!'}
            </p>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={`${file.accountId}-${file.id}`}
                  className="bg-white/5 rounded-lg border border-white/10 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="p-2 bg-purple-500/30 rounded">
                        {file.type === 'folder' ? (
                          <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">{file.name}</p>
                        {file.size && (
                          <p className="text-purple-300 text-sm">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        )}
                        {file.accountEmail && (
                          <p className="text-purple-400 text-xs">
                            {file.accountEmail}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleGetLinks(file.id, file.accountId)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      🔗 Links
                    </button>
                    <button
                      onClick={() => handleGenerateM3U(file.id, file.accountId)}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      🎵 M3U
                    </button>
                    <button
                      onClick={() => handleDeleteFile(file.id, file.accountId)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
