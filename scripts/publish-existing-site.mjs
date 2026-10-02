// Fallback publisher used only when the installed Sites packaging helper is unavailable.
// Repository credentials remain in memory and in subprocess environment variables.
import { spawnSync } from 'node:child_process';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

if (!process.stdin.isTTY) throw new Error('Interactive input is required.');
process.stdin.setRawMode(true);
process.stdout.write('Ready for publication JSON on stdin (input is hidden).\n');
const input = await new Promise((done) => {
  let buffer = '';
  process.stdin.on('data', (chunk) => {
    buffer += chunk.toString();
    if (buffer.includes('\n') || buffer.includes('\r')) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      done(JSON.parse(buffer.trim()));
    }
  });
});
const { credential, checkout, archive } = input;
const manifest = JSON.parse(await readFile(resolve(checkout, '.openai/hosting.json'), 'utf8'));
if (manifest.project_id !== 'appgprj_6abe87736d6c8191b37fa01f92b2b7ad' ||
    !credential.remote_url.endsWith('/' + manifest.project_id + '.git') ||
    credential.auth_mode !== 'http_extra_header' || credential.branch !== 'main') {
  throw new Error('The publication target does not match the private Site.');
}
await readFile(resolve(checkout, 'dist/server/index.js'));
await readFile(resolve(checkout, 'dist/server/wrangler.json'));
const env = { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.extraHeader',
  GIT_CONFIG_VALUE_0: 'Authorization: Bearer ' + credential.token };
function git(args, accepted = [0]) {
  const result = spawnSync('git', args, { cwd: checkout, env, encoding: 'utf8' });
  if (!accepted.includes(result.status)) throw new Error((result.stderr || 'Git operation failed.').replaceAll(credential.token, '[redacted]'));
  return result;
}
git(['fetch', '--no-tags', credential.remote_url, 'refs/heads/main']);
git(['merge-base', '--is-ancestor', 'FETCH_HEAD', 'HEAD']);
git(['add', '--', 'app/page.tsx', 'app/globals.css', 'public/stuni-logo.png', 'public/fonts/opensans-400.ttf', 'public/fonts/opensans-600.ttf', 'public/fonts/opensans-700.ttf', 'public/fonts/lora-400.ttf', 'public/fonts/lora-600.ttf']);
if (git(['diff', '--cached', '--quiet'], [0, 1]).status === 1) git(['-c', 'user.name=Sites', '-c', 'user.email=sites@users.noreply.openai.com', 'commit', '-m', 'Apply STUNI visual identity and original logo']);
const commit = git(['rev-parse', 'HEAD']).stdout.trim();
git(['push', credential.remote_url, 'HEAD:refs/heads/main']);
await mkdir(resolve(checkout, 'dist/.openai'), { recursive: true });
await copyFile(resolve(checkout, '.openai/hosting.json'), resolve(checkout, 'dist/.openai/hosting.json'));
const packed = spawnSync('tar', ['-cf', archive, 'dist'], { cwd: checkout, encoding: 'utf8' });
if (packed.status !== 0) throw new Error(packed.stderr || 'Packaging failed.');
process.stdout.write(JSON.stringify({ project_id: manifest.project_id, commit_sha: commit, archive }) + '\n');
process.exit(0);
