#!/usr/bin/env python3
"""One-shot pinned backend deployment. No bootstrap, IAM, READY creation or migrations."""
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import time

COMMIT = 'a467b4e01131f38dc05dc713a4b84717bb709753'
BASE = 'deb9c284b1ca008bb802683e85a338e1d0b139eb'
DIGEST = '72008bcf659f346912f944eb35de6431dee12e2a8d82bafa28325056319151df'
ROOT = Path('/opt/xamuko/deploy')
VERIFIER = Path('/usr/local/sbin/xamuko-verify-persistent-storage')
NODE = '/usr/bin/node-22'


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def run(*args):
    # Never echo subprocess output: nginx/systemd diagnostics can contain secrets.
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=180)
    require(result.returncode == 0, 'Command failed: ' + args[0])
    return result.stdout.strip()


def protected(path, mode=None):
    s = path.lstat()
    require(stat.S_ISREG(s.st_mode) and s.st_uid == 0 and not s.st_mode & 0o022,
            'Untrusted file: ' + str(path))
    if mode is not None:
        require(stat.S_IMODE(s.st_mode) == mode, 'Incorrect file permissions')


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest() if hasattr(hashlib, 'file_digest') else hash_stream(stream)


def hash_stream(stream):
    h = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
        h.update(chunk)
    return h.hexdigest()


def extract(archive, dest, expected=DIGEST):
    require(digest(archive) == expected, 'TAR.GZ checksum mismatch')
    with tarfile.open(archive, 'r:gz') as tar:
        members = tar.getmembers()
        members = [m for m in members if not (m.name in ('.', './') and m.isdir())]
        seen = set()
        links = set()
        total = 0
        allowed = {'dist', 'node_modules', 'prisma', 'package.json', 'package-lock.json',
                   'prisma.config.ts', 'tsconfig.json', 'RELEASE_COMMIT', 'MANIFEST.json', 'FILES.sha256'}
        for m in members:
            p = PurePosixPath(m.name)
            require(not p.is_absolute() and '..' not in p.parts and p.parts and
                    p.parts[0] in allowed and str(p) not in seen, 'Unsafe/duplicate archive path')
            seen.add(str(p))
            require(not any(part.startswith('.env') or part.endswith(('.pem', '.key')) for part in p.parts), 'Secret path in archive')
            require(not m.mode & 0o7000 and (m.isfile() or m.isdir() or m.issym()), 'Unsafe archive type/mode')
            if m.issym():
                require(p.parts[0] == 'node_modules', 'Link outside dependencies')
                target = PurePosixPath(m.linkname)
                require(not target.is_absolute(), 'Absolute symlink')
                normalized = os.path.normpath(str(p.parent / target))
                require(normalized.startswith('node_modules/'), 'Escaping symlink')
                links.add(str(p))
            total += m.size
        require(len(members) <= 50000 and total < 2 * 1024**3, 'Archive exceeds limits')
        for name in seen:
            require(not any(str(parent) in links for parent in PurePosixPath(name).parents), 'Symlink ancestor')
        tar.extractall(dest, members=members)
    require((dest / 'RELEASE_COMMIT').read_text().strip() == COMMIT, 'Wrong source commit')
    manifest = json.loads((dest / 'MANIFEST.json').read_text())
    require(manifest['sourceSha'] == COMMIT and manifest['baseSha'] == BASE and
            manifest['platform'] == 'linux' and manifest['arch'] == 'x64' and
            manifest['node'] == 'v22.23.4', 'Wrong build manifest')
    require((dest / 'dist/server.js').is_file(), 'Missing server')
    listed = set()
    for line in (dest / 'FILES.sha256').read_text().splitlines():
        checksum, name = line.split('  ', 1)
        relative = PurePosixPath(name)
        require(not relative.is_absolute() and '..' not in relative.parts and relative.parts, 'Unsafe manifest path')
        target = dest / str(relative)
        require(target.is_file() and not target.is_symlink() and str(relative) not in listed and
                digest(target) == checksum, 'Internal file checksum mismatch')
        listed.add(str(relative))
    actual = {str(f.relative_to(dest)) for f in dest.rglob('*') if f.is_file() and not f.is_symlink()}
    require(listed == actual - {'FILES.sha256'}, 'Incomplete internal manifest')


def tree(path):
    require(path.is_dir(), 'Missing Prisma directory')
    require(not any(p.is_symlink() for p in path.rglob('*')), 'Prisma contains symlink')
    return {str(p.relative_to(path)): digest(p) for p in path.rglob('*') if p.is_file()}


