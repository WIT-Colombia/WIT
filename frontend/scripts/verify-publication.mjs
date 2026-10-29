import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export function verifyPublication(release) {
  const manifest = JSON.parse(readFileSync(join(release, 'manifest.json'), 'utf8'));
  assert.match(manifest.commit, /^[a-f0-9]{40}$/);
  assert.equal(manifest.activation, 'manual-approval-required');
  assert.deepEqual(Object.keys(manifest.apps).sort(), ['admin', 'business', 'landing', 'usuario']);
  for (const [name, artifact] of Object.entries(manifest.apps)) {
    assert.equal(artifact.archive, `${name}.tar.gz`);
    const archive = join(release, artifact.archive);
    assert.equal(createHash('sha256').update(readFileSync(archive)).digest('hex'), artifact.sha256);
    const files = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n');
    assert(files.includes('./index.html'));
    assert(files.every(file => !file.includes('..') && !file.startsWith('/') && !file.includes('.env')));
    const directory = mkdtempSync(join(tmpdir(), 'xamuko-artifact-'));
    try {
      execFileSync('tar', ['-xzf', archive, '-C', directory]);
      const html = readFileSync(join(directory, 'index.html'), 'utf8');
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)[^"]*"/g)].map(match => match[1]);
      assert(assets.some(asset => asset.endsWith('.js')));
      for (const asset of assets) assert(existsSync(join(directory, asset)), `Missing ${name} asset ${asset}`);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }
}
if (process.argv[2]) {
  verifyPublication(process.argv[2]);
  console.log('Verified four archives: hashes, standalone HTML and referenced assets.');
}
