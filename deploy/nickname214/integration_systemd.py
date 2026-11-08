#!/usr/bin/env python3
"""Disposable GitHub VM only. Real systemd; synthetic package and external adapters.
The pinned production archive is validated separately by the workflow.
"""
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('procedure', HERE / 'procedure.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)

def cmd(*args, check=True):
    return subprocess.run(args, check=check, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout.strip()

def expect_failure(fn, contains):
    try:
        fn()
    except Exception as exc:
        assert contains in str(exc), (contains, str(exc))
    else:
        raise AssertionError('Expected failure: ' + contains)

def main():
    assert os.geteuid() == 0
    assert os.environ.get('XAMUKO_DISPOSABLE_TEST') == 'github-hosted-pr215'
    assert os.uname().sysname == 'Linux' and os.uname().machine == 'x86_64'
    assert Path('/proc/1/comm').read_text().strip() == 'systemd', 'PID1 is not systemd; real integration BLOCKED'
    assert not p.ROOT.exists(), 'Refuse existing deployment directory'
    assert not p.VERIFIER.exists(), 'Refuse existing verifier'
    assert cmd(p.NODE, '--version') == 'v22.23.4'
    evidence = {'pid1': Path('/proc/1/comm').read_text().strip(), 'arch': os.uname().machine,
                'systemd': cmd('systemctl', '--version').splitlines()[0], 'node': cmd(p.NODE, '--version'),
                'scope': 'synthetic package; real systemd/processes/namespaces; separate pinned archive validation', 'tests': []}
    out = Path(os.environ['TEST_EVIDENCE'])
    out.mkdir(parents=True, exist_ok=True)
    units = ['xamuko-api', 'xamuko-test-http', 'xamuko-test-db', 'xamuko-nickname214-smoke']
    work = Path(tempfile.mkdtemp(prefix='pr215-systemd-', dir='/opt'))
    work.chmod(0o755)
    try:
        cmd('useradd', '--system', '--no-create-home', 'ssm-user')
        p.ROOT.mkdir(parents=True, mode=0o755)
        (p.ROOT / 'releases').mkdir(mode=0o755)
        (p.ROOT / 'backups').mkdir(mode=0o700)
        Path('/var/lib/xamuko').mkdir(mode=0o700)
        Path('/var/lib/xamuko/production-canary').write_text('synthetic-inaccessible-canary')
        old = p.ROOT / 'releases' / p.BASE
        previous = p.ROOT / 'releases/4bd425a29c056baee7d5174692f65b71e3d9c087'
        previous.mkdir()
        backend = old / 'backend'
        (backend / 'dist').mkdir(parents=True)
        (backend / 'prisma').mkdir()
        (backend / 'prisma/schema.prisma').write_text('// disposable fake DB contract\n')
        for name in ('package.json', 'package-lock.json', 'prisma.config.ts'):
            (backend / name).write_text('{}\n')
        server = '''const http=require('http'),fs=require('fs');
if(process.env.PORT==='3001') {
 if(process.env.PRODUCTION_CANARY) process.exit(91);
 for(const p of ['/var/lib/xamuko/production-canary','/opt/xamuko/deploy/backups']) {
  try {fs.readdirSync(p);process.exit(92)} catch(e) {if(e.code!=='EACCES'&&e.code!=='ENOENT'&&e.code!=='ENOTDIR')throw e;}
 }
 if(fs.readFileSync('/proc/net/route','utf8').trim().split('\\n').length!==1) process.exit(93);
 if(fs.existsSync('/opt/pr215-fail-smoke')) process.exit(94);
} else if(process.cwd().includes('a467b4e')&&fs.existsSync('/opt/pr215-fail-activation'))process.exit(95);
http.createServer((q,r)=>{r.setHeader('Content-Type','application/json');r.end(JSON.stringify({status:'ok',service:'wit-backend'}))}).listen(Number(process.env.PORT||3000),'127.0.0.1');
'''
        (backend / 'dist/server.js').write_text(server)
        (old / 'xamuko-api.env').write_text('PORT=3000\nPRODUCTION_CANARY=synthetic-do-not-inherit\n')
        (old / 'xamuko-api.env').chmod(0o600)
        (p.ROOT / 'current').symlink_to(old)
        (p.ROOT / 'previous').symlink_to(previous)
        p.VERIFIER.parent.mkdir(parents=True, exist_ok=True)
        p.VERIFIER.write_text('#!/bin/sh\nprintf "ENV_ONLY\\n"\n')
        p.VERIFIER.chmod(0o755)
        package = work / 'package'
        shutil.copytree(backend, package)
        (package / 'RELEASE_COMMIT').write_text(p.COMMIT)
        (package / 'MANIFEST.json').write_text(json.dumps(dict(sourceSha=p.COMMIT, baseSha=p.BASE, platform='linux', arch='x64', node='v22.23.4')))
        (package / 'FILES.sha256').write_text(''.join(p.digest(f)+'  '+str(f.relative_to(package))+'\n' for f in sorted(package.rglob('*')) if f.is_file()))
        archive = work / 'fixture.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            for f in package.iterdir(): tar.add(f, arcname=f.name)
        # Only the fixture digest is injected. Extraction and all deployment logic stay real.
        real_extract = p.extract
        p.DIGEST = p.digest(archive)
        p.extract = lambda a, d: real_extract(a, d, expected=p.DIGEST)
        adapters = work / 'bin'
        adapters.mkdir()
        adapters.chmod(0o755)
        scripts = {
            'aws': '#!/usr/bin/python3\nimport sys,shutil\na=sys.argv[1:]\nassert a[:2]==["s3api","get-object"]\nassert a[a.index("--bucket")+1]=="disposable-fixture"\nassert a[a.index("--version-id")+1]=="fixture-v1"\nshutil.copyfile('+repr(str(archive))+',a[-1])\n',
            'nginx': '#!/bin/sh\ncase "$1" in -t) exit 0;; -T) echo "# disposable frontend contract";; *) exit 64;; esac\n',
            'curl': '#!/usr/bin/python3\nimport os,sys\na=[x.replace("https://xamuko.com/","http://127.0.0.1:8080/") for x in sys.argv[1:]]\nos.execv("/usr/bin/curl",["curl"]+a)\n'
        }
        for name, body in scripts.items():
            f = adapters / name; f.write_text(body); f.chmod(0o755)
        os.environ['PATH'] = str(adapters) + ':/usr/sbin:/usr/bin:/sbin:/bin'
        # A shared, private network for the disposable live API, HTTP mock and fake DB.
        # The smoke gets its own additional namespace from the installer itself.
        mock = work / 'http.py'
        mock.write_text('from http.server import HTTPServer,BaseHTTPRequestHandler\nclass H(BaseHTTPRequestHandler):\n def do_GET(self):\n  self.send_response(200);self.end_headers();self.wfile.write(b"disposable frontend")\n def log_message(self,*a): pass\nHTTPServer(("127.0.0.1",8080),H).serve_forever()\n')
        cmd('systemd-run', '--unit=xamuko-test-http', '-p', 'PrivateNetwork=yes', '/usr/bin/python3', str(mock))
        db = work / 'db.py'
        db.write_text('import socket\ns=socket.socket();s.bind(("127.0.0.1",3306));s.listen()\nwhile True:\n c,a=s.accept();c.sendall(b"DISPOSABLE-FAKE-DB\\n");c.close()\n')
        cmd('systemd-run','--unit=xamuko-test-db','-p','PrivateNetwork=yes','-p','JoinsNamespaceOf=xamuko-test-http.service','/usr/bin/python3',str(db))
        unit = Path('/etc/systemd/system/xamuko-api.service')
        unit.write_text('[Unit]\nJoinsNamespaceOf=xamuko-test-http.service\n[Service]\nUser=ssm-user\nPrivateNetwork=yes\nWorkingDirectory='+str(p.ROOT / 'current/backend')+'\nEnvironmentFile='+str(p.ROOT / 'current/xamuko-api.env')+'\nExecStart='+p.NODE+' '+str(p.ROOT / 'current/backend/dist/server.js')+'\n')
        cmd('systemctl','daemon-reload')
        cmd('systemctl','start','xamuko-api')
        # Enter the fake-live network for installer HTTP checks; systemd D-Bus stays real.
        pid = cmd('systemctl','show','xamuko-test-http','-p','MainPID','--value')
        import ctypes
        fd = os.open('/proc/'+pid+'/ns/net', os.O_RDONLY)
        assert ctypes.CDLL(None, use_errno=True).setns(fd, 0) == 0
        os.close(fd)
        assert cmd('/usr/bin/curl','-fsS','--retry','10','--retry-connrefused','http://127.0.0.1:8080/') == 'disposable frontend'
        assert cmd('/usr/bin/python3','-c','import socket;print(socket.create_connection(("127.0.0.1",3306)).recv(100).decode().strip())') == 'DISPOSABLE-FAKE-DB'
        evidence['tests'].append('HTTP mock and fake DB reachable only in disposable live namespace')
        assert Path('/proc/self/ns/net').readlink() != Path('/proc/1/ns/net').readlink()
        p.preflight()
        evidence['tests'].append('real systemd preflight, MainPID cwd, User, EnvironmentFile, ExecStart, Node')
        expect_failure(lambda: p.deploy('disposable-fixture','fixture-v1'), 'READY')
        # READY exists only inside this fresh, synthetic VM fixture, never AWS/production.
        (p.ROOT / 'READY').write_text(f'nickname214 {p.COMMIT} {p.DIGEST}')
        (p.ROOT / 'READY').chmod(0o600)
        trusted_wrapper = work / 'procedure.py'
        shutil.copyfile(HERE / 'procedure.py', trusted_wrapper)
        trusted_wrapper.chmod(0o755)
        with open('/run/lock/xamuko-deploy.lock','a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = subprocess.run(['/usr/bin/python3',str(trusted_wrapper),'check'],capture_output=True,text=True)
            assert result.returncode != 0 and 'temporarily unavailable' in result.stderr
        evidence['tests'].append('missing approval and real flock contention rejected')
        for fault, message in [('smoke','Smoke did not start'),('activation','Health deadline exceeded')]:
            marker = Path('/opt/pr215-fail-'+fault); marker.touch()
            try:
                # A smoke process may start before exiting, hence either valid failure path.
                try: p.deploy('disposable-fixture','fixture-v1')
                except RuntimeError as exc:
                    assert str(exc) in ('Smoke did not start','Command failed: nsenter','Health deadline exceeded'), str(exc)
                else: raise AssertionError('Failure injection did not fail')
                assert (p.ROOT / 'current').resolve() == old
                assert (p.ROOT / 'previous').resolve() == previous
                assert not (p.ROOT / 'releases' / p.COMMIT).exists()
                p.health(old)
                evidence['tests'].append(fault+' failure recovered exact base; candidate removed; previous unchanged')
            finally: marker.unlink()
        p.deploy('disposable-fixture','fixture-v1')
        assert (p.ROOT / 'current').resolve().name == p.COMMIT
        assert (p.ROOT / 'previous').resolve() == old
        assert (p.ROOT / 'current/VERIFIED').is_file()
        p.health((p.ROOT / 'current').resolve())
        evidence['tests'].append('success: real isolated smoke, atomic activation, health and VERIFIED')
        evidence['status'] = 'PASS'
    finally:
        evidence.setdefault('status','FAIL')
        for unit in units:
            cmd('systemctl','stop',unit,check=False)
        evidence['units_inactive'] = all(cmd('systemctl','is-active',u,check=False) != 'active' for u in units)
        (out / 'systemd-integration.json').write_text(json.dumps(evidence,indent=2)+'\n')
        print(json.dumps(evidence,indent=2))

if __name__ == '__main__': main()