def switch(target):
    tmp = ROOT / '.nickname214-current'
    require(not tmp.exists() and not tmp.is_symlink(), 'Stale switch marker')
    tmp.symlink_to(target)
    os.replace(tmp, ROOT / 'current')


def health(release, port=3000, unit='xamuko-api'):
    for _ in range(30):
        try:
            require(run('systemctl', 'is-active', unit) == 'active', 'Inactive service')
            pid = run('systemctl', 'show', unit, '-p', 'MainPID', '--value')
            require(pid.isdigit() and int(pid) > 0 and Path('/proc', pid, 'cwd').resolve() == release / 'backend', 'Wrong running release')
            h = json.loads(run('curl', '-fsS', '--max-time', '3', f'http://127.0.0.1:{port}/api/v1/health'))
            require(h.get('status') == 'ok' and h.get('service') == 'wit-backend', 'Wrong health body')
            return
        except (RuntimeError, ValueError, OSError):
            time.sleep(1)
    raise RuntimeError('Health deadline exceeded')


def frontend():
    run('nginx', '-t')
    config = run('nginx', '-T')
    # Fail closed: backend-only releases cannot satisfy versioned frontend roots.
    require('/opt/xamuko/deploy/current' not in config, 'Nginx depends on current: manual frontend contract review required')
    return hashlib.sha256(run('curl', '-fsS', '--max-time', '15', 'https://xamuko.com/').encode()).hexdigest()


def preflight():
    require(os.uname().sysname == 'Linux' and os.uname().machine == 'x86_64', 'Linux x86_64 required')
    require(run(NODE, '--version') == 'v22.23.4', 'Node version differs from validated artifact')
    require((ROOT / 'current').is_symlink(), 'current must be a symlink')
    old = (ROOT / 'current').resolve(strict=True)
    require(old == ROOT / 'releases' / BASE, 'Production base changed')
    require((ROOT / 'previous').resolve(strict=True) == ROOT / 'releases/4bd425a29c056baee7d5174692f65b71e3d9c087', 'previous changed')
    protected(old / 'xamuko-api.env', 0o600)
    protected(VERIFIER)
    for prop, expected in [('User', 'ssm-user'), ('WorkingDirectory', str(ROOT / 'current/backend'))]:
        require(run('systemctl', 'show', 'xamuko-api', '-p', prop, '--value') == expected, 'Unsupported systemd ' + prop)
    env = run('systemctl', 'show', 'xamuko-api', '-p', 'EnvironmentFiles', '--value')
    require(env == str(ROOT / 'current/xamuko-api.env') + ' (ignore_errors=no)', 'Unsupported EnvironmentFile')
    start = run('systemctl', 'show', 'xamuko-api', '-p', 'ExecStart', '--value')
    require('path=' + NODE + ' ;' in start and
            'argv[]=' + NODE + ' ' + str(ROOT / 'current/backend/dist/server.js') + ' ;' in start, 'Unsupported ExecStart')
    require(run(str(VERIFIER), str(old)) == 'ENV_ONLY', 'Only reviewed ENV_ONLY storage supported')
    health(old)
    page = frontend()
    require(shutil.disk_usage(ROOT).free > 4 * 1024**3, 'Need 4 GiB free')
    return old, page


