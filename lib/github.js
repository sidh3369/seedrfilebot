import { Octokit } from '@octokit/rest';
import { config } from 'dotenv';

config();

function base64Encode(str) {
  return Buffer.from(str, 'utf-8').toString('base64');
}

export async function uploadM3U8(content, filename) {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const path = filename;

  try {
    const { data: existingFile } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

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
  } catch (error) {
    if (error.status === 404) {
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
