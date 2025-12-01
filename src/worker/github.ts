import { Octokit } from '@octokit/rest';
import { Env } from './env';

// Worker-compatible base64 encoding
function base64Encode(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

export async function uploadM3U8ToGitHub(
  env: Env,
  content: string,
  filename: string
): Promise<string> {
  const octokit = new Octokit({
    auth: env.GITHUB_TOKEN,
  });

  const owner = env.GITHUB_REPO_OWNER;
  const repo = env.GITHUB_REPO_NAME;
  const path = filename;

  try {
    // Try to get existing file
    const { data: existingFile } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    // Update existing file
    if ('sha' in existingFile) {
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: `Update ${filename}`,
        content: base64Encode(content),
        sha: existingFile.sha,
      });
    }
  } catch (error: any) {
    if (error.status === 404) {
      // Create new file
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: `Add ${filename}`,
        content: base64Encode(content),
      });
    } else {
      throw error;
    }
  }

  return `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
}