def deploy(bucket, version):
    import re
    require(re.fullmatch(r'[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]', bucket) and version and version != 'null', 'Private versioned S3 object required')
    protected(ROOT / 'READY', 0o600)
    require((ROOT / 'READY').read_text().strip() == f'nickname214 {COMMIT} {DIGEST}', 'READY approval does not match pinned release')
    old, page = preflight()
    release = ROOT / 'releases' / COMMIT
    require(not release.exists() and not release.is_symlink(), 'Candidate already exists')
    switched = False
    created = False
    committed = False
    unit = 'xamuko-nickname214-smoke'
    with tempfile.TemporaryDirectory(prefix='nickname214-', dir=ROOT) as work:
        work = Path(work)
        try:
            archive = work / 'release.tar.gz'
            run('aws', 's3api', 'get-object', '--region', 'us-east-2', '--bucket', bucket,
                '--key', f'releases/{COMMIT}/xamuko-backend-{COMMIT}.tar.gz',
                '--version-id', version, str(archive))
            package = work / 'package'
            package.mkdir()
            extract(archive, package)
            require(tree(package / 'prisma') == tree(old / 'backend/prisma'), 'Prisma differs; migrations prohibited')
            for name in ('package.json', 'package-lock.json', 'prisma.config.ts'):
                require(digest(package / name) == digest(old / 'backend' / name), 'Dependencies/config differ')
            release.mkdir(mode=0o755)
            release.chmod(0o755)
            created = True
            shutil.move(str(package), release / 'backend')
            for p in [release / 'backend', *(release / 'backend').rglob('*')]:
                if not p.is_symlink():
                    p.chmod(0o755 if p.is_dir() or p.stat().st_mode & 0o111 else 0o644)
            shutil.copyfile(old / 'xamuko-api.env', release / 'xamuko-api.env')
            (release / 'xamuko-api.env').chmod(0o600)
            require(run(str(VERIFIER), str(release)) == 'ENV_ONLY', 'Candidate storage invalid')
            # No production secrets. Network namespace blocks DB, S3, SMTP and OAuth.
            smoke_env = work / 'smoke.env'
            smoke_env.write_text('NODE_ENV=test\nPORT=3001\nHOST=127.0.0.1\nDATABASE_URL=mysql://smoke:smoke@127.0.0.1:1/smoke\nAUTH_ACCESS_TOKEN_SECRET=isolated-smoke-secret-at-least-32-characters\n')
            smoke_env.chmod(0o600)
            run('systemd-run', '--quiet', '--collect', '--unit=' + unit,
                '-p', 'User=ssm-user', '-p', 'PrivateNetwork=yes', '-p', 'ProtectSystem=strict',
                '-p', 'ProtectHome=yes', '-p', 'NoNewPrivileges=yes', '-p', 'PrivateTmp=yes', '-p', 'RuntimeMaxSec=120',
                '-p', 'InaccessiblePaths=/var/lib/xamuko /opt/xamuko/deploy/backups',
                '-p', 'WorkingDirectory=' + str(release / 'backend'),
                '-p', 'EnvironmentFile=' + str(smoke_env), NODE, str(release / 'backend/dist/server.js'))
            pid = run('systemctl', 'show', unit, '-p', 'MainPID', '--value')
            require(pid.isdigit() and int(pid) > 0, 'Smoke did not start')
            for attempt in range(30):
                try:
                    h = json.loads(run('nsenter', '-t', pid, '-n', 'curl', '-fsS', '--max-time', '2', 'http://127.0.0.1:3001/api/v1/health'))
                    require(h.get('status') == 'ok' and h.get('service') == 'wit-backend', 'Smoke body invalid')
                    break
                except (RuntimeError, ValueError):
                    if attempt == 29:
                        raise
                    time.sleep(1)
            run('systemctl', 'stop', unit)
            require((ROOT / 'current').resolve() == old and frontend() == page, 'Live state changed during preparation')
            # Mark switched before mutation so errors/signals always enter recovery.
            switched = True
            switch(release)
            run('systemctl', 'restart', 'xamuko-api')
            health(release)
            require(frontend() == page, 'Frontend changed after activation')
            run('curl', '-fsS', '--max-time', '15', 'https://xamuko.com/api/v1/public/businesses')
            (release / 'VERIFIED').write_text(json.dumps({'commit': COMMIT, 'artifactSha256': DIGEST, 'recoveryTarget': BASE}) + '\n')
            tmp = ROOT / '.nickname214-previous'
            require(not tmp.exists() and not tmp.is_symlink(), 'Stale previous marker')
            tmp.symlink_to(old)
            os.replace(tmp, ROOT / 'previous')
            committed = True
        finally:
            with contextlib.suppress(RuntimeError):
                run('systemctl', 'stop', unit)
            if switched and not committed:
                switch(old)
                run('systemctl', 'restart', 'xamuko-api')
                health(old)  # On recovery failure retain candidate and raise.
                require(frontend() == page, 'CRITICAL: frontend recovery failed')
            if created and not committed:
                shutil.rmtree(release)


def main():
    require(os.geteuid() == 0, 'root required')
    os.umask(0o077)
    protected(Path(__file__).resolve())
    for p in (ROOT, ROOT / 'releases'):
        s = p.lstat()
        require(stat.S_ISDIR(s.st_mode) and s.st_uid == 0 and not s.st_mode & 0o022, 'Untrusted deployment directory')
    with open('/run/lock/xamuko-deploy.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        def interrupted(*_):
            raise RuntimeError('Interrupted')
        for sig in (signal.SIGINT, signal.SIGTERM):
            signal.signal(sig, interrupted)
        if sys.argv[1:] == ['check']:
            preflight()
            print('Preflight passed; READY was not created')
        else:
            require(len(sys.argv) == 4 and sys.argv[1] == 'deploy', 'Usage: check | deploy BUCKET VERSION_ID')
            deploy(sys.argv[2], sys.argv[3])


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
