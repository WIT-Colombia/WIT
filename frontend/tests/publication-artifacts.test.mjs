import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyPublication } from '../scripts/verify-publication.mjs';

function fixture(t, { missingAsset = false, missingHtml = false } = {}) {
  const release = mkdtempSync(join(tmpdir(), 'xamuko-publication-test-'));
  t.after(() => rmSync(release, { recursive: true, force: true }));
  const source = join(release, 'source');
  mkdirSync(join(source, 'assets'), { recursive: true });
  if (!missingHtml) writeFileSync(join(source, 'index.html'), '<html><script src="/assets/app.js"></script></html>');
  writeFileSync(join(source, 'assets', missingAsset ? 'other.js' : 'app.js'), 'console.log("fixture");');
  const manifest = { schemaVersion: 1, commit: 'a'.repeat(40), activation: 'manual-approval-required', apps: {} };
  for (const name of ['landing', 'usuario', 'business', 'admin']) {
    const archive = `${name}.tar.gz`;
    execFileSync('tar', ['-czf', join(release, archive), '-C', source, '.']);
    manifest.apps[name] = { archive, sha256: createHash('sha256').update(readFileSync(join(release, archive))).digest('hex') };
  }
  const save = () => writeFileSync(join(release, 'manifest.json'), JSON.stringify(manifest));
  save();
  return { release, manifest, save };
}

test('accept four complete standalone archives', t => {
  assert.doesNotThrow(() => verifyPublication(fixture(t).release));
});
test('reject an archive changed after the manifest was written', t => {
  const { release } = fixture(t);
  writeFileSync(join(release, 'business.tar.gz'), 'corrupted');
  assert.throws(() => verifyPublication(release), { code: 'ERR_ASSERTION' });
});
test('reject a missing application in the manifest', t => {
  const { release, manifest, save } = fixture(t);
  delete manifest.apps.admin;
  save();
  assert.throws(() => verifyPublication(release), { code: 'ERR_ASSERTION' });
});
test('reject HTML that references an absent JavaScript asset', t => {
  assert.throws(() => verifyPublication(fixture(t, { missingAsset: true }).release), /Missing landing asset/);
});
test('reject packages without index.html even with a correct checksum', t => {
  assert.throws(() => verifyPublication(fixture(t, { missingHtml: true }).release), { code: 'ERR_ASSERTION' });
});
test('reject an unexpected archive path in the manifest', t => {
  const { release, manifest, save } = fixture(t);
  manifest.apps.landing.archive = '../landing.tar.gz';
  save();
  assert.throws(() => verifyPublication(release), { code: 'ERR_ASSERTION' });
});
