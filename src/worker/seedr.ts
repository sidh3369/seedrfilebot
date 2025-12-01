export interface SeedrDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

export interface SeedrTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number; // Added for refresh handling
}

export interface SeedrFolder {
  id: number;
  name: string;
  type: string;
  size?: number;
}

export interface SeedrFile {
  folder_file_id: number;
  name: string;
  size: number;
  play_video?: string;
}

export async function loginWithPassword(username: string, password: string): Promise<SeedrTokenResponse> {
  console.log('[SEEDR] Logging in with username/password...');
  
  const formData = new FormData();
  formData.append('grant_type', 'password');
  formData.append('client_id', 'seedr_chrome');
  formData.append('type', 'login');
  formData.append('username', username);
  formData.append('password', password);

  const response = await fetch('https://www.seedr.cc/oauth_test/token.php', {
    method: 'POST',
    body: formData,
  });

  console.log('[SEEDR] Login response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[SEEDR] Login error response:', errorText);
    throw new Error(`Failed to login: ${response.status} ${errorText}`);
  }

  const data = await response.json() as { access_token?: string; refresh_token?: string; error?: string };
  console.log('[SEEDR] Login data received');

  if (data.error) {
    throw new Error(data.error);
  }

  if (!data.access_token) {
    throw new Error('Invalid login response');
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  };
}

export async function getDeviceCode(): Promise<SeedrDeviceCodeResponse> {
  console.log('[SEEDR] Requesting device code...');
  
  // Try the new OAuth endpoint first
  try {
    const formData = new FormData();
    formData.append('client_id', 'seedr_xbmc');
    formData.append('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');
    
    const response = await fetch('https://www.seedr.cc/oauth/device/code', {
      method: 'POST',
      body: formData,
    });

    console.log('[SEEDR] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SEEDR] Error response:', errorText);
      throw new Error(`Failed to get device code: ${response.status} ${errorText}`);
    }

    const data = await response.json() as SeedrDeviceCodeResponse;
    console.log('[SEEDR] Device code data:', data);
    return data;
  } catch (error: any) {
    console.error('[SEEDR] Device code request failed:', error.message);
    throw error;
  }
}

export async function getTokenFromDeviceCode(deviceCode: string): Promise<SeedrTokenResponse> {
  console.log('[SEEDR] Polling for token with device code...');

  const params = new URLSearchParams({
    device_code: deviceCode,
    client_id: 'seedr_xbmc',
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
  });

  const response = await fetch('https://www.seedr.cc/oauth/device/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  console.log('[SEEDR] Token response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[SEEDR] Token error response:', errorText);
    throw new Error(`Failed to authorize device: ${response.status} ${errorText}`);
  }

  const data = await response.json() as { error?: string; access_token?: string; refresh_token?: string; expires_in?: number };
  console.log('[SEEDR] Token data:', data);

  if (data.error === 'authorization_pending') {
    throw new Error('PENDING');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  if (!data.access_token) {
    throw new Error('Invalid token response');
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

// New: Full login flow with polling (call this instead of raw getTokenFromDeviceCode)
export async function loginWithDeviceCode(deviceCodeResponse: SeedrDeviceCodeResponse): Promise<SeedrTokenResponse> {
  const { device_code, interval, expires_in } = deviceCodeResponse;
  const maxPolls = Math.floor(expires_in / interval) + 1; // Safety buffer

  for (let attempt = 0; attempt < maxPolls; attempt++) {
    try {
      const token = await getTokenFromDeviceCode(device_code);
      console.log('[SEEDR] Login successful!');
      return token;
    } catch (error: any) {
      if (error.message === 'PENDING') {
        console.log(`[SEEDR] Authorization pending... (attempt ${attempt + 1}/${maxPolls})`);
        await new Promise(resolve => setTimeout(resolve, interval * 1000));
      } else {
        throw error;
      }
    }
  }

  throw new Error('Login timeout: User did not authorize in time');
}

// New: Basic refresh (call when access_token expires)
export async function refreshToken(refreshToken: string): Promise<SeedrTokenResponse> {
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    client_id: 'seedr_xbmc',
  });

  const response = await fetch('https://www.seedr.cc/oauth/device/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const data = await response.json() as SeedrTokenResponse;
  return data;
}

export async function addMagnet(accessToken: string, magnetLink: string): Promise<number> {
  const formData = new FormData();
  formData.append('access_token', accessToken);
  formData.append('func', 'add_torrent');
  formData.append('torrent_magnet', magnetLink);
  const response = await fetch('https://www.seedr.cc/oauth_test/resource.php', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to add magnet: ${response.status} ${errorText}`);
  }

  const data = await response.json() as { user_torrent_id?: number; id?: number; result?: boolean };
  const torrentId = data.user_torrent_id || data.id || 0;
  if (torrentId === 0 && !data.result) {
    throw new Error('Invalid response from addMagnet');
  }
  return torrentId;
}

export async function getFolderContents(accessToken: string, folderId: number = 0): Promise<SeedrFolder[]> {
  const url = folderId === 0
    ? `https://www.seedr.cc/api/folder?access_token=${accessToken}`
    : `https://www.seedr.cc/api/folder/${folderId}?access_token=${accessToken}`;

  const response = await fetch(url, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to get folder contents');
  }

  const data = await response.json() as { folders?: SeedrFolder[] };
  return data.folders || [];
}

export async function getFiles(accessToken: string, folderId: number): Promise<SeedrFile[]> {
  const response = await fetch(`https://www.seedr.cc/api/folder/${folderId}?access_token=${accessToken}`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to get files');
  }

  const data = await response.json() as { files?: SeedrFile[] };
  return data.files || [];
}

export async function getFileUrl(accessToken: string, fileId: number): Promise<string> {
  const formData = new FormData();
  formData.append('access_token', accessToken);
  formData.append('func', 'fetch_file');
  formData.append('folder_file_id', fileId.toString());
  const response = await fetch('https://www.seedr.cc/oauth_test/resource.php', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to get file URL');
  }

  const data = await response.json() as { url?: string };
  return data.url || '';
}

export async function getAccountInfo(accessToken: string): Promise<{ space_max: number; space_used: number }> {
  const response = await fetch(`https://www.seedr.cc/api/settings?access_token=${accessToken}`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to get account info');
  }

  const data = await response.json() as { 
    account?: { 
      space_max?: number; 
      space_used?: number;
      bandwidth_max?: number;
      bandwidth_used?: number;
    } 
  };
  
  return {
    space_max: data.account?.space_max || 0,
    space_used: data.account?.space_used || 0,
  };
}

export async function deleteFolder(accessToken: string, folderId: number): Promise<void> {
  const formData = new FormData();
  formData.append('access_token', accessToken);
  formData.append('func', 'delete');
  formData.append('delete_arr', JSON.stringify([{ type: 'folder', id: folderId }]));
  
  const response = await fetch('https://www.seedr.cc/oauth_test/resource.php', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to delete folder');
  }
}

// Usage Example (uncomment to test):
/*
async function exampleLoginAndAdd() {
  try {
    const deviceCode = await getDeviceCode();
    console.log(`Visit ${deviceCode.verification_url} and enter code: ${deviceCode.user_code}`);
    const tokens = await loginWithDeviceCode(deviceCode);
    const torrentId = await addMagnet(tokens.access_token, 'magnet:?xt=urn:btih:...');
    console.log(`Added torrent ID: ${torrentId}`);
  } catch (error) {
    console.error(error);
  }
}
exampleLoginAndAdd();
*/
