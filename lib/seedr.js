export async function loginWithPassword(username, password) {
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

  if (!response.ok) {
    throw new Error(`Failed to login: ${response.status}`);
  }

  const data = await response.json();

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

export async function addMagnet(accessToken, magnetLink) {
  const formData = new FormData();
  formData.append('access_token', accessToken);
  formData.append('func', 'add_torrent');
  formData.append('torrent_magnet', magnetLink);

  const response = await fetch('https://www.seedr.cc/oauth_test/resource.php', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to add magnet: ${response.status}`);
  }

  const data = await response.json();
  return data.user_torrent_id || data.id || 0;
}

export async function getFolderContents(accessToken, folderId = 0) {
  const url = folderId === 0
    ? `https://www.seedr.cc/api/folder?access_token=${accessToken}`
    : `https://www.seedr.cc/api/folder/${folderId}?access_token=${accessToken}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to get folder contents');
  }

  const data = await response.json();
  return data.folders || [];
}

export async function getFiles(accessToken, folderId) {
  const response = await fetch(`https://www.seedr.cc/api/folder/${folderId}?access_token=${accessToken}`);

  if (!response.ok) {
    throw new Error('Failed to get files');
  }

  const data = await response.json();
  return data.files || [];
}

export async function getFileUrl(accessToken, fileId) {
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

  const data = await response.json();
  return data.url || '';
}

export async function deleteFolder(accessToken, folderId) {
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
