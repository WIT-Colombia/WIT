import { verifyPublication } from './verify-publication.mjs';
// Opt-in local packaging only. Never called by the deployment or polling scripts.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, lstatSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist/publication');
mkdirSync(output, { recursive: true });
const release = mkdtempSync(join(output, 'release-'));
const manifest = { schemaVersion: 1, commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), activation: 'manual-approval-required', apps: {} };
function validate(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || entry.startsWith('.env')) throw new Error(`Unsafe artifact: ${path}`);
    if (stat.isDirectory()) validate(path);
  }
}
try {
  for (const [name, workspace] of Object.entries({ landing: 'landing', usuario: 'usuario', business: 'negocios', admin: 'admin' })) {
    const build = join(release, `${name}-dist`);
    execFileSync('npm', ['exec', `--workspace=@wit/${workspace}`, '--', 'tsc', '-b'], { cwd: root, stdio: 'inherit' });
    execFileSync('npm', ['exec', `--workspace=@wit/${workspace}`, '--', 'vite', 'build', '--outDir', build], { cwd: root, stdio: 'inherit' });
    if (!readFileSync(join(build, 'index.html'), 'utf8').includes('<html')) throw new Error(`Missing HTML: ${name}`);
    validate(build);
    const archive = `${name}.tar.gz`;
    execFileSync('tar', ['-czf', join(release, archive), '-C', build, '.']);
    manifest.apps[name] = { archive, sha256: createHash('sha256').update(readFileSync(join(release, archive))).digest('hex') };
    rmSync(build, { recursive: true });
  }
  writeFileSync(join(release, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  verifyPublication(release);
  console.log(`Packages ready for review: ${release}`);
} catch (error) {
  rmSync(release, { recursive: true, force: true });
  throw error;
}
